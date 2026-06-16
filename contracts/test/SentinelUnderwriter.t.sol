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

    function test_buyPolicy_collectsPremiumAndCoverage() public {
        vm.deal(alice, 5 ether);
        vm.prank(alice);
        uint256 id = sentinel.buyPolicy{value: 1 ether}();
        SentinelUnderwriter.Policy memory p = sentinel.getPolicy(id);
        assertEq(p.holder, alice);
        assertEq(p.premium, 1 ether);
        assertEq(p.payout, 2 ether); // 2x
        assertTrue(p.active);
        assertEq(sentinel.totalCoverage(), 2 ether);
        // premium recorded in Aegis for the agent
        assertEq(aegis.reputationOf(agent).premiumsEarned, 1 ether);
    }

    function test_buyPolicy_revertsNoPremium() public {
        vm.prank(alice);
        vm.expectRevert(SentinelUnderwriter.NoPremium.selector);
        sentinel.buyPolicy{value: 0}();
    }

    function test_buyPolicy_revertsInsolvent() public {
        // fresh underwriter with no pool seed
        SentinelUnderwriter s2 = new SentinelUnderwriter(aegis, ASSET, TRIGGER_BPS, MULT_BPS, WINDOW);
        vm.deal(alice, 5 ether);
        vm.prank(alice);
        vm.expectRevert(SentinelUnderwriter.PoolCannotCover.selector);
        s2.buyPolicy{value: 1 ether}(); // pool=1 < coverage 2
    }

    // ---- price window + trigger ----

    function test_recordPrice_onlyOracle() public {
        vm.prank(alice);
        vm.expectRevert(SentinelUnderwriter.NotOracle.selector);
        sentinel.recordPrice(100);
    }

    function test_window_tracksHighAndDrawdown() public {
        _record(100);
        _record(110);
        _record(90);
        assertEq(sentinel.windowHigh(), 110);
        assertEq(sentinel.lastPrice(), 90);
        // dd = (110-90)/110 = 18.18% = 1818 bps
        assertEq(sentinel.currentDrawdownBps(), 1818);
        assertFalse(sentinel.triggered());
    }

    function test_trigger_firesOnDrawdown() public {
        _record(100);
        _record(100);
        _record(100);
        assertFalse(sentinel.triggered());
        _record(65); // window [100,100,65], dd 35% >= 30%
        assertTrue(sentinel.triggered());
    }

    // ---- settlement ----

    function _setupTriggeredWithPolicy() internal returns (uint256 id) {
        vm.deal(alice, 5 ether);
        vm.prank(alice);
        id = sentinel.buyPolicy{value: 1 ether}(); // payout 2 ether
        _record(100);
        _record(100);
