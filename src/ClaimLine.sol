// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ClaimLine
 * @notice Lien-priority registry on Arc Network.
 * @dev Interacts with Arc native USDC via its ERC-20 interface (6 decimals).
 */
contract ClaimLine is Ownable {
    /// @notice Native USDC ERC-20 interface on Arc (uses 6 decimals)
    IERC20 public immutable usdc;

    /// @notice Version identifier
    string public constant VERSION = "0.1.0";

    /// @notice Struct representing a registered lien record
    struct LienRecord {
        uint256 lienId;
        address borrower;
        address lender;
        uint256 amount; // In 6-decimal USDC units
        uint256 priority;
        uint256 registeredAt;
        bool active;
    }

    /// @notice Total registered liens count
    uint256 public lienCounter;

    /// @notice Mapping from lienId to LienRecord
    mapping(uint256 => LienRecord) public liens;

    /// @notice Events
    event LienRegistered(
        uint256 indexed lienId,
        address indexed borrower,
        address indexed lender,
        uint256 amount,
        uint256 priority,
        uint256 registeredAt
    );
    event LienDischarged(uint256 indexed lienId, uint256 dischargedAt);

    /**
     * @param _usdc Address of USDC ERC-20 interface (0x3600000000000000000000000000000000000000 on Arc)
     */
    constructor(address _usdc) Ownable(msg.sender) {
        require(_usdc != address(0), "ClaimLine: zero address for USDC");
        usdc = IERC20(_usdc);
    }

    /**
     * @notice Register a new lien on the registry
     * @param borrower The address of the borrower / asset holder
     * @param lender The address of the lienholder
     * @param amount The lien amount in 6-decimal USDC units
     * @param priority The priority rank of the lien (1 = senior)
     * @return lienId The unique identifier of the registered lien
     */
    function registerLien(
        address borrower,
        address lender,
        uint256 amount,
        uint256 priority
    ) external returns (uint256 lienId) {
        require(borrower != address(0), "ClaimLine: invalid borrower");
        require(lender != address(0), "ClaimLine: invalid lender");
        require(amount > 0, "ClaimLine: zero amount");

        lienId = ++lienCounter;
        liens[lienId] = LienRecord({
            lienId: lienId,
            borrower: borrower,
            lender: lender,
            amount: amount,
            priority: priority,
            registeredAt: block.timestamp,
            active: true
        });

        emit LienRegistered(lienId, borrower, lender, amount, priority, block.timestamp);
    }

    /**
     * @notice Discharge an active lien
     * @param lienId The identifier of the lien to discharge
     */
    function dischargeLien(uint256 lienId) external {
        LienRecord storage lien = liens[lienId];
        require(lien.active, "ClaimLine: lien not active");
        require(
            msg.sender == lien.lender || msg.sender == owner(),
            "ClaimLine: unauthorized discharge"
        );

        lien.active = false;
        emit LienDischarged(lienId, block.timestamp);
    }

    /**
     * @notice Helper to fetch lien record
     */
    function getLien(uint256 lienId) external view returns (LienRecord memory) {
        return liens[lienId];
    }
}
