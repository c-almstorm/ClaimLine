// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "forge-std/Script.sol";
import "../src/ClaimLine.sol";

contract DeployClaimLine is Script {
    function run() external returns (ClaimLine claimLine) {
        address usdcAddress = vm.envAddress("ARC_USDC");

        vm.startBroadcast();

        claimLine = new ClaimLine(usdcAddress);

        vm.stopBroadcast();
    }
}
