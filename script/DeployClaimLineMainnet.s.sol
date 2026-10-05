// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "forge-std/Script.sol";
import "../src/ClaimLine.sol";

contract DeployClaimLineMainnet is Script {
    address public constant ARC_MAINNET_USDC = 0x3600000000000000000000000000000000000000;

    function run() external returns (ClaimLine claimLine) {
        require(block.chainid == 5042, "DeployClaimLineMainnet: chain ID must be 5042 (Arc Mainnet)");

        vm.startBroadcast();

        claimLine = new ClaimLine(ARC_MAINNET_USDC);

        vm.stopBroadcast();
    }
}
