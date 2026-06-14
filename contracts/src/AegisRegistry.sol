// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.28;

/// @title AegisRegistry
/// @notice Agent identity + reputation for the Sanctum market. Every sovereign agent
///         (trader, underwriter, reinsurer) is keyed by its on-chain address (typically a
///         DKMS-derived child harness). Authorized market contracts report verifiable events
///         — fills, premiums, payouts, defaults — which accrue into a deterministic on-chain
///         track record. This compounding dataset is the protocol's moat: counterparty trust
///         priced from history, not promises.
/// @dev    Pure EVM, no precompiles. Settlement correctness lives in the reporting contracts;
///         Aegis only records what they attest.
contract AegisRegistry {
    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    enum Role {
        None,
        Trader,
        Underwriter,
        Reinsurer
    }

    struct Agent {
        bool registered;
        Role role;
        uint64 registeredAt; // block timestamp
        uint128 fills; // count of executed trades / filled bids
        uint128 volume; // cumulative notional traded (asset units)
        uint128 premiumsEarned; // cumulative premium collected (underwriters)
        uint128 payoutsMade; // cumulative claims paid (underwriters)
        uint64 settlements; // count of settlements honored
        uint64 defaults; // count of failures to honor an obligation
    }

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    address public owner;
    mapping(address => Agent) private _agents;
    mapping(address => bool) public isReporter; // market contracts allowed to write
    address[] private _agentList;

    uint256 private constant SCORE_BASE = 1000;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event OwnerTransferred(address indexed previousOwner, address indexed newOwner);
    event ReporterSet(address indexed reporter, bool allowed);
    event AgentRegistered(address indexed agent, Role role);
    event FillRecorded(address indexed agent, uint128 volume);
    event PremiumRecorded(address indexed agent, uint128 amount);
    event PayoutRecorded(address indexed agent, uint128 amount);
    event SettlementRecorded(address indexed agent);
    event DefaultRecorded(address indexed agent);

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error NotOwner();
    error NotReporter();
    error NotRegistered();
    error AlreadyRegistered();
    error ZeroAddress();
    error InvalidRole();

    // ---------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------

    modifier onlyOwner() {
