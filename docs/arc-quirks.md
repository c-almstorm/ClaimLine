# Arc EVM Differences & Protocol Quirks

This document outlines protocol behaviors, gas fee designs, and EVM differences on Arc Network (based on [https://docs.arc.network/evm-differences](https://docs.arc.network/evm-differences) and [https://docs.arc.network/gas-and-fees](https://docs.arc.network/gas-and-fees)) and how they directly influence Claimline architecture.

---

## 1. Blocklist Enforcement & Pull-Based Architecture

### Official Rule & Quote:
> *"Any value transfer to or from a blocklisted address will trigger a revert at the runtime level. A transaction that reverts due to a blocklist check still consumes gas."* — [https://docs.arc.network/evm-differences](https://docs.arc.network/evm-differences)

### Architectural Impact on Claimline:
* **The Vulnerability of Push Payouts:** In traditional push-based repayment or refund loops, if even a single lender address becomes blocklisted by Circle / Arc compliance, any transaction attempting to push USDC to that lender would unconditionally revert. This would permanently stall the waterfall and freeze funds for all other honest participants.
* **Claimline Solution (Pull-Based Claims):** Claimline enforces **pull-based withdrawals (`claim(assetId)`)**. Refunds and waterfall repayments are recorded in contract storage; each lender or borrower independently pulls their entitled USDC. A blocked address cannot halt or impact others.

---

## 2. Gas & Fee Economics (USDC Native Gas)

### Official Rule & Quote:
> *"Arc uses an Exponentially Weighted Moving Average (EWMA) to smooth out base fee fluctuations, preventing sharp fee spikes during demand bursts. Any account performing transactions must hold enough USDC to cover both transfer value and gas fees."* — [https://docs.arc.network/gas-and-fees](https://docs.arc.network/gas-and-fees)

### Architectural Impact on Claimline:
* **Gas Predictability:** Gas costs are denominated in USDC and exhibit low volatility, ensuring predictable execution costs for lenders locking capital.
* **Cap on Iterations:** Claimline caps locks per asset at **32 locks** (`MAX_LOCKS = 32`). This guarantees constant, predictable, low gas consumption during `close(assetId)` settlement.

---

## 3. Dual Interface & 6-Decimal Precision

### Official Rule & Quote:
> *"The native interface uses 18 decimals and is used for gas accounting... while the ERC-20 interface uses 6 decimals and is available at address 0x3600000000000000000000000000000000000000 for application-level transfers."* — [https://docs.arc.network/tokens/usdc](https://docs.arc.network/tokens/usdc)

### Architectural Impact on Claimline:
* **No Wrapped Adapters:** No `WUSDC` or `WETH` adapters are used.
* **Strict 6-Decimal Math:** All capacities, lock amounts, refunds, fixed repayment debts, and payouts are calculated in 6-decimal integer units (`1 USDC = 1_000_000`).
