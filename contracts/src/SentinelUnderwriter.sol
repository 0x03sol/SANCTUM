// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.28;

import {PrecompileConsumer} from "./utils/PrecompileConsumer.sol";
import {RitualAddresses} from "./interfaces/IRitual.sol";
import {AegisRegistry} from "./AegisRegistry.sol";

/// @title SentinelUnderwriter
/// @notice Autonomous parametric underwriter. Sells "ETH drawdown" cover: a policyholder pays a
///         premium and is paid `premium * payoutMultiplierBps/10000` if the asset draws down by
///         at least `triggerBps` from its rolling-window high. The underwriter wakes itself via
///         the Scheduler, fetches the price on-chain (HTTP 0x0801 + JQ 0x0803, one async SPC +
///         one sync call in the same tx), updates the rolling window, and auto-settles when the
///         trigger fires — no keeper, no oracle, no human.
///
/// @dev    TWO-TIER design: the *trigger* is pure arithmetic on a fetched price (deterministic,
///         cheap, fast loop). The LLM (0x0802) is used ONLY to write a human-readable settlement
///         report in a SEPARATE transaction — never to make the payout decision. This keeps
///         settlement correctness independent of LLM non-determinism, and respects the
///         one-async-SPC-per-tx rule (HTTP and LLM cannot share a tx).
contract SentinelUnderwriter is PrecompileConsumer {
    // ---------------------------------------------------------------------
    // Config / types
    // ---------------------------------------------------------------------

    struct Policy {
        address holder;
        uint128 premium;
        uint128 payout; // premium * payoutMultiplierBps / 10000
        uint64 boughtAt;
        bool active;
    }

    /// @dev mirrors the LLM precompile's trailing convoHistory tuple (platform, path, keyRef)
    struct ConvoRef {
        string platform;
        string path;
        string keyRef;
    }

    address public owner;
    AegisRegistry public immutable aegis;
    address public agentIdentity; // the underwriter agent whose Aegis reputation accrues

    bytes32 public immutable assetId; // e.g. keccak256("ETH")
    uint16 public triggerBps; // drawdown threshold, e.g. 3000 = 30%
    uint16 public payoutMultiplierBps; // e.g. 20000 = 2x premium
    uint8 public windowSize; // number of samples in the rolling window

    address public scheduler; // Scheduler system contract (configurable for tests)
    mapping(address => bool) public isOracle; // may push prices directly (tests / fallback)

    uint256[] private _window; // rolling price samples
    uint256 public windowHigh; // max over the current window
    uint256 public lastPrice;
    bool public triggered; // set when drawdown >= triggerBps
    bool public settled; // set once payouts have been made

    Policy[] public policies;
    uint256 public poolBalance; // premiums available to back payouts
    uint256 public totalCoverage; // sum of active policy payouts (liability)

    string public lastReport; // latest LLM-written settlement narrative

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event OwnerTransferred(address indexed previousOwner, address indexed newOwner);
    event OracleSet(address indexed oracle, bool allowed);
    event SchedulerSet(address indexed scheduler);
    event AgentIdentitySet(address indexed agent);
    event PolicyBought(uint256 indexed policyId, address indexed holder, uint128 premium, uint128 payout);
    event PriceRecorded(uint256 price, uint256 windowHigh, uint256 drawdownBps);
    event Triggered(uint256 windowHigh, uint256 price, uint256 drawdownBps);
    event PolicySettled(uint256 indexed policyId, address indexed holder, uint128 payout);
    event SettlementComplete(uint256 paidCount, uint256 totalPaid);
    event ReportPosted(string report);

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error NotOwner();
    error NotOracle();
    error NotScheduler();
    error ZeroAddress();
    error BadConfig();
    error NoPremium();
    error PoolCannotCover();
    error NotTriggered();
    error AlreadySettled();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyOracle() {
        if (!isOracle[msg.sender]) revert NotOracle();
        _;
    }

    modifier onlyScheduler() {
        if (msg.sender != scheduler) revert NotScheduler();
        _;
    }

    constructor(
        AegisRegistry _aegis,
        bytes32 _assetId,
        uint16 _triggerBps,
        uint16 _payoutMultiplierBps,
        uint8 _windowSize
    ) {
        if (_triggerBps == 0 || _triggerBps > 10000) revert BadConfig();
        if (_payoutMultiplierBps < 10000) revert BadConfig(); // payout >= premium
        if (_windowSize == 0) revert BadConfig();
        owner = msg.sender;
        aegis = _aegis;
