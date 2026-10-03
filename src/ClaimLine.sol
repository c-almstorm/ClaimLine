// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ClaimLine
 * @notice Lien-priority registry on Arc Network with tranche waterfall settlement.
 * @dev Interacts exclusively with Arc native USDC via its 6-decimal ERC-20 interface.
 *      Withdrawals (refunds and repayments) are strictly pull-based.
 *      In v1, ERC-1155 position tokens are non-transferable to guarantee safe accumulator accounting.
 */
contract ClaimLine is ERC1155, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Native USDC ERC-20 interface (6 decimals)
    IERC20 public immutable usdc;

    /// @notice Maximum allowed lock escrows per asset race
    uint256 public constant MAX_LOCKS = 32;

    /// @notice Tranche classification for lien priority
    enum Tranche {
        Senior,
        Junior
    }

    /// @notice Asset lifecycle state
    enum AssetState {
        None,
        Open,
        Closed
    }

    /// @notice Collateral asset registration details
    struct Asset {
        bytes32 assetId;
        address borrower;
        uint256 faceValue;
        uint256 seniorCapacity;
        uint256 juniorCapacity;
        uint256 seniorRepaymentOwed;
        uint256 juniorRepaymentOwed;
        uint256 deadline;
        AssetState state;
        uint256 lockCount;
        uint256 totalSeniorAccepted;
        uint256 totalJuniorAccepted;
        uint256 seniorRepaid;
        uint256 juniorRepaid;
    }

    /// @notice Individual lock escrow record
    struct LockRecord {
        address lender;
        uint256 amount;
        Tranche tranche;
        uint256 sequenceNumber;
    }

    /// @notice Position details per lender per tranche
    struct Position {
        uint256 principalAccepted;
        uint256 repaymentsClaimed;
    }

    /// @notice Mapping from assetId to Asset details
    mapping(bytes32 => Asset) public assets;

    /// @notice Mapping from assetId to array of lock records (up to MAX_LOCKS)
    mapping(bytes32 => LockRecord[]) public assetLocks;

    /// @notice Mapping from assetId => lender => claimable unfilled refund
    mapping(bytes32 => mapping(address => uint256)) public claimableRefunds;

    /// @notice Mapping from assetId => tranche => lender => Position
    mapping(bytes32 => mapping(Tranche => mapping(address => Position))) public positions;

    // --- Custom Errors ---
    error AssetAlreadyExists(bytes32 assetId);
    error AssetNotFound(bytes32 assetId);
    error AssetNotOpen(bytes32 assetId);
    error AssetNotClosed(bytes32 assetId);
    error DeadlinePassed(bytes32 assetId, uint256 deadline, uint256 currentTimestamp);
    error DeadlineNotPassed(bytes32 assetId, uint256 deadline, uint256 currentTimestamp);
    error InvalidCapacities();
    error InvalidRepayments();
    error InvalidDeadline();
    error InvalidAmount();
    error UnauthorizedClose();
    error MaxLocksExceeded(bytes32 assetId);
    error TransfersDisabledInV1();
    error NothingToClaim();

    // --- Events ---
    event AssetRegistered(
        bytes32 indexed assetId,
        address indexed borrower,
        string assetType,
        string docId,
        address custodian,
        address obligor,
        uint256 faceValue,
        uint256 seniorCapacity,
        uint256 juniorCapacity,
        uint256 seniorRepaymentOwed,
        uint256 juniorRepaymentOwed,
        uint256 deadline
    );

    event LockPlaced(
        bytes32 indexed assetId,
        address indexed lender,
        Tranche indexed tranche,
        uint256 amount,
        uint256 sequenceNumber
    );

    event AssetClosed(
        bytes32 indexed assetId,
        uint256 totalSeniorAccepted,
        uint256 totalJuniorAccepted,
        uint256 borrowerProceeds
    );

    event RepaymentMade(
        bytes32 indexed assetId,
        address indexed payer,
        uint256 amount,
        uint256 seniorRepaid,
        uint256 juniorRepaid
    );

    event Claimed(
        bytes32 indexed assetId,
        address indexed account,
        uint256 refundAmount,
        uint256 seniorRepaymentAmount,
        uint256 juniorRepaymentAmount,
        uint256 totalClaimed
    );

    /**
     * @param _usdc Address of USDC ERC-20 contract (0x3600000000000000000000000000000000000000 on Arc)
     */
    constructor(address _usdc) ERC1155("") {
        require(_usdc != address(0), "ClaimLine: zero address USDC");
        usdc = IERC20(_usdc);
    }

    /**
     * @notice Computes deterministic position token ID for ERC-1155 minting
     * @param assetId The identifier of the collateral asset
     * @param tranche Senior or Junior tranche
     */
    function getPositionTokenId(bytes32 assetId, Tranche tranche) public pure returns (uint256) {
        return uint256(keccak256(abi.encode(assetId, tranche)));
    }

    /**
     * @notice Registers a new asset collateral under unique hash identifier
     */
    function registerAsset(
        string calldata assetType,
        string calldata docId,
        address custodian,
        address obligor,
        uint256 faceValue,
        uint256 seniorCapacity,
        uint256 juniorCapacity,
        uint256 seniorRepaymentOwed,
        uint256 juniorRepaymentOwed,
        uint256 deadline
    ) external returns (bytes32 assetId) {
        if (deadline <= block.timestamp) revert InvalidDeadline();
        if (seniorCapacity == 0 && juniorCapacity == 0) revert InvalidCapacities();
        if (seniorRepaymentOwed < seniorCapacity || juniorRepaymentOwed < juniorCapacity) {
            revert InvalidRepayments();
        }

        assetId = keccak256(abi.encode(assetType, docId, custodian, obligor, faceValue));
        if (assets[assetId].state != AssetState.None) revert AssetAlreadyExists(assetId);

        assets[assetId] = Asset({
            assetId: assetId,
            borrower: msg.sender,
            faceValue: faceValue,
            seniorCapacity: seniorCapacity,
            juniorCapacity: juniorCapacity,
            seniorRepaymentOwed: seniorRepaymentOwed,
            juniorRepaymentOwed: juniorRepaymentOwed,
            deadline: deadline,
            state: AssetState.Open,
            lockCount: 0,
            totalSeniorAccepted: 0,
            totalJuniorAccepted: 0,
            seniorRepaid: 0,
            juniorRepaid: 0
        });

        emit AssetRegistered(
            assetId,
            msg.sender,
            assetType,
            docId,
            custodian,
            obligor,
            faceValue,
            seniorCapacity,
            juniorCapacity,
            seniorRepaymentOwed,
            juniorRepaymentOwed,
            deadline
        );
    }

    /**
     * @notice Lenders escrow USDC for a specific tranche in a sequential race
     * @param assetId Target asset ID
     * @param amount 6-decimal USDC amount to escrow
     * @param tranche Senior or Junior tranche preference
     */
    function lock(bytes32 assetId, uint256 amount, Tranche tranche) external nonReentrant {
        Asset storage asset = assets[assetId];
        if (asset.state == AssetState.None) revert AssetNotFound(assetId);
        if (asset.state != AssetState.Open) revert AssetNotOpen(assetId);
        if (block.timestamp > asset.deadline) {
            revert DeadlinePassed(assetId, asset.deadline, block.timestamp);
        }
        if (amount == 0) revert InvalidAmount();
        if (asset.lockCount >= MAX_LOCKS) revert MaxLocksExceeded(assetId);

        uint256 seq = ++asset.lockCount;
        assetLocks[assetId].push(
            LockRecord({
                lender: msg.sender,
                amount: amount,
                tranche: tranche,
                sequenceNumber: seq
            })
        );

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        emit LockPlaced(assetId, msg.sender, tranche, amount, seq);
    }

    /**
     * @notice Closes the race, fills capacities in strict FIFO sequence order, and issues ERC-1155 position tokens
     * @param assetId Target asset ID
     */
    function close(bytes32 assetId) external nonReentrant {
        Asset storage asset = assets[assetId];
        if (asset.state == AssetState.None) revert AssetNotFound(assetId);
        if (asset.state != AssetState.Open) revert AssetNotOpen(assetId);

        if (msg.sender != asset.borrower && block.timestamp <= asset.deadline) {
            revert UnauthorizedClose();
        }

        asset.state = AssetState.Closed;

        uint256 seniorAccepted = 0;
        uint256 juniorAccepted = 0;
        LockRecord[] storage locks = assetLocks[assetId];
        uint256 count = locks.length;

        for (uint256 i = 0; i < count; ++i) {
            LockRecord storage l = locks[i];
            Tranche t = l.tranche;
            uint256 lockAmt = l.amount;
            address lender = l.lender;

            if (t == Tranche.Senior) {
                uint256 remaining = asset.seniorCapacity - seniorAccepted;
                uint256 accepted = lockAmt < remaining ? lockAmt : remaining;
                if (accepted > 0) {
                    seniorAccepted += accepted;
                    positions[assetId][Tranche.Senior][lender].principalAccepted += accepted;
                    _mint(lender, getPositionTokenId(assetId, Tranche.Senior), accepted, "");
                }
                if (lockAmt > accepted) {
                    claimableRefunds[assetId][lender] += (lockAmt - accepted);
                }
            } else {
                uint256 remaining = asset.juniorCapacity - juniorAccepted;
                uint256 accepted = lockAmt < remaining ? lockAmt : remaining;
                if (accepted > 0) {
                    juniorAccepted += accepted;
                    positions[assetId][Tranche.Junior][lender].principalAccepted += accepted;
                    _mint(lender, getPositionTokenId(assetId, Tranche.Junior), accepted, "");
                }
                if (lockAmt > accepted) {
                    claimableRefunds[assetId][lender] += (lockAmt - accepted);
                }
            }
        }

        asset.totalSeniorAccepted = seniorAccepted;
        asset.totalJuniorAccepted = juniorAccepted;

        uint256 borrowerProceeds = seniorAccepted + juniorAccepted;
        if (borrowerProceeds > 0) {
            usdc.safeTransfer(asset.borrower, borrowerProceeds);
        }

        emit AssetClosed(assetId, seniorAccepted, juniorAccepted, borrowerProceeds);
    }

    /**
     * @notice Repays USDC according to strict senior-first waterfall priority
     * @param assetId Target asset ID
     * @param amount USDC amount to repay
     */
    function repay(bytes32 assetId, uint256 amount) external nonReentrant {
        Asset storage asset = assets[assetId];
        if (asset.state != AssetState.Closed) revert AssetNotClosed(assetId);
        if (amount == 0) revert InvalidAmount();

        uint256 seniorNeeded = 0;
        if (asset.totalSeniorAccepted > 0 && asset.seniorRepaid < asset.seniorRepaymentOwed) {
            seniorNeeded = asset.seniorRepaymentOwed - asset.seniorRepaid;
        }

        uint256 seniorPayment = amount < seniorNeeded ? amount : seniorNeeded;
        asset.seniorRepaid += seniorPayment;

        uint256 remaining = amount - seniorPayment;
        uint256 juniorPayment = 0;

        if (remaining > 0) {
            uint256 juniorNeeded = 0;
            if (asset.totalJuniorAccepted > 0 && asset.juniorRepaid < asset.juniorRepaymentOwed) {
                juniorNeeded = asset.juniorRepaymentOwed - asset.juniorRepaid;
            }
            juniorPayment = remaining < juniorNeeded ? remaining : juniorNeeded;
            asset.juniorRepaid += juniorPayment;
        }

        uint256 totalAcceptedRepayment = seniorPayment + juniorPayment;
        if (totalAcceptedRepayment == 0) revert InvalidAmount();

        usdc.safeTransferFrom(msg.sender, address(this), totalAcceptedRepayment);

        emit RepaymentMade(
            assetId,
            msg.sender,
            totalAcceptedRepayment,
            asset.seniorRepaid,
            asset.juniorRepaid
        );
    }

    /**
     * @notice Pull-based claim for unaccepted lock refunds and pro-rata waterfall repayments
     * @param assetId Target asset ID
     */
    function claim(bytes32 assetId) external nonReentrant {
        Asset storage asset = assets[assetId];
        if (asset.state == AssetState.None) revert AssetNotFound(assetId);

        uint256 refund = claimableRefunds[assetId][msg.sender];
        if (refund > 0) {
            claimableRefunds[assetId][msg.sender] = 0;
        }

        uint256 seniorPayout = 0;
        if (asset.totalSeniorAccepted > 0) {
            Position storage posSenior = positions[assetId][Tranche.Senior][msg.sender];
            if (posSenior.principalAccepted > 0) {
                uint256 totalEntitled = (posSenior.principalAccepted * asset.seniorRepaid) /
                    asset.totalSeniorAccepted;
                if (totalEntitled > posSenior.repaymentsClaimed) {
                    seniorPayout = totalEntitled - posSenior.repaymentsClaimed;
                    posSenior.repaymentsClaimed = totalEntitled;
                }
            }
        }

        uint256 juniorPayout = 0;
        if (asset.totalJuniorAccepted > 0) {
            Position storage posJunior = positions[assetId][Tranche.Junior][msg.sender];
            if (posJunior.principalAccepted > 0) {
                uint256 totalEntitled = (posJunior.principalAccepted * asset.juniorRepaid) /
                    asset.totalJuniorAccepted;
                if (totalEntitled > posJunior.repaymentsClaimed) {
                    juniorPayout = totalEntitled - posJunior.repaymentsClaimed;
                    posJunior.repaymentsClaimed = totalEntitled;
                }
            }
        }

        uint256 totalClaim = refund + seniorPayout + juniorPayout;
        if (totalClaim == 0) revert NothingToClaim();

        usdc.safeTransfer(msg.sender, totalClaim);

        emit Claimed(assetId, msg.sender, refund, seniorPayout, juniorPayout, totalClaim);
    }

    /**
     * @notice View function to inspect pending claimable amounts for a given account
     */
    function getPendingClaim(
        bytes32 assetId,
        address account
    ) external view returns (uint256 refund, uint256 seniorPayout, uint256 juniorPayout, uint256 totalClaim) {
        Asset storage asset = assets[assetId];
        refund = claimableRefunds[assetId][account];

        if (asset.totalSeniorAccepted > 0) {
            Position storage posSenior = positions[assetId][Tranche.Senior][account];
            if (posSenior.principalAccepted > 0) {
                uint256 totalEntitled = (posSenior.principalAccepted * asset.seniorRepaid) /
                    asset.totalSeniorAccepted;
                if (totalEntitled > posSenior.repaymentsClaimed) {
                    seniorPayout = totalEntitled - posSenior.repaymentsClaimed;
                }
            }
        }

        if (asset.totalJuniorAccepted > 0) {
            Position storage posJunior = positions[assetId][Tranche.Junior][account];
            if (posJunior.principalAccepted > 0) {
                uint256 totalEntitled = (posJunior.principalAccepted * asset.juniorRepaid) /
                    asset.totalJuniorAccepted;
                if (totalEntitled > posJunior.repaymentsClaimed) {
                    juniorPayout = totalEntitled - posJunior.repaymentsClaimed;
                }
            }
        }

        totalClaim = refund + seniorPayout + juniorPayout;
    }

    /**
     * @notice Fetch total locks placed for an asset
     */
    function getAssetLocks(bytes32 assetId) external view returns (LockRecord[] memory) {
        return assetLocks[assetId];
    }

    /**
     * @notice Fetch repaid amounts for an asset
     */
    function getRepayments(bytes32 assetId) external view returns (uint256 seniorRepaid, uint256 juniorRepaid) {
        return (assets[assetId].seniorRepaid, assets[assetId].juniorRepaid);
    }

    /**
     * @dev Enforces non-transferable position tokens in v1 for safe accumulator accounting.
     */
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal virtual override {
        // Allow minting (from == address(0)) and burning (to == address(0)), but disallow transfers between accounts
        if (from != address(0) && to != address(0)) {
            revert TransfersDisabledInV1();
        }
        super._update(from, to, ids, values);
    }
}
