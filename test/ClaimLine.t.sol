// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

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
        if (allowance[from][msg.sender] != type(uint256).max) {
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

contract ClaimLineTest is Test {
    ClaimLine public claimLine;
    MockUSDC public mockUsdc;

    address public owner = address(this);
    address public borrower = address(0xB0B);
    address public lender = address(0x1E4DE);

    function setUp() public {
        mockUsdc = new MockUSDC();
        claimLine = new ClaimLine(address(mockUsdc));
    }

    function test_InitialState() public view {
        assertEq(address(claimLine.usdc()), address(mockUsdc));
        assertEq(claimLine.VERSION(), "0.1.0");
        assertEq(claimLine.lienCounter(), 0);
    }

    function test_RegisterLien() public {
        uint256 amountUSDC = 50_000 * 10 ** 6; // 50k USDC (6 decimals)
        uint256 priority = 1;

        vm.expectEmit(true, true, true, true);
        emit ClaimLine.LienRegistered(1, borrower, lender, amountUSDC, priority, block.timestamp);

        uint256 lienId = claimLine.registerLien(borrower, lender, amountUSDC, priority);
        assertEq(lienId, 1);
        assertEq(claimLine.lienCounter(), 1);

        ClaimLine.LienRecord memory record = claimLine.getLien(1);
        assertEq(record.lienId, 1);
        assertEq(record.borrower, borrower);
        assertEq(record.lender, lender);
        assertEq(record.amount, amountUSDC);
        assertEq(record.priority, priority);
        assertTrue(record.active);
    }

    function test_DischargeLien() public {
        uint256 amountUSDC = 10_000 * 10 ** 6;
        uint256 lienId = claimLine.registerLien(borrower, lender, amountUSDC, 2);

        // Lender discharges lien
        vm.prank(lender);
        vm.expectEmit(true, false, false, true);
        emit ClaimLine.LienDischarged(lienId, block.timestamp);
        claimLine.dischargeLien(lienId);

        ClaimLine.LienRecord memory record = claimLine.getLien(lienId);
        assertFalse(record.active);
    }

    function test_RevertUnauthorizedDischarge() public {
        uint256 amountUSDC = 10_000 * 10 ** 6;
        uint256 lienId = claimLine.registerLien(borrower, lender, amountUSDC, 1);

        vm.prank(address(0x999));
        vm.expectRevert("ClaimLine: unauthorized discharge");
        claimLine.dischargeLien(lienId);
    }

    function test_RevertInvalidRegistration() public {
        vm.expectRevert("ClaimLine: invalid borrower");
        claimLine.registerLien(address(0), lender, 100, 1);

        vm.expectRevert("ClaimLine: invalid lender");
        claimLine.registerLien(borrower, address(0), 100, 1);

        vm.expectRevert("ClaimLine: zero amount");
        claimLine.registerLien(borrower, lender, 0, 1);
    }
}
