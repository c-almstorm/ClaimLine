# ClaimLine

**ClaimLine** is a decentralized lien-priority registry designed for Arc network, enabling transparent, deterministic priority-ordered claims and liens against assets denominated in USDC.

---

## 🌐 Live Arc Testnet Deployment & Verification

* **Contract Address:** [`0xeFCBD627341F70AED57d0099B030B06C40516279`](https://explorer.testnet.arc.io/address/0xeFCBD627341F70AED57d0099B030B06C40516279)
* **Status:** Verified (`Pass - Verified` on Blockscout / ArcScan)
* **Deployment Tx:** [`0xda5fda81e5bf51c52931e30062b4991bafadcbd451180fb78925aa734b265110`](https://explorer.testnet.arc.io/tx/0xda5fda81e5bf51c52931e30062b4991bafadcbd451180fb78925aa734b265110)
* **Evidence File:** [`evidence/testnet-run.json`](evidence/testnet-run.json)

### Verified Testnet Run Transactions:
| Step | Transaction Hash | Explorer Link | Summary |
| :--- | :--- | :--- | :--- |
| **1. Deploy Contract** | `0xda5f...5110` | [View Tx](https://explorer.testnet.arc.io/tx/0xda5fda81e5bf51c52931e30062b4991bafadcbd451180fb78925aa734b265110) | Deployed `ClaimLine` with USDC `0x36...00` |
| **2. Register Asset** | `0xd3f2...a798` | [View Tx](https://explorer.testnet.arc.io/tx/0xd3f2c08288c85ad0c72e3e5f3cf13157ce8f53bf51a2d85248c38c735047a798) | Face: 10 USDC, Senior: 6 USDC, Junior: 3 USDC |
| **3. Approve (Lender 1)** | `0x3b97...6fd0` | [View Tx](https://explorer.testnet.arc.io/tx/0x3b974665b76af3736d24da5109e484ea23a9ff304f3789ca87788082a11b6fd0) | Approved ClaimLine for USDC |
| **4. Approve (Lender 2)** | `0x65fe...83ad` | [View Tx](https://explorer.testnet.arc.io/tx/0x65fe7772d1d80d491113c3f009a556e1ed5e46ad94d653ed48845993c10083ad) | Approved ClaimLine for USDC |
| **5. Approve (Borrower)** | `0x6791...8e73` | [View Tx](https://explorer.testnet.arc.io/tx/0x679145371c6730dc49eaeb67e71a6c4ed066a1bcdd3530f496cfa4a384e28e73) | Approved ClaimLine for USDC |
| **6. Lock 1 (Lender 1)** | `0x016d...9039` | [View Tx](https://explorer.testnet.arc.io/tx/0x016d6cff8a1fc5343ab15bc227252ac5edd37f419e596c3ffc1db0dcac979039) | Locked 4.0 USDC in Senior tranche |
| **7. Lock 2 (Lender 2)** | `0xf874...4814` | [View Tx](https://explorer.testnet.arc.io/tx/0xf8745aa32587a6d76f1940cc0ff89c3518f979d66c786b667c97b0e985794814) | Locked 4.0 USDC in Senior (2 accepted, 2 refund) |
| **8. Lock 3 (Lender 1)** | `0x3b39...c9e0` | [View Tx](https://explorer.testnet.arc.io/tx/0x3b397020f5f1671398956d83bd6a7509478c5b8e4293b01816204f9db3b0c9e0) | Locked 3.0 USDC in Junior tranche |
| **9. Close Race** | `0xcee3...0f16` | [View Tx](https://explorer.testnet.arc.io/tx/0xcee3929fc0290509b2b72ee2d9932e06a3baf74f733aea1727abb0aec7c00f16) | Closed race & credited 9.0 USDC borrower proceeds |
| **10. Repay Partial** | `0x6720...ba7f` | [View Tx](https://explorer.testnet.arc.io/tx/0x6720deeaf3fb5d41f7e66ca3266b6a37652d23537a36978ccbebfd0840a7ba7f) | Repaid 7.0 USDC (6.6 Senior + 0.4 Junior) |
| **11. Claim (Borrower)** | `0x4d6d...5283` | [View Tx](https://explorer.testnet.arc.io/tx/0x4d6d9cb07dd7a0dfda45595518ba7d52cf40af7fc015f5748e9b76eefbfc5283) | Claimed 9.0 USDC proceeds |
| **12. Claim (Lender 1)** | `0xe6aa...ba08` | [View Tx](https://explorer.testnet.arc.io/tx/0xe6aa766f337ff86c5db9181bb87d43cf69c66e0c1eef257fdd658fe2047fba08) | Claimed 4.8 USDC repayment (4.4 Senior + 0.4 Junior) |
| **13. Claim (Lender 2)** | `0x08ea...af02` | [View Tx](https://explorer.testnet.arc.io/tx/0x08eaddb2db3505781b5bb5d8c3f9d03a748ec6ee6953d9ddc71b522fd5fdaf02) | Claimed 4.2 USDC (2.0 refund + 2.2 Senior repayment) |

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
