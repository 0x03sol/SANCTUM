// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {SilentBidPool} from "../src/SilentBidPool.sol";
import {AegisRegistry} from "../src/AegisRegistry.sol";

contract SilentBidPoolTest is Test {
    SilentBidPool internal pool;
    AegisRegistry internal aegis;

    address internal matcher;
    address internal alice;
    address internal bob;

    bytes32 internal constant ASSET = keccak256("RWA:REIT-001");
    bytes32 internal constant SALT = keccak256("salt-1");

    function setUp() public {
        matcher = makeAddr("matcher");
        alice = makeAddr("alice");
        bob = makeAddr("bob");

        aegis = new AegisRegistry();
        pool = new SilentBidPool(aegis);

        // Pool must be an authorized Aegis reporter to auto-register traders + record fills.
        aegis.setReporter(address(pool), true);
        // Authorize a matcher to post clearing prices.
        pool.setMatcher(matcher, true);
    }

    function _commit(uint256 maxPrice, bytes32 salt) internal pure returns (bytes32) {
        return keccak256(abi.encode(maxPrice, salt));
    }

    function _submit(address who, uint256 maxPrice, uint128 qty, uint64 expiry)
        internal
        returns (uint256 bidId)
    {
        vm.prank(who);
        bidId = pool.submitBid(ASSET, _commit(maxPrice, SALT), hex"deadbeef", qty, expiry);
    }

    // ---- submission ----

    function test_submit_storesSealedBid_andAutoRegisters() public {
        uint256 id = _submit(alice, 1000, 50, uint64(block.number + 100));
        SilentBidPool.Bid memory b = pool.getBid(id);
        assertEq(b.bidder, alice);
        assertEq(b.assetId, ASSET);
        assertEq(uint8(b.status), uint8(SilentBidPool.BidStatus.Open));
        // auto-onboarded into Aegis as Trader
        assertTrue(aegis.isRegistered(alice));
    }

    function test_submit_revertsBadExpiry() public {
        vm.prank(alice);
        vm.expectRevert(SilentBidPool.BadExpiry.selector);
