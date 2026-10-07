# ClaimLine

Claimline is an on-chain priority and repayment ledger for asset-backed lending on Arc, built so that lenders know who is paid first.

### 🎯 Built For
Lending against invoices, receipts, and receivables where several lenders share one asset. Today it settles the order of claims and splits repayments in that order. Asset verification, due dates, and default enforcement are on the roadmap.

### 💎 Key Proof Points
1. **Live on Arc Mainnet with a Recorded Run:** Deployed and operating live on Arc Mainnet (`Chain ID 5042`) with a recorded multi-party execution run covering registration, sequential senior/junior locks, FIFO capacity settlement, partial repayment, and pull-based claims ([Recorded Run Evidence](evidence/mainnet-run.json)).
2. **Priority from Contract Execution Order with Automatic Senior-First Payouts & Refunds:** Priority is the contract's execution order on Arc. Repayments strictly satisfy Senior tranche obligations 100% before any capital flows to Junior tranches, and excess locks are refunded safely without reverts.
3. **Native USDC Settlement:** Native 6-decimal USDC (`0x3600000000000000000000000000000000000000`) integration removes wrapped-asset bridge risks and fractional decimal mismatches.

## 💡 What ClaimLine Does & The Problem It Solves

In traditional trade finance and decentralized credit, lenders face **collateral opacity and double-pledging risks**:
* Borrowers can pledge the same invoice or physical asset across multiple lenders without cross-institutional visibility.
* Lien priorities rely on fragmented, delayed jurisdictional filing systems (such as state UCC-1 filings).
* Lenders lack real-time transparency into who holds senior claim rights when repayments occur.

**ClaimLine provides an on-chain, deterministic priority registry:**
1. **Collateral Encumbrance:** An obligor registers a real-world collateral document with defined debt capacities and repayment obligations.
2. **First-Come, First-Served Lien Order:** Lenders escrow USDC into Senior and Junior tranches. Priority is strictly assigned by arrival order (sequence 1, 2, 3, etc.).
3. **Deterministic Settlement:** When the asset race closes, principal is allocated in strict sequential FIFO order, scaling repayment obligations proportionally if partially filled.
4. **Waterfall Repayment:** Borrowers repay in USDC, and the smart contract strictly satisfies Senior tranche lenders in full before any capital flows to Junior tranche lenders.
5. **Pull-Based Safety:** All withdrawals (proceeds, refunds, repayment payouts) are pull-based, preventing blocked transfers or malicious callbacks from disrupting settlement.

---

## ⚡ Why Arc?

* **Priority from Chain Execution Order:** On Arc, priority is the contract's execution order on Arc. Arc validators order transactions, and within a single block the block's proposer determines transaction inclusion order.
* **Sub-Second Finality:** Arc achieves sub-second deterministic finality (see [Arc Documentation](https://docs.arc.network/)). Lenders gain rapid confirmation of their lien position once executed on-chain.
* **Native USDC Settlement:** Direct integration with Arc's native USDC (`0x3600000000000000000000000000000000000000` with 6-decimal precision) eliminates synthetic wrapping risks, token bridging friction, and decimal conversion discrepancies.

---

## 🏗️ Architecture & Core Flows

```
  Obligor / Borrower                   Lenders (Senior & Junior)
        │                                         │
        │ 1. registerAsset(...)                   │ 2. lock(...) [USDC Escrow]
        ▼                                         ▼
 ┌──────────────────────────────────────────────────────────────┐
 │                      ClaimLine Registry                      │
 │   - FIFO Sequence Allocation (Max 32 Locks)                  │
 │   - minLock = ceil((seniorCap + juniorCap) / 32)             │
 └──────────────────────────────┬───────────────────────────────┘
                                │
                                │ 3. close(...)
                                ▼
 ┌──────────────────────────────────────────────────────────────┐
 │                    Deterministic Settlement                  │
 │   - Senior Capacity filled first, then Junior                │
 │   - Excess locks refunded via claimableRefunds               │
 │   - Proportional debt scaling on partial fills               │
 │   - Issues non-transferable ERC-1155 Position Tokens         │
 │   - Credits borrower proceeds via claimableProceeds          │
 └──────────────────────────────┬───────────────────────────────┘
                                │
        ┌───────────────────────┴───────────────────────┐
        │ 4. repay(...) [USDC]                          │ 5. claim(...) [USDC]
        ▼                                               ▼
 ┌──────────────────────────────┐                ┌──────────────────────────────┐
 │      Waterfall Engine        │                │     Pull-Based Claims        │
 │ Senior satisfied 100% first  │───────────────▶│ Lenders & Borrowers withdraw │
 │ Remainder flows to Junior    │                │ refunds, proceeds & payouts  │
 └──────────────────────────────┘                └──────────────────────────────┘
```

1. **`registerAsset(...)`**: Obligors commit asset metadata (`assetType`, `docId`, `custodian`, `faceValue`, `seniorCapacity`, `juniorCapacity`, `seniorRepaymentOwed`, `juniorRepaymentOwed`, `deadline`). Enforces `msg.sender == obligor` and `seniorCapacity + juniorCapacity <= faceValue`.
2. **`lock(...)`**: Lenders escrow 6-decimal USDC into Senior or Junior queues. Minimum lock size is strictly enforced (`minLock`) to prevent slot griefing. Capped at 32 locks per race.
3. **`close(...)`**: Closes the race (by borrower before deadline, or by anyone post-deadline). Fills Senior capacity in sequence order, then Junior; excess is refunded. Issues ERC-1155 position tokens via internal accounting without invoking external receiver hooks.
4. **`repay(...)`**: Anyone deposits USDC repayments. The contract enforces a strict priority waterfall: Senior debts must be paid 100% before Junior receives funds.
5. **`claim(...)`**: Lenders and borrowers withdraw unaccepted refunds, proceeds, and pro-rata repayment payouts on demand.

---

## 🌐 Live Deployments & Verification

### 🔵 Arc Mainnet (Chain ID 5042)
* **Contract Address:** [`0x6B7731c78B63C86468b0ddAE9C02432cb647d08e`](https://explorer.arc.io/address/0x6b7731c78b63c86468b0ddae9c02432cb647d08e)
* **Deployment Tx:** [`0x5b048e41cc3900f82c39059b06d8aa3bdca8b039ee75e2c1c72bce9009e5c03e`](https://explorer.arc.io/tx/0x5b048e41cc3900f82c39059b06d8aa3bdca8b039ee75e2c1c72bce9009e5c03e)
* **Deployment Block:** 24474184
* **USDC Address:** `0x3600000000000000000000000000000000000000`
* **Verification Status:** Source matches tagged `v1.0.0`; verification command documented in [`docs/MAINNET.md`](docs/MAINNET.md) for Blockscout / Explorer API.
* **Deployment Metadata:** [`deployments/mainnet.json`](deployments/mainnet.json)

---

### 🟢 Arc Testnet (Chain ID 5042002)
* **Contract Address:** [`0xeFCBD627341F70AED57d0099B030B06C40516279`](https://explorer.testnet.arc.io/address/0xeFCBD627341F70AED57d0099B030B06C40516279)
* **Status:** Verified (Blockscout / Explorer)
* **Deployment Tx:** [`0xda5fda81e5bf51c52931e30062b4991bafadcbd451180fb78925aa734b265110`](https://explorer.testnet.arc.io/tx/0xda5fda81e5bf51c52931e30062b4991bafadcbd451180fb78925aa734b265110)
* **Deployment Block:** 65571537
* **End-to-End Evidence:** [`evidence/testnet-run.json`](evidence/testnet-run.json)

---

## 💰 How Lenders Earn

Lenders in ClaimLine earn yield via **contract-enforced repayment premiums**:
* **The Repayment Premium:** When registering an asset, the obligor commits to a repayment amount exceeding the borrowed principal (`Repayment Premium = Repayment Owed - Capacity`).
* **Senior Tranche (Priority 1 — Lower Risk, Priority Yield):**
  * Senior lenders enjoy first-priority lien rights over all incoming repayments.
  * Every dollar repaid by the borrower satisfies Senior principal and premium 100% before any capital is routed to Junior lenders.
  * *Mainnet Run Figures:* Senior capacity was 2.00 USDC with 2.20 USDC owed (10% premium). Senior lenders received 2.20 USDC in full on the first repayment.
* **Junior Tranche (Priority 2 — Subordinated, First-Loss Capital):**
  * Junior lenders take the **first-loss position** if the borrower defaults or makes only a partial repayment.
  * In exchange for subordinating priority to Senior lenders, Junior tranches offer higher repayment premiums.
  * *Mainnet Run Figures:* Junior capacity was 1.00 USDC with 1.20 USDC owed (20% premium). Junior received 0.80 USDC on initial repayment and the final 0.40 USDC on the borrower's top-up repayment, achieving 100% full repayment.
* **Pro-Rata Waterfall Distribution:** When multiple lenders participate in the same tranche, all accepted repayments are split pro-rata based on each lender's accepted principal (`(principalAccepted / totalAccepted) * repaidAmount`).
  * *Mainnet Run Figures:* In Senior tranche, Lender 1 held 1.50 USDC (75% of accepted cap) and received 1.65 USDC; Lender 2 held 0.50 USDC (25% of accepted cap) and received 0.55 USDC plus a 1.00 USDC unaccepted lock refund. In Junior tranche, Lender 1 held 1.00 USDC (100% of accepted cap) and received 1.20 USDC.

---

## ⚖️ Enforcement and Risks

* **Repayment Is Not Enforced On-Chain:** ClaimLine is an on-chain priority settlement and debt-tracking registry. The smart contract cannot forcibly liquidate off-chain bank accounts or physical assets if an obligor fails to repay. Real-world legal recourses, UCC lien filings, credit underwriting, and off-chain recovery remain the responsibility of participating lending institutions and custodians.
* **First-Loss Subordination Risk:** In the event of a borrower shortfall or partial repayment, the Senior tranche is satisfied first in full. Junior tranche lenders bear 100% of the initial deficit.
* **Unaccepted Escrow Refunds:** If an asset race is oversubscribed, excess locks beyond the tranche capacity are not accepted into the loan and are returned 100% via pull-based claim without yield or penalties.

---

## 📊 Live Mainnet Proof-of-Execution Run

The full lifecycle of ClaimLine has been executed and verified live on **Arc Mainnet** (`Chain ID 5042`) on contract [`0x6B7731c78B63C86468b0ddAE9C02432cb647d08e`](https://explorer.arc.io/address/0x6b7731c78b63c86468b0ddae9c02432cb647d08e).

All 11 transactions and decoded arguments are recorded in [`evidence/mainnet-run.json`](evidence/mainnet-run.json):

| Step | Block | Event / Action | Transaction Hash | Participant | Amount / Details |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `24604906` | `AssetRegistered` | [`0xd5eeede8...75e6`](https://explorer.arc.io/tx/0xd5eeede8a96f1eb7070b187f766a8437e96bcdb4f76b31b09d1a9f65994675e6) | `0x38dB...7d6F` (Borrower) | Registered `ARC-MAINNET-SMOKE-001` (Face: 3.0 USDC, Senior Cap: 2.0 USDC @ 2.2 owed, Junior Cap: 1.0 USDC @ 1.2 owed) |
| **2** | `24605489` | `LockPlaced` (Senior) | [`0x803b1213...1d80`](https://explorer.arc.io/tx/0x803b121366944f76480bcc7e56e8c14b05f077b9d76dee2e109d42d491611d80) | `0xCCe8...f3A8` (Lender 1) | Locked 1.50 USDC into Senior Tranche (Seq #1) |
| **3** | `24605665` | `LockPlaced` (Senior) | [`0xb84af838...0cd3`](https://explorer.arc.io/tx/0xb84af8387757615d2176f7445acb1b659918d53b45af6b87205fe8319a5a0cd3) | `0xb20A...dFA4` (Lender 2) | Locked 1.50 USDC into Senior Tranche (Seq #2) |
| **4** | `24605842` | `LockPlaced` (Junior) | [`0xd8d1bdca...825b`](https://explorer.arc.io/tx/0xd8d1bdcac8978dc5c515e06f0a623550c237851a29ab3eb4f8ea09825385825b) | `0xCCe8...f3A8` (Lender 1) | Locked 1.00 USDC into Junior Tranche (Seq #3) |
| **5** | `24606087` | `AssetClosed` | [`0x4611c93e...b134`](https://explorer.arc.io/tx/0x4611c93ed830350ba4004b314abb4799d7271c3675cc90245fbf5f7d1e01b134) | `0x38dB...7d6F` (Borrower) | Race settled FIFO: Senior filled 2.0 USDC (Lender 1: 1.5, Lender 2: 0.5 + 1.0 refund), Junior filled 1.0 USDC (Lender 1: 1.0). Borrower proceeds: 3.0 USDC. |
| **6** | `24606125` | `Claimed` (Proceeds) | [`0x770a7775...5bd3c`](https://explorer.arc.io/tx/0x770a7775700a3832ccc6660b3ce4cf01ab1621ba5783b6517180286759f5bd3c) | `0x38dB...7d6F` (Borrower) | Claimed 3.00 USDC principal loan proceeds |
| **7** | `24606253` | `RepaymentMade` | [`0x2945233b...8768`](https://explorer.arc.io/tx/0x2945233be96c24df499f09c8f13787a7285c0a37032caaf38c38a488d54a8768) | `0x38dB...7d6F` (Borrower) | Initial repayment of 3.00 USDC: Senior satisfied 100% (2.20 USDC), Junior partially satisfied (0.80 / 1.20 USDC owed) |
| **8** | `24606366` | `Claimed` (Repayments) | [`0x7f26abc5...7956`](https://explorer.arc.io/tx/0x7f26abc5d435699d82c474bb0ade266a080e12f0a377189bff1764f07c567956) | `0xCCe8...f3A8` (Lender 1) | Claimed 2.45 USDC (1.65 USDC Senior payout + 0.80 USDC Junior payout) |
| **9** | `24606480` | `Claimed` (Refund+Payout) | [`0xa2864ac1...4555`](https://explorer.arc.io/tx/0xa2864ac11256e3701414bb70ffe82582d4f5dd6f5ef5838bf5fe10e72bff4555) | `0xb20A...dFA4` (Lender 2) | Claimed 1.55 USDC (1.00 USDC unaccepted refund + 0.55 USDC Senior payout) |
| **10** | `24685592` | `RepaymentMade` (Top-Up) | [`0x0bbeec49...969c`](https://explorer.arc.io/tx/0x0bbeec491272c46c509006cd3c30fe68786a4fa7e1a91474d2d8334997e6969c) | `0x38dB...7d6F` (Borrower) | Top-up repayment of 0.40 USDC, fully completing Junior tranche obligation (1.20 / 1.20 USDC repaid; 100% full settlement) |
| **11** | `24685882` | `Claimed` (Final Payout) | [`0xbb542449...8253`](https://explorer.arc.io/tx/0xbb5424497880e3d5bd537b4b1037c0a56a9c98e268aec03aa303ba6c26d28253) | `0xCCe8...f3A8` (Lender 1) | Claimed final 0.40 USDC Junior payout (cumulative claim: 2.85 USDC on 2.50 USDC principal) |

---

## ⚠️ Protocol Limits & Trust Assumptions

1. **Repayment is Not Enforced On-Chain:** ClaimLine acts as an on-chain priority settlement registry. Real-world legal custody, physical asset possession, and debt collection remain governed by off-chain legal contracts.
2. **Document Authenticity is Not Proven by the Registry:** The registry stores cryptographic hashes and metadata; it cannot independently verify off-chain document veracity without custodian/obligor attestations.
3. **Rounding Dust Stays in the Contract:** Due to integer division in proportional distribution calculations, negligible dust remainders (bounded under 10 wei-units / micro-USDC) remain within the contract balance to ensure contract solvency (`balanceOf(ClaimLine) >= totalOwed`).
4. **Non-Transferable Position Tokens in v1:** In v1, ERC-1155 tokens are non-transferable claim receipts, preventing claim accumulator desynchronization and secondary transfer race conditions.

---

## 🗺️ Roadmap (v1.1)

* **Transferable Secondary Positions:** Support peer-to-peer ERC-1155 transfers with continuous accumulator accounting and claim checkpoints.
* **Automated Liquidations & Collateral Oracles:** Integrate off-chain legal attestations and automated collateral liquidation triggers for delinquent obligors.
* **Multi-Tranche Customization (Mezzanine & Equity):** Expand beyond binary Senior/Junior tranches to arbitrary multi-tier waterfalls with variable tenors.
* **Institutional KYC / Permissioning Gates:** Optional custodian-gated compliance sidecars for institutional private credit syndications.

---

## 🔒 Security & Threat Model

Comprehensive threat model mitigations and automated fuzz invariant tests are documented in [`docs/SECURITY.md`](docs/SECURITY.md):
* **Over-Borrowing Prevention:** Enforced capacity bounds on registration and FIFO cap sealing.
* **Partial-Fill Debt Scaling:** Proportional debt calculation protects borrowers on under-subscribed races.
* **Blocked-Close Mitigation:** Receiver hooks bypassed via `_update`; pull-based claims protect against USDC blocklist reverts.
* **Anti-Squatting:** Obligor signature enforcement (`msg.sender == obligor`).
* **Anti-Dust Spamming:** Dynamic minimum lock bounds (`minLock`).

---

## 🧪 Testing & Verification

```bash
forge test --gas-report
```

---

## 📜 Acknowledgements & Credit

Inspired by the lien-priority concept of PRECEDENCE (Creditcoin hackathon); independent implementation, no code copied.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
