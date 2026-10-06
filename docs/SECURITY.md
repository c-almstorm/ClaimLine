# Security & Threat Model

This document details the security mitigations, threat models, and automated test coverage implemented in **ClaimLine v1.0.0**.

---

## 🛡️ Fixed Vulnerabilities & Mitigations

### 1. Over-Borrowing & Capacity Overflow
* **Risk:** An obligor attempts to over-leverage collateral by registering capacities that exceed the documented asset face value, or lenders over-subscribe capital beyond maximum limits.
* **Mitigation:**
  - egisterAsset enforces equire(seniorCapacity + juniorCapacity <= faceValue, InvalidCapacities()).
  - close fills senior and junior queues sequentially up to capacity; any excess is automatically routed to pull-based refunds (claimableRefunds).
* **Test Coverage:**
  - [	est_Fix_OverCapacityRegistration_Revert()](../test/ClaimLine.t.sol#L197-L213)
  - [	est_Close_BorrowerCanCloseBeforeDeadline()](../test/ClaimLine.t.sol#L396-L414)

---

### 2. Partial-Fill Debt Scaling
* **Risk:** If an asset race closes with only partial lender participation (e.g. 50% filled), charging the original full fixed repayment debt would penalize the borrower for unreceived capital.
* **Mitigation:**
  - During close(), the contract dynamically scales the repayment obligation proportional to the accepted principal:
    \text{repaymentOwedScaled} = \frac{\text{repaymentOwed} \times \text{accepted}}{\text{capacity}}
* **Test Coverage:**
  - [	est_Fix_PartiallyFilledTranche_ScaledRepaymentOwed()](../test/ClaimLine.t.sol#L246-L271)

---

### 3. Blocked Close (Receiver Hooks & Blocklist Denial of Service)
* **Risk:**
  - **ERC-1155 Receiver Griefing:** If position tokens are minted via _mint (which triggers onERC1155Received), a malicious or non-implementing smart contract lender could revert, permanently locking all funds and preventing the race from closing.
  - **Arc/USDC Blocklist Griefing:** If borrower proceeds or refunds are pushed directly via transfer during close(), a blocklisted address would cause close() to revert.
* **Mitigation:**
  - Position tokens are issued using OpenZeppelin's internal _update logic, bypassing external receiver hooks.
  - All settlements, proceeds, and refunds are strictly pull-based (claimableProceeds, claimableRefunds), never pushed synchronously during close().
* **Test Coverage:**
  - [	est_Fix_NonReceiverLender_DirectUpdateMint()](../test/ClaimLine.t.sol#L215-L228)
  - [	est_Fix_BlocklistedBorrower_PullBasedProceeds()](../test/ClaimLine.t.sol#L230-L244)

---

### 4. Collateral Asset Squatting
* **Risk:** A malicious third party monitors off-chain invoices or documents and front-runs the obligor by registering the asset hash first.
* **Mitigation:**
  - egisterAsset requires msg.sender == obligor. Only the actual obligor/borrower can register an asset in their name.
* **Test Coverage:**
  - [	est_Fix_SquattingAttempt_Revert()](../test/ClaimLine.t.sol#L179-L195)

---

### 5. Slot Griefing & Dust Spamming
* **Risk:** An attacker attempts to lock up all available sequence slots (MAX_LOCKS = 32) with dust amounts (e.g. 1 wei USDC), blocking legitimate lenders from participating.
* **Mitigation:**
  - The protocol dynamically computes and enforces a strict minimum lock requirement:
    \text{minLock} = \left\lceil \frac{\text{seniorCapacity} + \text{juniorCapacity}}{\text{MAX\_LOCKS}} \right\rceil
  - Any lock with mount < minLock reverts immediately with AmountBelowMinLock.
* **Test Coverage:**
  - [	est_Lock_Revert_AmountBelowMinLock()](../test/ClaimLine.t.sol#L365-L374)
  - [	est_Lock_Revert_MaxLocksExceeded()](../test/ClaimLine.t.sol#L375-L385)

---

## 🔒 Invariant & Solvency Guarantees

1. **Protocol Solvency:** The contract's USDC balance is mathematically guaranteed to be greater than or equal to the sum of all pending claims:
   \text{balanceOf}(\text{ClaimLine}) \ge \sum \text{pendingClaims}
   - **Test Coverage:** [	estFuzz_Invariant_ContractBalanceAlwaysGEWhatItOwes()](../test/ClaimLine.t.sol#L685-L737)
2. **Strict Waterfall Priority:** No repayment funds ever flow to the Junior tranche until the Senior tranche repayment obligation is satisfied in full.
   - **Test Coverage:** [	estFuzz_Invariant_SeniorAlwaysPaidBeforeJunior()](../test/ClaimLine.t.sol#L739-L767)
3. **Reentrancy Protection:** All state-modifying functions implement OpenZeppelin's 
onReentrant and follow the Checks-Effects-Interactions pattern.
   - **Test Coverage:** [	est_Attack_CallbackTokenReentrancy()](../test/ClaimLine.t.sol#L773-L822)
