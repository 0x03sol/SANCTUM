// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.28;

/// @notice Ritual system-contract + precompile addresses (verified, testnet 1979).
library RitualAddresses {
    // System contracts
    address internal constant RITUAL_WALLET = 0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948;
    address internal constant ASYNC_JOB_TRACKER = 0xC069FFCa0389f44eCA2C626e55491b0ab045AEF5;
    address internal constant ASYNC_DELIVERY = 0x5A16214fF555848411544b005f7Ac063742f39F6;
    address internal constant TEE_SERVICE_REGISTRY = 0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F;
    address internal constant SCHEDULER = 0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B;
    address internal constant SECRETS_ACCESS_CONTROL = 0xf9BF1BC8A3e79B9EBeD0fa2Db70D0513fecE32FD;
    address internal constant SOVEREIGN_AGENT_FACTORY = 0x9dC4C054e53bCc4Ce0A0Ff09E890A7a8e817f304;
    address internal constant PERSISTENT_AGENT_FACTORY = 0xD4AA9D55215dc8149Af57605e70921Ea16b73591;

    // Precompiles
    address internal constant ONNX = address(0x0800);
    address internal constant HTTP_CALL = address(0x0801);
    address internal constant LLM = address(0x0802);
    address internal constant JQ = address(0x0803);
    address internal constant LONG_HTTP = address(0x0805);
    address internal constant SOVEREIGN_AGENT = address(0x080C);
    address internal constant DKMS = address(0x081B);
    address internal constant PERSISTENT_AGENT = address(0x0820);
    address internal constant SECP256R1 = address(0x0100);

    // TEEServiceRegistry capability ids
    uint8 internal constant CAP_HTTP_CALL = 0;
    uint8 internal constant CAP_LLM = 1;
}

interface IRitualWallet {
    function deposit(uint256 lockDuration) external payable;
    function depositFor(address user, uint256 lockDuration) external payable;
    function withdraw(uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
    function lockUntil(address account) external view returns (uint256);
}

interface IScheduler {
    function schedule(
        bytes memory data,
        uint32 gas,
        uint32 startBlock,
        uint32 numCalls,
        uint32 frequency,
        uint32 ttl,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 value,
        address payer
    ) external returns (uint256 callId);
