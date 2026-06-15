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
        pool.submitBid(ASSET, _commit(1, SALT), "", 1, uint64(block.number));
    }

    function test_submit_revertsBlobTooLarge() public {
        bytes memory big = new bytes(10_001);
        vm.prank(alice);
        vm.expectRevert(SilentBidPool.BlobTooLarge.selector);
        pool.submitBid(ASSET, _commit(1, SALT), big, 1, uint64(block.number + 10));
    }

    // ---- cancel ----

    function test_cancel_onlyBidder() public {
        uint256 id = _submit(alice, 1000, 50, uint64(block.number + 100));
        vm.prank(bob);
        vm.expectRevert(SilentBidPool.NotBidder.selector);
        pool.cancelBid(id);
    }

    function test_cancel_setsCancelled() public {
        uint256 id = _submit(alice, 1000, 50, uint64(block.number + 100));
        vm.prank(alice);
        pool.cancelBid(id);
        assertEq(uint8(pool.getBid(id).status), uint8(SilentBidPool.BidStatus.Cancelled));
    }

    function test_cancelledBid_cannotFill() public {
        uint256 id = _submit(alice, 1000, 50, uint64(block.number + 100));
        vm.prank(alice);
        pool.cancelBid(id);
        vm.prank(matcher);
        pool.postClearingPrice(ASSET, 900);
        vm.expectRevert(SilentBidPool.BidNotOpen.selector);
        pool.revealAndFill(id, 1000, SALT);
    }

    // ---- clearing price + fill ----

    function test_fill_succeedsWhenPriceMet() public {
        uint256 id = _submit(alice, 1000, 50, uint64(block.number + 100));
        vm.prank(matcher);
        pool.postClearingPrice(ASSET, 900); // 1000 >= 900 => fills
        pool.revealAndFill(id, 1000, SALT);
        assertEq(uint8(pool.getBid(id).status), uint8(SilentBidPool.BidStatus.Filled));
        // fill recorded in Aegis
        assertEq(aegis.reputationOf(alice).fills, 1);
        assertEq(aegis.reputationOf(alice).volume, 50);
    }

    function test_fill_revertsWhenPriceNotMet() public {
        uint256 id = _submit(alice, 800, 50, uint64(block.number + 100));
        vm.prank(matcher);
        pool.postClearingPrice(ASSET, 900); // 800 < 900 => no fill
        vm.expectRevert(SilentBidPool.PriceNotMet.selector);
        pool.revealAndFill(id, 800, SALT);
    }

    function test_fill_revertsNoClearingPrice() public {
