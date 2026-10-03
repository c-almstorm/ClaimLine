// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../src/ClaimLine.sol";

contract MockUSDC is IERC20 {
    string public name = "USD Coin";
    string public symbol = "USDC";
    uint8 public decimals = 6;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) public isBlocklisted;

    function setBlocklisted(address account, bool value) external {
        isBlocklisted[account] = value;
    }

    function transfer(address to, uint256 amount) external virtual returns (bool) {
        require(!isBlocklisted[msg.sender], "USDC: sender blocklisted");
        require(!isBlocklisted[to], "USDC: recipient blocklisted");
        require(balanceOf[msg.sender] >= amount, "ERC20: transfer amount exceeds balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external virtual returns (bool) {
        require(!isBlocklisted[from], "USDC: sender blocklisted");
        require(!isBlocklisted[to], "USDC: recipient blocklisted");
        require(balanceOf[from] >= amount, "ERC20: transfer amount exceeds balance");
        if (allowance[from][msg.sender] != type(uint256).max) {
            require(allowance[from][msg.sender] >= amount, "ERC20: insufficient allowance");
            allowance[from][msg.sender] -= amount;
        }
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }
}

/**
 * @notice Malicious ERC-20 that attempts reentrancy during transfer
 */
contract ReentrantMockUSDC is MockUSDC {
    ClaimLine public targetClaimLine;
    bytes32 public targetAssetId;
    bool public reentrancyEnabled;

    function setTarget(address _claimLine, bytes32 _assetId) external {
        targetClaimLine = ClaimLine(_claimLine);
        targetAssetId = _assetId;
    }

    function setReentrancy(bool enabled) external {
        reentrancyEnabled = enabled;
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        require(!isBlocklisted[msg.sender], "USDC: sender blocklisted");
        require(!isBlocklisted[to], "USDC: recipient blocklisted");
        require(balanceOf[msg.sender] >= amount, "ERC20: transfer amount exceeds balance");

        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);

        if (reentrancyEnabled && msg.sender == address(targetClaimLine)) {
            // Attempt to re-enter claim() while inside transfer
            targetClaimLine.claim(targetAssetId);
        }
        return true;
    }
}

/**
 * @notice Contract lender that strictly does NOT implement ERC-1155 receiver hooks
 */
contract NonReceiverLender {
    ClaimLine public immutable claimLine;
    MockUSDC public immutable usdc;

    constructor(address _claimLine, address _usdc) {
        claimLine = ClaimLine(_claimLine);
        usdc = MockUSDC(_usdc);
    }

    function lock(bytes32 assetId, uint256 amount, ClaimLine.Tranche tranche) external {
        usdc.approve(address(claimLine), amount);
        claimLine.lock(assetId, amount, tranche);
    }

    function claim(bytes32 assetId) external {
        claimLine.claim(assetId);
    }

    // Explicit fallback reverts if any unhandled selector (like onERC1155Received) is called
    fallback() external {
        revert("NonReceiver: hook rejected");
    }
}

contract ClaimLineTest is Test {
    ClaimLine public claimLine;
    MockUSDC public usdc;

    address public obligor = address(0xB0B); // obligor == borrower
    address public lender1 = address(0x111);
    address public lender2 = address(0x222);
    address public lender3 = address(0x333);
    address public custodian = address(0xCCC);
    address public attacker = address(0xBAD);

    bytes32 public testAssetId;
    uint256 public constant FACE_VALUE = 100_000 * 1e6;
    uint256 public constant SENIOR_CAP = 60_000 * 1e6;
    uint256 public constant JUNIOR_CAP = 30_000 * 1e6;
    uint256 public constant SENIOR_REPAY = 66_000 * 1e6;
    uint256 public constant JUNIOR_REPAY = 36_000 * 1e6;
    uint256 public deadline;
    uint256 public expectedMinLock;

    function setUp() public {
        usdc = new MockUSDC();
        claimLine = new ClaimLine(address(usdc));

        deadline = block.timestamp + 7 days;
        expectedMinLock = (SENIOR_CAP + JUNIOR_CAP + 31) / 32; // (90,000 * 1e6 + 31) / 32 = 2,812,500,000 (2812.5 USDC)

        usdc.mint(lender1, 1_000_000 * 1e6);
        usdc.mint(lender2, 1_000_000 * 1e6);
        usdc.mint(lender3, 1_000_000 * 1e6);
        usdc.mint(obligor, 1_000_000 * 1e6);

        vm.prank(lender1);
        usdc.approve(address(claimLine), type(uint256).max);
        vm.prank(lender2);
        usdc.approve(address(claimLine), type(uint256).max);
        vm.prank(lender3);
        usdc.approve(address(claimLine), type(uint256).max);
        vm.prank(obligor);
        usdc.approve(address(claimLine), type(uint256).max);

        vm.prank(obligor);
        testAssetId = claimLine.registerAsset(
            "Invoice",
            "INV-2026-001",
            custodian,
            obligor,
            FACE_VALUE,
            SENIOR_CAP,
            JUNIOR_CAP,
            SENIOR_REPAY,
            JUNIOR_REPAY,
            deadline
        );
    }

    // ==========================================
    // 1. SPECIFIC FIX & REGISTRATION TESTS
    // ==========================================

    function test_Fix_SquattingAttempt_Revert() public {
        // Attempt by attacker (non-obligor) to register asset for obligor
        vm.prank(attacker);
        vm.expectRevert(ClaimLine.UnauthorizedRegistrar.selector);
        claimLine.registerAsset(
            "Invoice",
            "INV-SQUAT",
            custodian,
            obligor,
            FACE_VALUE,
            SENIOR_CAP,
            JUNIOR_CAP,
            SENIOR_REPAY,
            JUNIOR_REPAY,
            deadline
        );
    }

    function test_Fix_OverCapacityRegistration_Revert() public {
        // seniorCapacity (70k) + juniorCapacity (40k) = 110k > faceValue (100k)
        vm.prank(obligor);
        vm.expectRevert(ClaimLine.InvalidCapacities.selector);
        claimLine.registerAsset(
            "Invoice",
            "INV-OVERCAP",
            custodian,
            obligor,
            100_000 * 1e6, // Face value
            70_000 * 1e6,  // Senior
            40_000 * 1e6,  // Junior
            77_000 * 1e6,
            48_000 * 1e6,
            deadline
        );
    }

    function test_Fix_NonReceiverLender_DirectUpdateMint() public {
        NonReceiverLender nonReceiver = new NonReceiverLender(address(claimLine), address(usdc));
        usdc.mint(address(nonReceiver), 50_000 * 1e6);

        // NonReceiver locks capital (amount >= minLock)
        nonReceiver.lock(testAssetId, 50_000 * 1e6, ClaimLine.Tranche.Senior);

        // Close race - mints position token without calling onERC1155Received
        vm.prank(obligor);
        claimLine.close(testAssetId);

        uint256 tokenId = claimLine.getPositionTokenId(testAssetId, ClaimLine.Tranche.Senior);
        assertEq(claimLine.balanceOf(address(nonReceiver), tokenId), 50_000 * 1e6);
    }

    function test_Fix_BlocklistedBorrower_PullBasedProceeds() public {
        vm.prank(lender1);
        claimLine.lock(testAssetId, SENIOR_CAP, ClaimLine.Tranche.Senior);

        // Borrower is blocklisted on USDC protocol level before close()
        usdc.setBlocklisted(obligor, true);

        // close() must still SUCCEED because proceeds are pull-based and not pushed directly to borrower
        vm.warp(deadline + 1);
        vm.prank(lender2);
        claimLine.close(testAssetId);

        // Borrower's proceeds are safely credited in storage
        assertEq(claimLine.claimableProceeds(testAssetId, obligor), SENIOR_CAP);
    }

    function test_Fix_PartiallyFilledTranche_ScaledRepaymentOwed() public {
        // Senior capacity: 60k, repayment owed: 66k (1.1x). Only 30k locked (50% fill)
        // Junior capacity: 30k, repayment owed: 36k (1.2x). Only 15k locked (50% fill)
        vm.prank(lender1);
        claimLine.lock(testAssetId, 30_000 * 1e6, ClaimLine.Tranche.Senior);
        vm.prank(lender2);
        claimLine.lock(testAssetId, 15_000 * 1e6, ClaimLine.Tranche.Junior);

        vm.prank(obligor);
        claimLine.close(testAssetId);

        ClaimLine.Asset memory a = claimLine.assets(testAssetId);

        // Senior scaled repayment owed: 66k * 30k / 60k = 33k
        assertEq(a.seniorRepaymentOwed, 33_000 * 1e6);
        // Junior scaled repayment owed: 36k * 15k / 30k = 18k
        assertEq(a.juniorRepaymentOwed, 18_000 * 1e6);

        // Repay 40k: 33k satisfies Senior in full; 7k flows to Junior
        vm.prank(obligor);
        claimLine.repay(testAssetId, 40_000 * 1e6);

        (uint256 sRepaid, uint256 jRepaid) = claimLine.getRepayments(testAssetId);
        assertEq(sRepaid, 33_000 * 1e6);
        assertEq(jRepaid, 7_000 * 1e6);
    }

    // ==========================================
    // 2. UNIT & FLOW TESTS
    // ==========================================

    function test_RegisterAsset_Success() public view {
        ClaimLine.Asset memory a = claimLine.assets(testAssetId);

        assertEq(a.assetId, testAssetId);
        assertEq(a.borrower, obligor);
        assertEq(a.faceValue, FACE_VALUE);
        assertEq(a.seniorCapacity, SENIOR_CAP);
        assertEq(a.juniorCapacity, JUNIOR_CAP);
        assertEq(a.seniorRepaymentOwed, SENIOR_REPAY);
        assertEq(a.juniorRepaymentOwed, JUNIOR_REPAY);
        assertEq(a.minLock, expectedMinLock);
        assertEq(a.deadline, deadline);
        assertEq(uint256(a.state), uint256(ClaimLine.AssetState.Open));
        assertEq(a.lockCount, 0);
        assertEq(a.totalSeniorAccepted, 0);
        assertEq(a.totalJuniorAccepted, 0);
        assertEq(a.seniorRepaid, 0);
        assertEq(a.juniorRepaid, 0);
    }

    function test_RegisterAsset_Revert_Duplicate() public {
        vm.prank(obligor);
        vm.expectRevert(abi.encodeWithSelector(ClaimLine.AssetAlreadyExists.selector, testAssetId));
        claimLine.registerAsset(
            "Invoice",
            "INV-2026-001",
            custodian,
            obligor,
            FACE_VALUE,
            SENIOR_CAP,
            JUNIOR_CAP,
            SENIOR_REPAY,
            JUNIOR_REPAY,
            deadline
        );
    }

    function test_RegisterAsset_Revert_InvalidDeadline() public {
        vm.prank(obligor);
        vm.expectRevert(ClaimLine.InvalidDeadline.selector);
        claimLine.registerAsset(
            "Invoice",
            "INV-NEW",
            custodian,
            obligor,
            FACE_VALUE,
            SENIOR_CAP,
            JUNIOR_CAP,
            SENIOR_REPAY,
            JUNIOR_REPAY,
            block.timestamp
        );
    }

    function test_RegisterAsset_Revert_InvalidRepayments() public {
        vm.prank(obligor);
        vm.expectRevert(ClaimLine.InvalidRepayments.selector);
        claimLine.registerAsset(
            "Invoice",
            "INV-NEW3",
            custodian,
            obligor,
            FACE_VALUE,
            SENIOR_CAP,
            JUNIOR_CAP,
            SENIOR_CAP - 1,
            JUNIOR_REPAY,
            deadline
        );
    }

    function test_Lock_Success_SequenceIncrement() public {
        vm.prank(lender1);
        claimLine.lock(testAssetId, 40_000 * 1e6, ClaimLine.Tranche.Senior);

        vm.prank(lender2);
        claimLine.lock(testAssetId, 30_000 * 1e6, ClaimLine.Tranche.Senior);

        vm.prank(lender3);
        claimLine.lock(testAssetId, 30_000 * 1e6, ClaimLine.Tranche.Junior);

        ClaimLine.LockRecord[] memory locks = claimLine.getAssetLocks(testAssetId);
        assertEq(locks.length, 3);
        assertEq(locks[0].sequenceNumber, 1);
        assertEq(locks[1].sequenceNumber, 2);
        assertEq(locks[2].sequenceNumber, 3);
    }

    function test_Lock_Revert_AmountBelowMinLock() public {
        // minLock is 2,812.50 USDC (2812500000)
        uint256 subMinAmount = 2_000 * 1e6;
        vm.prank(lender1);
        vm.expectRevert(
            abi.encodeWithSelector(ClaimLine.AmountBelowMinLock.selector, testAssetId, subMinAmount, expectedMinLock)
        );
        claimLine.lock(testAssetId, subMinAmount, ClaimLine.Tranche.Senior);
    }

    function test_Lock_Revert_MaxLocksExceeded() public {
        uint256 validLockAmt = 3_000 * 1e6; // >= expectedMinLock
        for (uint256 i = 0; i < 32; i++) {
            vm.prank(lender1);
            claimLine.lock(testAssetId, validLockAmt, ClaimLine.Tranche.Senior);
        }

        vm.prank(lender1);
        vm.expectRevert(abi.encodeWithSelector(ClaimLine.MaxLocksExceeded.selector, testAssetId));
        claimLine.lock(testAssetId, validLockAmt, ClaimLine.Tranche.Senior);
    }

    function test_Lock_Revert_DeadlinePassed() public {
        vm.warp(deadline + 1);
        vm.prank(lender1);
        vm.expectRevert(
            abi.encodeWithSelector(ClaimLine.DeadlinePassed.selector, testAssetId, deadline, deadline + 1)
        );
        claimLine.lock(testAssetId, 3_000 * 1e6, ClaimLine.Tranche.Senior);
    }

    function test_Close_BorrowerCanCloseBeforeDeadline() public {
        vm.prank(lender1);
        claimLine.lock(testAssetId, 40_000 * 1e6, ClaimLine.Tranche.Senior);
        vm.prank(lender2);
        claimLine.lock(testAssetId, 40_000 * 1e6, ClaimLine.Tranche.Senior);

        vm.prank(obligor);
        claimLine.close(testAssetId);

        // Senior cap is 60k. Lender1 gets 40k accepted. Lender2 gets 20k accepted + 20k refund.
        assertEq(claimLine.claimableProceeds(testAssetId, obligor), 60_000 * 1e6);
        assertEq(claimLine.claimableRefunds(testAssetId, lender2), 20_000 * 1e6);

        // Obligor claims proceeds
        uint256 bPre = usdc.balanceOf(obligor);
        vm.prank(obligor);
        claimLine.claim(testAssetId);
        assertEq(usdc.balanceOf(obligor) - bPre, 60_000 * 1e6);
    }

    function test_Close_AnyoneCanCloseAfterDeadline() public {
        vm.prank(lender1);
        claimLine.lock(testAssetId, 30_000 * 1e6, ClaimLine.Tranche.Junior);

        vm.warp(deadline + 10);
        vm.prank(lender3);
        claimLine.close(testAssetId);

        ClaimLine.Asset memory a = claimLine.assets(testAssetId);
        assertEq(uint256(a.state), uint256(ClaimLine.AssetState.Closed));
    }

    function test_Close_Revert_NonBorrowerBeforeDeadline() public {
        vm.prank(lender1);
        claimLine.lock(testAssetId, 10_000 * 1e6, ClaimLine.Tranche.Senior);

        vm.prank(lender2);
        vm.expectRevert(ClaimLine.UnauthorizedClose.selector);
        claimLine.close(testAssetId);
    }

    function test_Close_Revert_ClosingTwice() public {
        vm.prank(obligor);
        claimLine.close(testAssetId);

        vm.prank(obligor);
        vm.expectRevert(abi.encodeWithSelector(ClaimLine.AssetNotOpen.selector, testAssetId));
        claimLine.close(testAssetId);
    }

    function test_Close_32Locks_GasBenchmark() public {
        // Set up fresh asset for 32 distinct locks
        uint256 faceVal = 64_000 * 1e6;
        uint256 sCap = 32_000 * 1e6;
        uint256 jCap = 32_000 * 1e6;
        uint256 sRep = 35_200 * 1e6;
        uint256 jRep = 38_400 * 1e6;

        vm.prank(obligor);
        bytes32 asset32 = claimLine.registerAsset(
            "Equipment",
            "EQ-32-LOCKS",
            custodian,
            obligor,
            faceVal,
            sCap,
            jCap,
            sRep,
            jRep,
            deadline
        );

        uint256 singleLock = 2_000 * 1e6; // 64,000 / 32 = 2,000 USDC >= minLock

        for (uint256 i = 0; i < 32; i++) {
            address l = address(uint160(0x5000 + i));
            usdc.mint(l, singleLock);
            vm.prank(l);
            usdc.approve(address(claimLine), type(uint256).max);

            ClaimLine.Tranche t = (i < 16) ? ClaimLine.Tranche.Senior : ClaimLine.Tranche.Junior;
            vm.prank(l);
            claimLine.lock(asset32, singleLock, t);
        }

        // Measure gas of close() with 32 full locks
        uint256 gasStart = gasleft();
        vm.prank(obligor);
        claimLine.close(asset32);
        uint256 gasUsed = gasStart - gasleft();

        emit log_named_uint("Gas used for close() with 32 locks", gasUsed);

        ClaimLine.Asset memory a = claimLine.assets(asset32);
        assertEq(uint256(a.state), uint256(ClaimLine.AssetState.Closed));
        assertEq(a.lockCount, 32);
        assertEq(a.totalSeniorAccepted, sCap);
        assertEq(a.totalJuniorAccepted, jCap);
    }

    function test_Repayment_Waterfall_SeniorFirst() public {
        vm.prank(lender1);
        claimLine.lock(testAssetId, 60_000 * 1e6, ClaimLine.Tranche.Senior);
        vm.prank(lender2);
        claimLine.lock(testAssetId, 30_000 * 1e6, ClaimLine.Tranche.Junior);

        vm.prank(obligor);
        claimLine.close(testAssetId);

        vm.prank(obligor);
        claimLine.repay(testAssetId, 50_000 * 1e6);

        (uint256 sRepaid, uint256 jRepaid) = claimLine.getRepayments(testAssetId);
        assertEq(sRepaid, 50_000 * 1e6);
        assertEq(jRepaid, 0);

        vm.prank(obligor);
        claimLine.repay(testAssetId, 26_000 * 1e6);

        (sRepaid, jRepaid) = claimLine.getRepayments(testAssetId);
        assertEq(sRepaid, 66_000 * 1e6);
        assertEq(jRepaid, 10_000 * 1e6);
    }

    function test_Claim_PullBased_RefundAndRepayment() public {
        vm.prank(lender1);
        claimLine.lock(testAssetId, 40_000 * 1e6, ClaimLine.Tranche.Senior);
        vm.prank(lender2);
        claimLine.lock(testAssetId, 40_000 * 1e6, ClaimLine.Tranche.Senior);

        vm.prank(obligor);
        claimLine.close(testAssetId);

        vm.prank(obligor);
        claimLine.repay(testAssetId, 33_000 * 1e6);

        uint256 lender2Pre = usdc.balanceOf(lender2);
        vm.prank(lender2);
        claimLine.claim(testAssetId);
        uint256 lender2Post = usdc.balanceOf(lender2);

        // Refund 20k + 20k/60k * 33k (11k) = 31k
        assertEq(lender2Post - lender2Pre, 31_000 * 1e6);
    }

    function test_Claim_CannotBeClaimedTwice() public {
        vm.prank(lender1);
        claimLine.lock(testAssetId, 40_000 * 1e6, ClaimLine.Tranche.Senior);
        vm.prank(lender2);
        claimLine.lock(testAssetId, 40_000 * 1e6, ClaimLine.Tranche.Senior);

        vm.prank(obligor);
        claimLine.close(testAssetId);

        vm.prank(obligor);
        claimLine.repay(testAssetId, 33_000 * 1e6);

        // First claim succeeds
        vm.prank(lender2);
        claimLine.claim(testAssetId);

        // Second claim reverts with NothingToClaim
        vm.prank(lender2);
        vm.expectRevert(ClaimLine.NothingToClaim.selector);
        claimLine.claim(testAssetId);
    }

    function test_Dust_AllParticipantsClaim() public {
        // Register asset with odd non-round numbers to test dust remainders
        uint256 faceVal = 100_000 * 1e6;
        uint256 sCap = 50_000 * 1e6;
        uint256 jCap = 30_000 * 1e6;
        uint256 sRep = 55_000 * 1e6;
        uint256 jRep = 36_000 * 1e6;

        vm.prank(obligor);
        bytes32 dustAsset = claimLine.registerAsset(
            "Invoice",
            "INV-DUST",
            custodian,
            obligor,
            faceVal,
            sCap,
            jCap,
            sRep,
            jRep,
            deadline
        );

        address l1 = address(0x701);
        address l2 = address(0x702);
        address l3 = address(0x703);
        address l4 = address(0x704);

        // Locks: l1 (33,333.333333 USDC Senior), l2 (25,000 USDC Senior - partial overflow), l3 (17,777.777777 USDC Junior), l4 (20,000 USDC Junior)
        uint256 lock1 = 33_333_333333;
        uint256 lock2 = 25_000_000000;
        uint256 lock3 = 17_777_777777;
        uint256 lock4 = 20_000_000000;

        usdc.mint(l1, lock1);
        usdc.mint(l2, lock2);
        usdc.mint(l3, lock3);
        usdc.mint(l4, lock4);

        vm.prank(l1);
        usdc.approve(address(claimLine), type(uint256).max);
        vm.prank(l2);
        usdc.approve(address(claimLine), type(uint256).max);
        vm.prank(l3);
        usdc.approve(address(claimLine), type(uint256).max);
        vm.prank(l4);
        usdc.approve(address(claimLine), type(uint256).max);

        vm.prank(l1);
        claimLine.lock(dustAsset, lock1, ClaimLine.Tranche.Senior);
        vm.prank(l2);
        claimLine.lock(dustAsset, lock2, ClaimLine.Tranche.Senior);
        vm.prank(l3);
        claimLine.lock(dustAsset, lock3, ClaimLine.Tranche.Junior);
        vm.prank(l4);
        claimLine.lock(dustAsset, lock4, ClaimLine.Tranche.Junior);

        // Close race
        vm.prank(obligor);
        claimLine.close(dustAsset);

        // Repay partial debt: 67,891.123456 USDC
        uint256 repayAmt = 67_891_123456;
        usdc.mint(obligor, repayAmt);
        vm.prank(obligor);
        claimLine.repay(dustAsset, repayAmt);

        uint256 totalPaidIn = lock1 + lock2 + lock3 + lock4 + repayAmt;

        // Everyone claims
        uint256 bPre = usdc.balanceOf(obligor);
        vm.prank(obligor);
        claimLine.claim(dustAsset);
        uint256 bPaid = usdc.balanceOf(obligor) - bPre;

        uint256 l1Pre = usdc.balanceOf(l1);
        vm.prank(l1);
        claimLine.claim(dustAsset);
        uint256 l1Paid = usdc.balanceOf(l1) - l1Pre;

        uint256 l2Pre = usdc.balanceOf(l2);
        vm.prank(l2);
        claimLine.claim(dustAsset);
        uint256 l2Paid = usdc.balanceOf(l2) - l2Pre;

        uint256 l3Pre = usdc.balanceOf(l3);
        vm.prank(l3);
        claimLine.claim(dustAsset);
        uint256 l3Paid = usdc.balanceOf(l3) - l3Pre;

        uint256 l4Pre = usdc.balanceOf(l4);
        vm.prank(l4);
        claimLine.claim(dustAsset);
        uint256 l4Paid = usdc.balanceOf(l4) - l4Pre;

        uint256 totalPaidOut = bPaid + l1Paid + l2Paid + l3Paid + l4Paid;
        uint256 contractLeftoverDust = usdc.balanceOf(address(claimLine));

        // 1. Total paid out must not exceed total paid in
        assertTrue(totalPaidOut <= totalPaidIn, "Overpayment occurred!");
        // 2. Exact conservation of funds: totalPaidIn - totalPaidOut == contract dust
        assertEq(totalPaidIn - totalPaidOut, contractLeftoverDust);
        // 3. Leftover dust is bounded under 10 wei units (micro-USDC)
        assertTrue(contractLeftoverDust < 10, "Dust exceeds 10 wei units!");
    }

    function test_ERC1155_NonTransferable_InV1() public {
        vm.prank(lender1);
        claimLine.lock(testAssetId, 10_000 * 1e6, ClaimLine.Tranche.Senior);
        vm.prank(obligor);
        claimLine.close(testAssetId);

        uint256 tokenId = claimLine.getPositionTokenId(testAssetId, ClaimLine.Tranche.Senior);

        vm.prank(lender1);
        vm.expectRevert(ClaimLine.TransfersDisabledInV1.selector);
        claimLine.safeTransferFrom(lender1, lender2, tokenId, 10_000 * 1e6, "");
    }

    // ==========================================
    // 3. INVARIANT FUZZ TESTS
    // ==========================================

    function testFuzz_Invariant_ContractBalanceAlwaysGEWhatItOwes(
        uint32 lockAmt1,
        uint32 lockAmt2,
        uint32 lockAmt3,
        uint128 repayMicroUSDC
    ) public {
        // Enforce lock amounts >= minLock and within reasonable test bounds
        vm.assume(lockAmt1 >= 3_000 && lockAmt1 < 50_000_000);
        vm.assume(lockAmt2 >= 3_000 && lockAmt2 < 50_000_000);
        vm.assume(lockAmt3 >= 3_000 && lockAmt3 < 50_000_000);

        uint256 l1 = uint256(lockAmt1) * 1e6;
        uint256 l2 = uint256(lockAmt2) * 1e6;
        uint256 l3 = uint256(lockAmt3) * 1e6;

        usdc.mint(lender1, l1);
        usdc.mint(lender2, l2);
        usdc.mint(lender3, l3);

        vm.prank(lender1);
        claimLine.lock(testAssetId, l1, ClaimLine.Tranche.Senior);
        vm.prank(lender2);
        claimLine.lock(testAssetId, l2, ClaimLine.Tranche.Senior);
        vm.prank(lender3);
        claimLine.lock(testAssetId, l3, ClaimLine.Tranche.Junior);

        vm.prank(obligor);
        claimLine.close(testAssetId);

        ClaimLine.Asset memory a = claimLine.assets(testAssetId);
        uint256 maxRepayOwed = a.seniorRepaymentOwed + a.juniorRepaymentOwed;

        // Bound repay amount to [0, seniorRepaymentOwed + juniorRepaymentOwed] in micro-USDC
        uint256 rAmt = maxRepayOwed == 0 ? 0 : uint256(repayMicroUSDC) % (maxRepayOwed + 1);

        if (rAmt > 0) {
            usdc.mint(obligor, rAmt);
            vm.prank(obligor);
            claimLine.repay(testAssetId, rAmt);
        }

        // Calculate total pending liabilities across all participants
        (,,,, uint256 pClaim1) = claimLine.getPendingClaim(testAssetId, lender1);
        (,,,, uint256 pClaim2) = claimLine.getPendingClaim(testAssetId, lender2);
        (,,,, uint256 pClaim3) = claimLine.getPendingClaim(testAssetId, lender3);
        (,,,, uint256 pBorrower) = claimLine.getPendingClaim(testAssetId, obligor);

        uint256 totalOwed = pClaim1 + pClaim2 + pClaim3 + pBorrower;
        uint256 contractBalance = usdc.balanceOf(address(claimLine));

        // INVARIANT: Contract USDC balance is always >= total pending claimable liabilities
        assertTrue(contractBalance >= totalOwed, "Contract holds less than it owes!");
    }

    function testFuzz_Invariant_SeniorAlwaysPaidBeforeJunior(uint128 repayMicroUSDC) public {
        uint256 maxRepay = SENIOR_REPAY + JUNIOR_REPAY;
        uint256 rAmt = uint256(repayMicroUSDC) % (maxRepay + 1);
        vm.assume(rAmt > 0);

        vm.prank(lender1);
        claimLine.lock(testAssetId, SENIOR_CAP, ClaimLine.Tranche.Senior);
        vm.prank(lender2);
        claimLine.lock(testAssetId, JUNIOR_CAP, ClaimLine.Tranche.Junior);

        vm.prank(obligor);
        claimLine.close(testAssetId);

        usdc.mint(obligor, rAmt);
        vm.prank(obligor);
        claimLine.repay(testAssetId, rAmt);

        (uint256 sRepaid, uint256 jRepaid) = claimLine.getRepayments(testAssetId);

        if (rAmt <= SENIOR_REPAY) {
            assertEq(sRepaid, rAmt);
            assertEq(jRepaid, 0, "Junior received payment before Senior was full");
        } else {
            assertEq(sRepaid, SENIOR_REPAY, "Senior not fully paid");
            uint256 expectedJunior = rAmt - SENIOR_REPAY;
            if (expectedJunior > JUNIOR_REPAY) expectedJunior = JUNIOR_REPAY;
            assertEq(jRepaid, expectedJunior);
        }
    }

    // ==========================================
    // 4. ATTACK & REENTRANCY TESTS
    // ==========================================

    function test_Attack_CallbackTokenReentrancy() public {
        // Deploy reentrant token and new ClaimLine instance
        ReentrantMockUSDC rUsdc = new ReentrantMockUSDC();
        ClaimLine rClaimLine = new ClaimLine(address(rUsdc));

        address testObligor = address(0x999);
        address testLender = address(0x888);

        rUsdc.mint(testObligor, 1_000_000 * 1e6);
        rUsdc.mint(testLender, 1_000_000 * 1e6);

        vm.prank(testObligor);
        rUsdc.approve(address(rClaimLine), type(uint256).max);
        vm.prank(testLender);
        rUsdc.approve(address(rClaimLine), type(uint256).max);

        vm.prank(testObligor);
        bytes32 rAssetId = rClaimLine.registerAsset(
            "Invoice",
            "INV-REENTRANCY",
            custodian,
            testObligor,
            100_000 * 1e6,
            60_000 * 1e6,
            30_000 * 1e6,
            66_000 * 1e6,
            36_000 * 1e6,
            deadline
        );

        rUsdc.setTarget(address(rClaimLine), rAssetId);

        vm.prank(testLender);
        rClaimLine.lock(rAssetId, 60_000 * 1e6, ClaimLine.Tranche.Senior);

        vm.prank(testObligor);
        rClaimLine.close(rAssetId);

        vm.prank(testObligor);
        rClaimLine.repay(rAssetId, 66_000 * 1e6);

        // Enable reentrancy callback during USDC transfer
        rUsdc.setReentrancy(true);

        // Attempting to claim with malicious token callback will trigger ReentrancyGuard revert
        vm.prank(testLender);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        rClaimLine.claim(rAssetId);
    }
}
