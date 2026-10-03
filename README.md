# ClaimLine

**ClaimLine** is a decentralized lien-priority registry designed for Arc network, enabling transparent, deterministic priority-ordered claims and liens against assets denominated in USDC.

---

## ⚡ Key Highlights
* **Native USDC Settlement:** Uses Arc's native USDC ERC-20 interface (`0x3600000000000000000000000000000000000000`) with standard 6-decimal precision.
* **Deterministic Priority Order:** Registered collateral assets issue Senior and Junior tranche position tokens based on strict FIFO sequential lock priority.
* **Strict Senior-First Waterfall:** Repayments prioritize the Senior tranche in full before any capital flows to the Junior tranche.
* **Pull-Based Claims & Arc Blocklist Safety:** Withdrawals (refunds and repayments) are strictly pull-based (`claim(assetId)`). A blocked or non-responsive address cannot stall or freeze the waterfall for any other participants.
* **Non-Transferable Position Tokens in v1:** In v1, ERC-1155 position tokens serve as non-transferable (soulbound) receipts for lenders to preserve strict pull-based accumulator integrity without race-condition hazards during transfers.

---

## 📖 Documentation & Network Facts
* [`docs/arc-facts.md`](docs/arc-facts.md) — Live doc citations and network parameters.
* [`docs/arc-quirks.md`](docs/arc-quirks.md) — EVM differences, runtime blocklist behaviors, and gas fee models on Arc.

---

## 🛠️ Architecture & Core Flows

### 1. Collateral Asset Registration (`registerAsset`)
Borrowers register collateral under a unique hash:
$$\text{assetId} = \text{keccak256}(\text{abi.encode}(\text{assetType}, \text{docId}, \text{custodian}, \text{obligor}, \text{faceValue}))$$
Parameters include Senior capacity, Junior capacity, fixed repayment debts owed, and deadline.

### 2. Sequential Escrow (`lock`)
Lenders escrow 6-decimal USDC into Senior or Junior tranches. Each lock is stamped with a strictly increasing sequence number ($1, 2, \dots$). Capped at 32 locks per asset to guarantee low and bounded gas consumption during settlement.

### 3. Settlement & Race Close (`close`)
Closed by the borrower (or anyone post-deadline):
* Fills Senior capacity in sequence order; excess is refunded.
* Fills Junior capacity in sequence order; excess is refunded.
* Accepted principal is paid to the borrower.
* Lenders receive ERC-1155 position tokens representing their accepted principal.

### 4. Waterfall Repayment (`repay`)
Borrowers or third parties deposit USDC repayments. Repayments satisfy the senior repayment obligation in full before any remainder is credited to the junior tranche.

### 5. Pull-Based Claim (`claim`)
Lenders withdraw unaccepted lock refunds and pro-rata shares of senior/junior repayments on demand.

---

## 🧪 Testing & Verification

```bash
forge test --gas-report
```

Suite covers:
* **Unit tests:** Every state transition and custom error revert.
* **Invariant fuzz tests:**
  1. Total USDC in $\equiv$ refunds $+$ payouts $+$ borrower proceeds $+$ contract balance.
  2. Senior tranche is fully paid before Junior receives any repayment.
* **Attack tests:** Reentrancy guard validation, double registration protection, and rounding dust solvency.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
