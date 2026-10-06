# Security & Threat Model

This document details the security mitigations, threat models, and automated test coverage implemented in **ClaimLine v1.0.0**.

---

## 🛡️ Fixed Vulnerabilities & Mitigations

### 1. Over-Borrowing & Capacity Overflow
* **Risk:** An obligor attempts to over-leverage collateral by registering capacities that exceed the documented asset face value, or lenders over-subscribe capital beyond maximum limits.
* **Mitigation:**
  - `registerAsset` enforces `require(seniorCapacity + juniorCapacity <= faceValue, InvalidCapacities())`.
  - `close` fills senior and junior queues sequentially up to capacity; any excess is automatically routed to pull-based refunds (`claimableRefunds`).
* **Test Coverage in [`test/ClaimLine.t.sol`](../test/ClaimLine.t.sol):**
  - `test_Fix_OverCapacityRegistration_Revert()`
  - `test_Close_BorrowerCanCloseBeforeDeadline()`

---

### 2. Partial-Fill Debt Scaling
* **Risk:** If an asset race closes with only partial lender participation (e.g. 50% filled), charging the original full fixed repayment debt would penalize the borrower for unreceived capital.
* **Mitigation:**
  - During `close()`, the contract dynamically scales the repayment obligation proportional to the accepted principal:
    $$\text{repaymentOwedScaled} = \frac{\text{repaymentOwed} \times \text{accepted}}{\text{capacity}}$$
* **Test Coverage in [`test/ClaimLine.t.sol`](../test/ClaimLine.t.sol):**
  - `test_Fix_PartiallyFilledTranche_ScaledRepaymentOwed()`

---

### 3. Blocked Close (Receiver Hooks & Blocklist Denial of Service)
* **Risk:**
  - **ERC-1155 Receiver Griefing:** If position tokens are minted via OpenZeppelin's `_mint` (which triggers `onERC1155Received`), a malicious or non-implementing smart contract lender could revert, permanently locking all funds and preventing the race from closing.
  - **Arc/USDC Blocklist Griefing:** If borrower proceeds or refunds are pushed directly via `transfer` during `close()`, a blocklisted address would cause `close()` to revert.
* **Mitigation:**
  - Position tokens are issued using OpenZeppelin's internal `_update` logic, bypassing external receiver hooks.
  - All settlements, proceeds, and refunds are strictly pull-based (`claimableProceeds`, `claimableRefunds`), never pushed synchronously during `close()`.
* **Test Coverage in [`test/ClaimLine.t.sol`](../test/ClaimLine.t.sol):**
  - `test_Fix_NonReceiverLender_DirectUpdateMint()`
  - `test_Fix_BlocklistedBorrower_PullBasedProceeds()`

---

### 4. Collateral Asset Squatting
* **Risk:** A malicious third party monitors off-chain invoices or documents and front-runs the obligor by registering the asset hash first.
* **Mitigation:**
  - `registerAsset` requires `msg.sender == obligor`. Only the actual obligor/borrower can register an asset in their name.
* **Test Coverage in [`test/ClaimLine.t.sol`](../test/ClaimLine.t.sol):**
  - `test_Fix_SquattingAttempt_Revert()`

---

### 5. Slot Griefing & Dust Spamming
* **Risk:** An attacker attempts to lock up all available sequence slots (`MAX_LOCKS = 32`) with dust amounts (e.g. 1 wei USDC), blocking legitimate lenders from participating.
* **Mitigation:**
  - The protocol dynamically computes and enforces a strict minimum lock requirement:
    $$\text{minLock} = \left\lceil \frac{\text{seniorCapacity} + \text{juniorCapacity}}{\text{MAX\_LOCKS}} \right\rceil$$
  - Any lock with `amount < minLock` reverts immediately with `AmountBelowMinLock`.
* **Test Coverage in [`test/ClaimLine.t.sol`](../test/ClaimLine.t.sol):**
  - `test_Lock_Revert_AmountBelowMinLock()`
  - `test_Lock_Revert_MaxLocksExceeded()`

---

## 🔒 Invariant & Solvency Checks

1. **Protocol Solvency:** The contract's USDC balance is checked by fuzz tests to be greater than or equal to the sum of all pending claims:
   $$\text{balanceOf}(\text{ClaimLine}) \ge \sum \text{pendingClaims}$$
   - **Test Coverage in [`test/ClaimLine.t.sol`](../test/ClaimLine.t.sol):** `testFuzz_Invariant_ContractBalanceAlwaysGEWhatItOwes()`
2. **Strict Waterfall Priority:** No repayment funds ever flow to the Junior tranche until the Senior tranche repayment obligation is satisfied in full.
   - **Test Coverage in [`test/ClaimLine.t.sol`](../test/ClaimLine.t.sol):** `testFuzz_Invariant_SeniorAlwaysPaidBeforeJunior()`
3. **Reentrancy Protection:** All functions that move USDC (`lock`, `close`, `repay`, `claim`) implement OpenZeppelin's `nonReentrant` modifier and follow the Checks-Effects-Interactions pattern.
   - **Test Coverage in [`test/ClaimLine.t.sol`](../test/ClaimLine.t.sol):** `test_Attack_CallbackTokenReentrancy()`
