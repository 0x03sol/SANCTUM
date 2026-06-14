// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {AegisRegistry} from "../src/AegisRegistry.sol";
import {SilentBidPool} from "../src/SilentBidPool.sol";
import {SentinelUnderwriter} from "../src/SentinelUnderwriter.sol";

/// @notice Deploys Sanctum's three core contracts and wires their permissions.
///         Run simulation first (no --broadcast) to see the real gas cost.
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        // Underwriter config (overridable via env)
