// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/ClaimLine.sol";

contract DeployClaimLine is Script {
    address public constant ARC_USDC = 0x3600000000000000000000000000000000000000;

    function run() external returns (ClaimLine claimLine) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        claimLine = new ClaimLine(ARC_USDC);

        vm.stopBroadcast();
    }
}
