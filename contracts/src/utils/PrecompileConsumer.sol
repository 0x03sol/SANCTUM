// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.28;

import {RitualAddresses} from "../interfaces/IRitual.sol";

/// @title PrecompileConsumer
/// @notice Shared base for Ritual precompile consumers: short-running SPC decoding,
///         two-phase callback authentication, and idempotency. Patterns verified against
///         ritual-dapp-contracts skill.
abstract contract PrecompileConsumer {
    address internal constant ASYNC_DELIVERY = RitualAddresses.ASYNC_DELIVERY;

    error OnlyAsyncDelivery();
    error PrecompileCallFailed();
    error AlreadyFulfilled();

    /// @dev set true once a given two-phase jobId has been processed (idempotency)
    mapping(bytes32 => bool) public fulfilled;

    /// @dev Callbacks delivered by AsyncDelivery must verify the caller.
    modifier onlyAsyncDelivery() {
        if (msg.sender != ASYNC_DELIVERY) revert OnlyAsyncDelivery();
        _;
    }

    /// @dev Marks a jobId fulfilled exactly once. Call at the top of every callback.
    function _consume(bytes32 jobId) internal {
        if (fulfilled[jobId]) revert AlreadyFulfilled();
        fulfilled[jobId] = true;
    }

    /// @notice Call a short-running async precompile (HTTP 0x0801 / LLM 0x0802) and unwrap
    ///         the two-layer SPC envelope, returning the inner precompile-specific output.
    /// @dev The result is available in the SAME transaction (fulfilled replay).
    function _executeSPC(address precompile, bytes memory input)
        internal
        returns (bytes memory actualOutput)
    {
        (bool ok, bytes memory raw) = precompile.call(input);
        if (!ok) revert PrecompileCallFailed();
        // Envelope: (bytes simmedInput, bytes actualOutput)
        (, actualOutput) = abi.decode(raw, (bytes, bytes));
