// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "forge-std/Test.sol";
import "../src/ClaimLine.sol";

contract MockUSDC is IERC20 {
    string public name = "USD Coin";
    string public symbol = "USDC";
    uint8 public decimals = 6;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function transfer(address to, uint256 amount) external returns (bool) {
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

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
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

contract ReentrancyAttacker {
    ClaimLine public claimLine;
    bytes32 public targetAsset;
    bool public attacking;

    constructor(address _claimLine) {
        claimLine = ClaimLine(_claimLine);
    }

    function attackClaim(bytes32 assetId) external {
        targetAsset = assetId;
        attacking = true;
        claimLine.claim(assetId);
    }

    // ERC1155 receiver hook
    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external returns (bytes4) {
        if (attacking) {
            claimLine.claim(targetAsset);
        }
        return this.onERC1155Received.selector;
    }
}

contract ClaimLineTest is Test {
    ClaimLine public claimLine;
    MockUSDC public usdc;

    address public borrower = address(0xB0B);
    address public lender1 = address(0x111);
    address public lender2 = address(0x222);
    address public lender3 = address(0x333);
    address public custodian = address(0xCCC);
    address public obligor = address(0x000);

    bytes32 public testAssetId;
    uint256 public constant FACE_VALUE = 100_000 * 1e6;
    uint256 public constant SENIOR_CAP = 60_000 * 1e6;
    uint256 public constant JUNIOR_CAP = 30_000 * 1e6;
    uint256 public constant SENIOR_REPAY = 66_000 * 1e6; // 10% yield
    uint256 public constant JUNIOR_REPAY = 36_000 * 1e6; // 20% yield
    uint256 public deadline;

    function setUp() public {
        usdc = new MockUSDC();
        claimLine = new ClaimLine(address(usdc));

        deadline = block.timestamp + 7 days;

        usdc.mint(lender1, 1_000_000 * 1e6);
        usdc.mint(lender2, 1_000_000 * 1e6);
        usdc.mint(lender3, 1_000_000 * 1e6);
        usdc.mint(borrower, 1_000_000 * 1e6);

        vm.prank(lender1);
        usdc.approve(address(claimLine), type(uint256).max);
        vm.prank(lender2);
        usdc.approve(address(claimLine), type(uint256).max);
        vm.prank(lender3);
        usdc.approve(address(claimLine), type(uint256).max);
        vm.prank(borrower);
        usdc.approve(address(claimLine), type(uint256).max);

        vm.prank(borrower);
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
    // 1. UNIT TESTS & FLOW TESTS
    // ==========================================

    function test_RegisterAsset_Success() public view {
        (
            bytes32 id,
            address b,
            uint256 fv,
            uint256 sCap,
            uint256 jCap,
            uint256 sRepay,
            uint256 jRepay,
            uint256 dl,
            ClaimLine.AssetState state,
            uint256 lockCount,
            uint256 sAcc,
            uint256 jAcc,
            uint256 sRepaid,
            uint256 jRepaid
        ) = claimLine.assets(testAssetId);

        assertEq(id, testAssetId);
        assertEq(b, borrower);
        assertEq(fv, FACE_VALUE);
        assertEq(sCap, SENIOR_CAP);
        assertEq(jCap, JUNIOR_CAP);
        assertEq(sRepay, SENIOR_REPAY);
        assertEq(jRepay, JUNIOR_REPAY);
        assertEq(dl, deadline);
        assertEq(uint256(state), uint256(ClaimLine.AssetState.Open));
        assertEq(lockCount, 0);
        assertEq(sAcc, 0);
        assertEq(jAcc, 0);
        assertEq(sRepaid, 0);
        assertEq(jRepaid, 0);
    }

    function test_RegisterAsset_Revert_Duplicate() public {
        vm.prank(borrower);
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
        vm.prank(borrower);
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
            block.timestamp // expired
        );
    }

    function test_RegisterAsset_Revert_InvalidCapacities() public {
        vm.prank(borrower);
        vm.expectRevert(ClaimLine.InvalidCapacities.selector);
        claimLine.registerAsset(
            "Invoice",
            "INV-NEW2",
            custodian,
            obligor,
            FACE_VALUE,
            0,
            0,
            0,
            0,
            deadline
        );
    }

    function test_RegisterAsset_Revert_InvalidRepayments() public {
        vm.prank(borrower);
        vm.expectRevert(ClaimLine.InvalidRepayments.selector);
        claimLine.registerAsset(
            "Invoice",
            "INV-NEW3",
            custodian,
            obligor,
            FACE_VALUE,
            SENIOR_CAP,
            JUNIOR_CAP,
            SENIOR_CAP - 1, // repayment less than principal
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
        assertEq(locks[0].lender, lender1);
        assertEq(locks[1].lender, lender2);
        assertEq(locks[2].lender, lender3);
    }

    function test_Lock_Revert_MaxLocksExceeded() public {
        for (uint256 i = 0; i < 32; i++) {
            vm.prank(lender1);
            claimLine.lock(testAssetId, 100 * 1e6, ClaimLine.Tranche.Senior);
        }

        // 33rd lock reverts
        vm.prank(lender1);
        vm.expectRevert(abi.encodeWithSelector(ClaimLine.MaxLocksExceeded.selector, testAssetId));
        claimLine.lock(testAssetId, 100 * 1e6, ClaimLine.Tranche.Senior);
    }

    function test_Lock_Revert_DeadlinePassed() public {
        vm.warp(deadline + 1);
        vm.prank(lender1);
        vm.expectRevert(
            abi.encodeWithSelector(ClaimLine.DeadlinePassed.selector, testAssetId, deadline, deadline + 1)
        );
        claimLine.lock(testAssetId, 100 * 1e6, ClaimLine.Tranche.Senior);
    }

    function test_Lock_Revert_InvalidAmount() public {
        vm.prank(lender1);
        vm.expectRevert(ClaimLine.InvalidAmount.selector);
        claimLine.lock(testAssetId, 0, ClaimLine.Tranche.Senior);
    }

    function test_Close_BorrowerCanCloseBeforeDeadline() public {
        vm.prank(lender1);
        claimLine.lock(testAssetId, 40_000 * 1e6, ClaimLine.Tranche.Senior);
        vm.prank(lender2);
        claimLine.lock(testAssetId, 40_000 * 1e6, ClaimLine.Tranche.Senior);

        uint256 borrowerPreBalance = usdc.balanceOf(borrower);

        vm.prank(borrower);
        claimLine.close(testAssetId);

        // Senior cap is 60k. Lender1 gets 40k accepted. Lender2 gets 20k accepted + 20k refund.
        uint256 borrowerPostBalance = usdc.balanceOf(borrower);
        assertEq(borrowerPostBalance - borrowerPreBalance, 60_000 * 1e6);

        assertEq(claimLine.claimableRefunds(testAssetId, lender2), 20_000 * 1e6);
        assertEq(claimLine.balanceOf(lender1, claimLine.getPositionTokenId(testAssetId, ClaimLine.Tranche.Senior)), 40_000 * 1e6);
        assertEq(claimLine.balanceOf(lender2, claimLine.getPositionTokenId(testAssetId, ClaimLine.Tranche.Senior)), 20_000 * 1e6);
    }

    function test_Close_AnyoneCanCloseAfterDeadline() public {
        vm.prank(lender1);
        claimLine.lock(testAssetId, 30_000 * 1e6, ClaimLine.Tranche.Junior);

        vm.warp(deadline + 10);

        // Non-borrower closes
        vm.prank(lender3);
        claimLine.close(testAssetId);

        (,,,,,,,, ClaimLine.AssetState state,,,,,) = claimLine.assets(testAssetId);
        assertEq(uint256(state), uint256(ClaimLine.AssetState.Closed));
    }

    function test_Close_Revert_NonBorrowerBeforeDeadline() public {
        vm.prank(lender1);
        claimLine.lock(testAssetId, 10_000 * 1e6, ClaimLine.Tranche.Senior);

        vm.prank(lender2);
        vm.expectRevert(ClaimLine.UnauthorizedClose.selector);
        claimLine.close(testAssetId);
    }

    function test_Close_Revert_ClosingTwice() public {
        vm.prank(borrower);
        claimLine.close(testAssetId);

        vm.prank(borrower);
        vm.expectRevert(abi.encodeWithSelector(ClaimLine.AssetNotOpen.selector, testAssetId));
        claimLine.close(testAssetId);
    }

    function test_Repayment_Waterfall_SeniorFirst() public {
        // Senior cap 60k, Junior cap 30k
        vm.prank(lender1);
        claimLine.lock(testAssetId, 60_000 * 1e6, ClaimLine.Tranche.Senior);
        vm.prank(lender2);
        claimLine.lock(testAssetId, 30_000 * 1e6, ClaimLine.Tranche.Junior);

        vm.prank(borrower);
        claimLine.close(testAssetId);

        // Senior repayment owed: 66k, Junior repayment owed: 36k
        // Repay 50k (all goes to senior)
        vm.prank(borrower);
        claimLine.repay(testAssetId, 50_000 * 1e6);

        (uint256 sRepaid, uint256 jRepaid) = claimLine.getRepayments(testAssetId);
        assertEq(sRepaid, 50_000 * 1e6);
        assertEq(jRepaid, 0);

        // Repay another 26k (16k completes senior, 10k flows to junior)
        vm.prank(borrower);
        claimLine.repay(testAssetId, 26_000 * 1e6);

        (sRepaid, jRepaid) = claimLine.getRepayments(testAssetId);
        assertEq(sRepaid, 66_000 * 1e6);
        assertEq(jRepaid, 10_000 * 1e6);
    }

    function test_Claim_PullBased_RefundAndRepayment() public {
        vm.prank(lender1);
        claimLine.lock(testAssetId, 40_000 * 1e6, ClaimLine.Tranche.Senior);
        vm.prank(lender2);
        claimLine.lock(testAssetId, 40_000 * 1e6, ClaimLine.Tranche.Senior); // 20k accepted, 20k refund

        vm.prank(borrower);
        claimLine.close(testAssetId);

        // Repay 33k (50% of senior repayment 66k)
        vm.prank(borrower);
        claimLine.repay(testAssetId, 33_000 * 1e6);

        // Lender2 claims refund (20k) + 50% share of 20k/60k * 33k = 11k repayment -> Total 31k
        uint256 lender2Pre = usdc.balanceOf(lender2);
        vm.prank(lender2);
        claimLine.claim(testAssetId);
        uint256 lender2Post = usdc.balanceOf(lender2);

        assertEq(lender2Post - lender2Pre, 31_000 * 1e6);

        // Lender2 cannot double claim
        vm.prank(lender2);
        vm.expectRevert(ClaimLine.NothingToClaim.selector);
        claimLine.claim(testAssetId);
    }

    function test_ERC1155_NonTransferable_InV1() public {
        vm.prank(lender1);
        claimLine.lock(testAssetId, 10_000 * 1e6, ClaimLine.Tranche.Senior);
        vm.prank(borrower);
        claimLine.close(testAssetId);

        uint256 tokenId = claimLine.getPositionTokenId(testAssetId, ClaimLine.Tranche.Senior);

        vm.prank(lender1);
        vm.expectRevert(ClaimLine.TransfersDisabledInV1.selector);
        claimLine.safeTransferFrom(lender1, lender2, tokenId, 10_000 * 1e6, "");
    }

    // ==========================================
    // 2. INVARIANT FUZZ TESTS
    // ==========================================

    function testFuzz_Invariant_TotalUSDCAccounting(
        uint32 lockAmt1,
        uint32 lockAmt2,
        uint32 lockAmt3,
        uint32 repayAmt
    ) public {
        vm.assume(lockAmt1 > 100 && lockAmt1 < 50_000_000);
        vm.assume(lockAmt2 > 100 && lockAmt2 < 50_000_000);
        vm.assume(lockAmt3 > 100 && lockAmt3 < 50_000_000);

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

        uint256 borrowerPre = usdc.balanceOf(borrower);
        vm.prank(borrower);
        claimLine.close(testAssetId);
        uint256 borrowerProceeds = usdc.balanceOf(borrower) - borrowerPre;

        uint256 rAmt = (uint256(repayAmt) % (SENIOR_REPAY + JUNIOR_REPAY + 1)) * 1e6;
        if (rAmt > 0) {
            usdc.mint(borrower, rAmt);
            vm.prank(borrower);
            claimLine.repay(testAssetId, rAmt);
        }

        uint256 totalIn = l1 + l2 + l3 + (rAmt > 0 ? (rAmt > SENIOR_REPAY + JUNIOR_REPAY ? SENIOR_REPAY + JUNIOR_REPAY : rAmt) : 0);

        // Claims
        uint256 claimed1 = 0;
        uint256 claimed2 = 0;
        uint256 claimed3 = 0;

        (,,, uint256 p1) = claimLine.getPendingClaim(testAssetId, lender1);
        if (p1 > 0) {
            uint256 b1 = usdc.balanceOf(lender1);
            vm.prank(lender1);
            claimLine.claim(testAssetId);
            claimed1 = usdc.balanceOf(lender1) - b1;
        }

        (,,, uint256 p2) = claimLine.getPendingClaim(testAssetId, lender2);
        if (p2 > 0) {
            uint256 b2 = usdc.balanceOf(lender2);
            vm.prank(lender2);
            claimLine.claim(testAssetId);
            claimed2 = usdc.balanceOf(lender2) - b2;
        }

        (,,, uint256 p3) = claimLine.getPendingClaim(testAssetId, lender3);
        if (p3 > 0) {
            uint256 b3 = usdc.balanceOf(lender3);
            vm.prank(lender3);
            claimLine.claim(testAssetId);
            claimed3 = usdc.balanceOf(lender3) - b3;
        }

        uint256 contractBalance = usdc.balanceOf(address(claimLine));

        // Invariant: total in == borrower proceeds + claimed payouts/refunds + contract balance
        assertEq(totalIn, borrowerProceeds + claimed1 + claimed2 + claimed3 + contractBalance);
    }

    function testFuzz_Invariant_SeniorAlwaysPaidBeforeJunior(uint32 repayAmount) public {
        vm.assume(repayAmount > 0 && repayAmount <= 200_000);
        uint256 rAmt = uint256(repayAmount) * 1e6;

        vm.prank(lender1);
        claimLine.lock(testAssetId, SENIOR_CAP, ClaimLine.Tranche.Senior);
        vm.prank(lender2);
        claimLine.lock(testAssetId, JUNIOR_CAP, ClaimLine.Tranche.Junior);

        vm.prank(borrower);
        claimLine.close(testAssetId);

        usdc.mint(borrower, rAmt);
        vm.prank(borrower);
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
    // 3. ATTACK TESTS
    // ==========================================

    function test_Attack_ReentrancyOnClaim() public {
        ReentrancyAttacker attacker = new ReentrancyAttacker(address(claimLine));
        usdc.mint(address(attacker), 50_000 * 1e6);

        vm.prank(address(attacker));
        usdc.approve(address(claimLine), type(uint256).max);

        vm.prank(address(attacker));
        claimLine.lock(testAssetId, 50_000 * 1e6, ClaimLine.Tranche.Senior);

        vm.prank(borrower);
        claimLine.close(testAssetId);

        // Repay
        vm.prank(borrower);
        claimLine.repay(testAssetId, 55_000 * 1e6);

        // Attacker attempts reentrancy during claim
        vm.prank(address(attacker));
        // Claim succeeds without allowing reentrancy re-execution (ReentrancyGuard protects)
        attacker.attackClaim(testAssetId);

        assertEq(usdc.balanceOf(address(attacker)), 55_000 * 1e6);
    }

    function test_Attack_RoundingDustPrecision() public {
        // 3 lenders split 1 wei increments
        vm.prank(lender1);
        claimLine.lock(testAssetId, 10_000 * 1e6 + 1, ClaimLine.Tranche.Senior);
        vm.prank(lender2);
        claimLine.lock(testAssetId, 20_000 * 1e6 + 2, ClaimLine.Tranche.Senior);
        vm.prank(lender3);
        claimLine.lock(testAssetId, 30_000 * 1e6 + 3, ClaimLine.Tranche.Senior);

        vm.prank(borrower);
        claimLine.close(testAssetId);

        // Partial repayment of odd prime amount
        uint256 primeRepay = 13_337 * 1e6 + 7;
        vm.prank(borrower);
        claimLine.repay(testAssetId, primeRepay);

        vm.prank(lender1);
        claimLine.claim(testAssetId);
        vm.prank(lender2);
        claimLine.claim(testAssetId);
        vm.prank(lender3);
        claimLine.claim(testAssetId);

        // Contract solvency verified: contract holds at least 0 and never underflows
        assertTrue(usdc.balanceOf(address(claimLine)) <= 3); // max rounding dust bounded by num lenders
    }
}
