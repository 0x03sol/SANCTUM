// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {SentinelUnderwriter} from "../src/SentinelUnderwriter.sol";
import {AegisRegistry} from "../src/AegisRegistry.sol";

contract SentinelUnderwriterTest is Test {
    SentinelUnderwriter internal sentinel;
    AegisRegistry internal aegis;

    address internal oracle;
    address internal agent; // underwriter agent identity
    address internal alice; // policyholder
    address internal scheduler;

    bytes32 internal constant ASSET = keccak256("ETH");
    uint16 internal constant TRIGGER_BPS = 3000; // 30%
    uint16 internal constant MULT_BPS = 20000; // 2x
    uint8 internal constant WINDOW = 3;

    address internal constant HTTP = address(0x0801);
    address internal constant JQ = address(0x0803);

    function setUp() public {
        oracle = makeAddr("oracle");
        agent = makeAddr("agent");
        alice = makeAddr("alice");
        scheduler = makeAddr("scheduler");

        aegis = new AegisRegistry();
        sentinel = new SentinelUnderwriter(aegis, ASSET, TRIGGER_BPS, MULT_BPS, WINDOW);

        aegis.setReporter(address(sentinel), true);
        sentinel.setAgentIdentity(agent);
        sentinel.setOracle(oracle, true);
        sentinel.setScheduler(scheduler);

        // seed pool so policies can be backed (2x coverage needs reserves)
        vm.deal(address(this), 100 ether);
        sentinel.fundPool{value: 10 ether}();
    }

    function _record(uint256 price) internal {
        vm.prank(oracle);
        sentinel.recordPrice(price);
    }

    // ---- config ----

    function test_constructor_revertsBadTrigger() public {
        vm.expectRevert(SentinelUnderwriter.BadConfig.selector);
        new SentinelUnderwriter(aegis, ASSET, 0, MULT_BPS, WINDOW);
    }

    function test_constructor_revertsLowMultiplier() public {
        vm.expectRevert(SentinelUnderwriter.BadConfig.selector);
        new SentinelUnderwriter(aegis, ASSET, TRIGGER_BPS, 9999, WINDOW); // < 1x
    }

    function test_agentRegisteredAsUnderwriter() public view {
        assertTrue(aegis.isRegistered(agent));
        assertEq(uint8(aegis.reputationOf(agent).role), uint8(AegisRegistry.Role.Underwriter));
    }

    // ---- policies ----
