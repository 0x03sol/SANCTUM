// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {AegisRegistry} from "../src/AegisRegistry.sol";

contract AegisRegistryTest is Test {
    AegisRegistry internal aegis;

    address internal owner = address(this);
    address internal reporter = address(0xBEEF);
    address internal trader;
    address internal underwriter;
    address internal stranger = address(0xDEAD);

    function setUp() public {
        trader = makeAddr("trader");
        underwriter = makeAddr("underwriter");
        aegis = new AegisRegistry();
        aegis.setReporter(reporter, true);
    }

    // ---- registration ----

    function test_selfRegister() public {
        vm.prank(trader);
        aegis.register(AegisRegistry.Role.Trader);
        assertTrue(aegis.isRegistered(trader));
        assertEq(uint8(aegis.reputationOf(trader).role), uint8(AegisRegistry.Role.Trader));
        assertEq(aegis.agentCount(), 1);
        assertEq(aegis.agentAt(0), trader);
    }

    function test_register_revertsOnNoneRole() public {
        vm.prank(trader);
        vm.expectRevert(AegisRegistry.InvalidRole.selector);
        aegis.register(AegisRegistry.Role.None);
    }

    function test_register_revertsDouble() public {
        vm.startPrank(trader);
        aegis.register(AegisRegistry.Role.Trader);
        vm.expectRevert(AegisRegistry.AlreadyRegistered.selector);
        aegis.register(AegisRegistry.Role.Trader);
        vm.stopPrank();
    }

    function test_registerFor_byReporter() public {
        vm.prank(reporter);
        aegis.registerFor(underwriter, AegisRegistry.Role.Underwriter);
        assertTrue(aegis.isRegistered(underwriter));
    }

    function test_registerFor_revertsForStranger() public {
        vm.prank(stranger);
        vm.expectRevert(AegisRegistry.NotReporter.selector);
        aegis.registerFor(underwriter, AegisRegistry.Role.Underwriter);
    }

    // ---- access control ----

    function test_setReporter_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(AegisRegistry.NotOwner.selector);
        aegis.setReporter(stranger, true);
    }

    function test_record_onlyReporter() public {
        vm.prank(trader);
        aegis.register(AegisRegistry.Role.Trader);
        vm.prank(stranger);
        vm.expectRevert(AegisRegistry.NotReporter.selector);
        aegis.recordFill(trader, 100);
    }

    function test_record_revertsUnregistered() public {
        vm.prank(reporter);
        vm.expectRevert(AegisRegistry.NotRegistered.selector);
        aegis.recordFill(trader, 100);
    }

    // ---- reputation accrual ----

    function test_fillsAndVolumeAccrue() public {
        vm.prank(trader);
        aegis.register(AegisRegistry.Role.Trader);
        vm.startPrank(reporter);
        aegis.recordFill(trader, 100);
        aegis.recordFill(trader, 250);
        vm.stopPrank();
        AegisRegistry.Agent memory a = aegis.reputationOf(trader);
        assertEq(a.fills, 2);
        assertEq(a.volume, 350);
    }

    function test_premiumPayoutSettlement() public {
        vm.prank(underwriter);
        aegis.register(AegisRegistry.Role.Underwriter);
        vm.startPrank(reporter);
        aegis.recordPremium(underwriter, 500);
        aegis.recordPayout(underwriter, 200); // also counts a settlement
        vm.stopPrank();
        AegisRegistry.Agent memory a = aegis.reputationOf(underwriter);
        assertEq(a.premiumsEarned, 500);
        assertEq(a.payoutsMade, 200);
        assertEq(a.settlements, 1);
    }

    // ---- score ----

    function test_score_unregisteredIsZero() public view {
        assertEq(aegis.score(stranger), 0);
    }

    function test_score_baseline() public {
        vm.prank(trader);
        aegis.register(AegisRegistry.Role.Trader);
        assertEq(aegis.score(trader), 1000);
    }

    function test_score_risesWithActivity() public {
        vm.prank(underwriter);
        aegis.register(AegisRegistry.Role.Underwriter);
        vm.startPrank(reporter);
        aegis.recordPayout(underwriter, 1); // +1 settlement => +50
        aegis.recordFill(underwriter, 1); // +1 fill => +5
        vm.stopPrank();
        assertEq(aegis.score(underwriter), 1055);
    }

    function test_score_defaultsPenalize() public {
        vm.prank(underwriter);
        aegis.register(AegisRegistry.Role.Underwriter);
        vm.startPrank(reporter);
        aegis.recordDefault(underwriter); // -250
        vm.stopPrank();
        assertEq(aegis.score(underwriter), 750);
    }

    function test_score_flooredAtZero() public {
        vm.prank(underwriter);
        aegis.register(AegisRegistry.Role.Underwriter);
        vm.startPrank(reporter);
        for (uint256 i = 0; i < 10; i++) {
            aegis.recordDefault(underwriter); // 10 * 250 = 2500 > 1000 base
        }
        vm.stopPrank();
        assertEq(aegis.score(underwriter), 0);
    }

    // ---- ownership ----

    function test_transferOwnership() public {
        aegis.transferOwnership(stranger);
        assertEq(aegis.owner(), stranger);
    }

    function test_transferOwnership_revertsZero() public {
        vm.expectRevert(AegisRegistry.ZeroAddress.selector);
        aegis.transferOwnership(address(0));
    }

    // ---- fuzz ----

    function testFuzz_fillVolumeNeverReverts(uint128 v1, uint128 v2) public {
        // keep within uint128 sum range to avoid intended overflow wrap in test expectations
        vm.assume(uint256(v1) + uint256(v2) <= type(uint128).max);
        vm.prank(trader);
        aegis.register(AegisRegistry.Role.Trader);
        vm.startPrank(reporter);
        aegis.recordFill(trader, v1);
        aegis.recordFill(trader, v2);
        vm.stopPrank();
        assertEq(aegis.reputationOf(trader).volume, uint128(uint256(v1) + uint256(v2)));
    }
}
