// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.28;

import {ISequencingRights} from "./interfaces/IRitual.sol";
import {AegisRegistry} from "./AegisRegistry.sol";

/// @title SilentBidPool
/// @notice Agent-native RWA dark pool. Bids are SEALED: a bidder commits
///         keccak256(maxPrice, salt) plus an opaque encrypted blob — the price the agent is
///         willing to pay is never on-chain until reveal, so it cannot be front-run from the
///         mempool. Matching settles against a clearing price posted by an authorized matcher
///         (in production: a scheduled HTTP+JQ price fetch).
///
/// @dev    THE RITUAL-UNIQUE PROPERTY: `sequencingRights()` declares `cancelBid` at a higher
///         priority level than `revealAndFill`. The block builder is bound by this ordering, so
///         a cancel submitted in the same block as an adverse fill executes FIRST. A trader can
///         always pull a bid before being picked off — the Hyperliquid cancel-priority guarantee,
///         enshrined at consensus level. (Single-contract ACE subset; live on Ritual.)
///
///         Roadmap v2: replace commit-reveal with ECIES-to-TEE matching for fully
///         non-interactive darkness (the contract never sees maxPrice at all).
contract SilentBidPool is ISequencingRights {
    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    enum BidStatus {
        None,
        Open,
        Cancelled,
        Filled,
        Expired
    }

    struct Bid {
        address bidder;
        bytes32 assetId;
        bytes32 commitment; // keccak256(abi.encode(maxPrice, salt))
        uint128 quantity; // notional the bidder wants to acquire
        uint64 expiryBlock;
        BidStatus status;
    }

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    address public owner;
    AegisRegistry public immutable aegis;

    mapping(address => bool) public isMatcher; // may post clearing prices
    mapping(bytes32 => uint256) public clearingPrice; // assetId => latest clearing price
    mapping(uint256 => Bid) public bids;
    uint256 public nextBidId = 1;

    uint256 internal constant MAX_BLOB = 10_000; // precompile input ceiling guidance

    // ---------------------------------------------------------------------
    // Events  (note: NO price is ever emitted on submit — that's what keeps it dark)
    // ---------------------------------------------------------------------

    event OwnerTransferred(address indexed previousOwner, address indexed newOwner);
    event MatcherSet(address indexed matcher, bool allowed);
    event ClearingPricePosted(bytes32 indexed assetId, uint256 price);
    event BidSubmitted(uint256 indexed bidId, address indexed bidder, bytes32 indexed assetId, uint128 quantity, uint64 expiryBlock);
    event BidCancelled(uint256 indexed bidId, address indexed bidder);
    event BidFilled(uint256 indexed bidId, address indexed bidder, bytes32 indexed assetId, uint256 maxPrice, uint256 clearingPrice);
    event BidExpired(uint256 indexed bidId);

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error NotOwner();
    error NotMatcher();
    error NotBidder();
