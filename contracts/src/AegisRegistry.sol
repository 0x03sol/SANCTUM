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
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyReporter() {
        if (!isReporter[msg.sender]) revert NotReporter();
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnerTransferred(address(0), msg.sender);
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnerTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Authorize (or revoke) a market contract to report reputation events.
    function setReporter(address reporter, bool allowed) external onlyOwner {
        if (reporter == address(0)) revert ZeroAddress();
        isReporter[reporter] = allowed;
        emit ReporterSet(reporter, allowed);
    }

    // ---------------------------------------------------------------------
    // Registration
    // ---------------------------------------------------------------------

    /// @notice Register the caller as an agent with a role. Self-sovereign onboarding.
    function register(Role role) external {
        _register(msg.sender, role);
    }

    /// @notice Reporter/owner may register an agent on its behalf (e.g. a spawned child harness).
    function registerFor(address agent, Role role) external {
        if (msg.sender != owner && !isReporter[msg.sender]) revert NotReporter();
        _register(agent, role);
    }

    function _register(address agent, Role role) internal {
        if (agent == address(0)) revert ZeroAddress();
        if (role == Role.None) revert InvalidRole();
        if (_agents[agent].registered) revert AlreadyRegistered();
        _agents[agent] = Agent({
            registered: true,
            role: role,
            registeredAt: uint64(block.timestamp),
            fills: 0,
            volume: 0,
            premiumsEarned: 0,
            payoutsMade: 0,
            settlements: 0,
            defaults: 0
        });
        _agentList.push(agent);
        emit AgentRegistered(agent, role);
    }

    // ---------------------------------------------------------------------
    // Reputation reporting (reporters only)
    // ---------------------------------------------------------------------

    function recordFill(address agent, uint128 volume) external onlyReporter {
        Agent storage a = _requireAgent(agent);
        unchecked {
            a.fills += 1;
            a.volume += volume;
        }
        emit FillRecorded(agent, volume);
    }

    function recordPremium(address agent, uint128 amount) external onlyReporter {
        Agent storage a = _requireAgent(agent);
        unchecked {
            a.premiumsEarned += amount;
        }
        emit PremiumRecorded(agent, amount);
    }

    function recordPayout(address agent, uint128 amount) external onlyReporter {
        Agent storage a = _requireAgent(agent);
        unchecked {
            a.payoutsMade += amount;
            a.settlements += 1;
        }
        emit PayoutRecorded(agent, amount);
        emit SettlementRecorded(agent);
    }

    function recordSettlement(address agent) external onlyReporter {
        Agent storage a = _requireAgent(agent);
        unchecked {
            a.settlements += 1;
        }
        emit SettlementRecorded(agent);
    }

    function recordDefault(address agent) external onlyReporter {
        Agent storage a = _requireAgent(agent);
        unchecked {
            a.defaults += 1;
        }
        emit DefaultRecorded(agent);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function reputationOf(address agent) external view returns (Agent memory) {
        return _agents[agent];
    }

    function isRegistered(address agent) external view returns (bool) {
        return _agents[agent].registered;
    }

    function agentCount() external view returns (uint256) {
        return _agentList.length;
    }

    function agentAt(uint256 index) external view returns (address) {
        return _agentList[index];
    }

    /// @notice Deterministic trust score. Starts at SCORE_BASE; rises with honored
    ///         settlements and fills, falls hard with defaults. Floored at 0.
    /// @dev    Simple, transparent, fully on-chain. Off-chain consumers can layer richer models.
    function score(address agent) external view returns (uint256) {
        Agent storage a = _agents[agent];
        if (!a.registered) return 0;
        uint256 s = SCORE_BASE;
        s += uint256(a.settlements) * 50;
        s += uint256(a.fills) * 5;
        uint256 penalty = uint256(a.defaults) * 250;
        if (penalty >= s) return 0;
        return s - penalty;
    }

    function _requireAgent(address agent) internal view returns (Agent storage a) {
        a = _agents[agent];
        if (!a.registered) revert NotRegistered();
    }
}
