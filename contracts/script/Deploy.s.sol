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
        bytes32 assetId = keccak256("ETH");
        uint16 triggerBps = uint16(vm.envOr("TRIGGER_BPS", uint256(3000))); // 30%
        uint16 multBps = uint16(vm.envOr("PAYOUT_MULT_BPS", uint256(20000))); // 2x
        uint8 windowSize = uint8(vm.envOr("WINDOW_SIZE", uint256(7)));

        vm.startBroadcast(pk);

        // 1. Reputation registry
        AegisRegistry aegis = new AegisRegistry();

        // 2. Dark pool
        SilentBidPool pool = new SilentBidPool(aegis);

        // 3. Underwriter
        SentinelUnderwriter sentinel =
            new SentinelUnderwriter(aegis, assetId, triggerBps, multBps, windowSize);

        // 4. Wiring (least-privilege)
        aegis.setReporter(address(pool), true);
        aegis.setReporter(address(sentinel), true);
        pool.setMatcher(deployer, true); // deployer can post clearing prices for the demo
        sentinel.setOracle(deployer, true); // deployer can push prices for the demo
        sentinel.setAgentIdentity(deployer); // MVP: deployer acts as the underwriter agent id

        vm.stopBroadcast();

        console2.log("AEGIS_REGISTRY=%s", address(aegis));
        console2.log("SILENTBID_POOL=%s", address(pool));
        console2.log("SENTINEL_UNDERWRITER=%s", address(sentinel));
    }
}
