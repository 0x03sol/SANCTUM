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

