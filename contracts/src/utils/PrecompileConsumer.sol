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
