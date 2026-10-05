# Arc Mainnet Deployment & Verification Guide

This document contains the step-by-step instructions, commands, and parameter verification for deploying **ClaimLine v1.0.0** to Arc Mainnet.

---

## 🔒 Code Freeze & Security Notice
* **Release Tag:** `v1.0.0`
* **Network Target:** Arc Mainnet (Chain ID `5042`)
* **Guard:** `DeployClaimLineMainnet.s.sol` requires `block.chainid == 5042`.
* **Private Key Security:** All deployment commands use Foundry's encrypted keystores (`--account`). No private keys or password files appear in any CLI command, shell history, or log file.

---

## 📖 Official Network Citations

All network values are cited directly from the official Arc documentation:

| Parameter | Official Value | Source URL | Verification Status |
| :--- | :--- | :--- | :--- |
| **Network Name** | Arc Mainnet | [`https://docs.arc.network/connect-to-arc`](https://docs.arc.network/connect-to-arc) | Verified |
| **Chain ID** | `5042` | [`https://docs.arc.network/connect-to-arc`](https://docs.arc.network/connect-to-arc) | Verified |
| **RPC Endpoint** | `https://rpc.mainnet.arc.io` | [`https://docs.arc.network/rpc-endpoints`](https://docs.arc.network/rpc-endpoints) | Verified |
| **Block Explorer** | `https://explorer.arc.io` | [`https://docs.arc.network/connect-to-arc`](https://docs.arc.network/connect-to-arc) | Verified |
| **Mainnet USDC Address** | `0x3600000000000000000000000000000000000000` | [`https://docs.arc.io/arc/concepts/stablecoin-native-model`](https://docs.arc.io/arc/concepts/stablecoin-native-model) | Verified |
| **Verifier API URL** | `https://explorer.arc.io/api` | [`https://docs.arc.network/tools/contract-verification`](https://docs.arc.network/tools/contract-verification) | Verified (Blockscout API) |

---

## ⚙️ Step 1: Import Mainnet Keystore Wallet

Import your funded deployment wallet into Foundry's encrypted keystore. You will be prompted securely to paste your private key and enter a password:

```bash
cast wallet import claimline-mainnet --interactive
```

Verify that the account was added:
```bash
cast wallet list
```

---

## 🧪 Step 2: Dry-Run / Simulation (No Broadcast)

Before executing on-chain, simulate the deployment against Arc Mainnet:

```bash
forge script script/DeployClaimLineMainnet.s.sol:DeployClaimLineMainnet \
  --rpc-url https://rpc.mainnet.arc.io \
  -vvv
```

### Verified Simulation Benchmark:
* **Chain ID:** `5042` (Arc Mainnet)
* **Constructor Argument:** `0x3600000000000000000000000000000000000000` (Native USDC)
* **Estimated Gas Used:** `2,981,847 gas`
* **Estimated Deployment Cost:** `~0.12 USDC` (at 40 gwei gas price)

---

## 🚀 Step 3: Broadcast & Verify to Arc Mainnet

When ready to deploy, run the broadcast command. Foundry will prompt you interactively in the terminal to enter the password for `claimline-mainnet`:

```bash
forge script script/DeployClaimLineMainnet.s.sol:DeployClaimLineMainnet \
  --rpc-url https://rpc.mainnet.arc.io \
  --account claimline-mainnet \
  --broadcast \
  --verify \
  --verifier-url https://explorer.arc.io/api
```

*(Note: Do not pass `--password-file`; type your password when prompted).*

---

## 🔍 Step 4: Standalone Verification (If needed)

If the explorer verification is delayed or needs to be rerun independently after broadcast:

```bash
forge verify-contract \
  <DEPLOYED_CLAIMLINE_ADDRESS> \
  src/ClaimLine.sol:ClaimLine \
  --verifier-url https://explorer.arc.io/api \
  --constructor-args $(cast abi-encode "constructor(address)" 0x3600000000000000000000000000000000000000) \
  --compiler-version 0.8.28 \
  --optimizer-runs 200 \
  --chain 5042
```

---

## 📋 Post-Deployment Checklist
1. Confirm the contract is marked `Verified` on `https://explorer.arc.io/address/<DEPLOYED_ADDRESS>`.
2. Commit the broadcast receipt at `broadcast/DeployClaimLineMainnet.s.sol/5042/run-latest.json`.
3. Update `README.md` with the mainnet contract address.
