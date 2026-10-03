# ClaimLine

**ClaimLine** is a decentralized lien-priority registry designed for Arc network, enabling transparent, deterministic priority-ordered claims and liens against assets denominated in USDC.

---

## ⚡ Key Highlights
* **Native USDC Settlement:** Uses Arc's native USDC ERC-20 interface (`0x3600000000000000000000000000000000000000`) with standard 6-decimal precision.
* **Deterministic Priority Order:** Registered collateral assets issue Senior and Junior tranche position tokens based on strict FIFO sequential lock priority.
* **Strict Senior-First Waterfall:** Repayments prioritize the Senior tranche in full before any capital flows to the Junior tranche.
* **Pull-Based Claims & Arc Blocklist Safety:** Withdrawals (refunds, borrower proceeds, and lender repayments) are strictly pull-based (`claim(assetId)`). A blocked or non-responsive address cannot stall or freeze the waterfall for any other participants.
* **Receiver-Safe Minting:** ERC-1155 position tokens are minted via internal accounting `_update` without triggering external receiver hooks (`onERC1155Received`), ensuring smart contract lenders that do not implement token receipts cannot brick settlement.

---

## ⚠️ Protocol Limits & Invariants

1. **Repayment and Real-World Collateral are Not Enforced On-Chain:** ClaimLine acts as an on-chain priority settlement registry. Legal custody, physical collateral possession, and loan enforcement remain governed off-chain by legal agreements between borrowers, lenders, and custodians.
2. **Rounding Dust Stays in the Contract:** Due to integer division in proportional distribution calculations, negligible dust remainders (bounded under 10 wei-units / micro-USDC) remain within the contract balance to guarantee complete protocol solvency (`contractBalance >= totalOwed`).
3. **Non-Transferable Position Tokens in v1:** In v1, ERC-1155 position tokens are non-transferable receipts for lenders. This eliminates race conditions and accumulator desynchronization vulnerabilities across secondary transfers, preserving strict pull-based claim safety.
4. **Cap at 32 Locks Per Asset (`MAX_LOCKS = 32`):** Each collateral race accepts at most 32 sequential escrow locks, bounding loop iterations and ensuring low, predictable gas costs during `close()`.
5. **Minimum Lock Requirement (`minLock`):** Assets enforce a minimum lock size `minLock = ceil((seniorCapacity + juniorCapacity) / MAX_LOCKS)` to prevent dust spamming of lock slots.
6. **Capacity Bound by Face Value (`seniorCapacity + juniorCapacity <= faceValue`):** Total leverage across senior and junior tranches cannot exceed the documented collateral asset face value.

---

## 📖 Documentation & Network Facts
* [`docs/arc-facts.md`](docs/arc-facts.md) — Live doc citations and network parameters.
* [`docs/arc-quirks.md`](docs/arc-quirks.md) — EVM differences, runtime blocklist behaviors, and gas fee models on Arc.

---

## 🛠️ Architecture & Core Flows

### 1. Collateral Asset Registration (`registerAsset`)
Obligors register collateral under a unique hash:
$$\text{assetId} = \text{keccak256}(\text{abi.encode}(\text{assetType}, \text{docId}, \text{custodian}, \text{obligor}, \text{faceValue}))$$
Requires `msg.sender == obligor` and validates `seniorCapacity + juniorCapacity <= faceValue`. Computes `minLock = ceil((seniorCapacity + juniorCapacity) / 32)`.

### 2. Sequential Escrow (`lock`)
Lenders escrow 6-decimal USDC into Senior or Junior tranches (`amount >= minLock`). Each lock is stamped with a strictly increasing sequence number ($1, 2, \dots$). Capped at 32 locks per asset.

### 3. Settlement & Race Close (`close`)
Closed by the borrower/obligor (or anyone post-deadline):
* Fills Senior capacity in sequence order; excess is refunded.
* Fills Junior capacity in sequence order; excess is refunded.
* Scales fixed repayment debts proportionally by $\text{accepted} \div \text{capacity}$.
* Credits accepted principal to borrower pull-based proceeds.
* Issues ERC-1155 position tokens directly via `_update`.

### 4. Waterfall Repayment (`repay`)
Borrowers or third parties deposit USDC repayments. Repayments satisfy the senior repayment obligation in full before any remainder is credited to the junior tranche.

### 5. Pull-Based Claim (`claim`)
Lenders and borrowers withdraw unaccepted lock refunds, proceeds, and pro-rata shares of senior/junior repayments on demand.

---

## 🧪 Testing & Verification

```bash
forge test --gas-report
```

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
