# Arc Network Facts & Configuration

This document lists network parameters, RPC endpoints, contract addresses, and token mechanics confirmed directly from the official Arc documentation at [https://docs.arc.network](https://docs.arc.network).

---

## 1. Arc Mainnet Parameters

| Parameter | Value | Exact Live Docs URL | Status | Quoted Source Line / Verification Note |
| :--- | :--- | :--- | :--- | :--- |
| **Network Name** | Arc Mainnet | `https://docs.arc.network/connect-to-arc` | Verified | *"Arc Mainnet"* (Network Name in Connect to Arc table) |
| **Chain ID** | `5042` | `https://docs.arc.network/connect-to-arc` | Verified | *"Chain ID: 5042"* |
| **Primary RPC (HTTPS)** | `https://rpc.mainnet.arc.io` | `https://docs.arc.network/rpc-endpoints` | Verified | *"HTTPS: https://rpc.mainnet.arc.io"* |
| **Primary RPC (WSS)** | `wss://rpc.mainnet.arc.io` | `https://docs.arc.network/rpc-endpoints` | Verified | *"WSS: wss://rpc.mainnet.arc.io"* |
| **Block Explorer** | `https://explorer.arc.io` | `https://docs.arc.network/connect-to-arc` | Verified | *"Block Explorer: https://explorer.arc.io"* |
| **Native Gas Token** | USDC | `https://docs.arc.network/tokens/usdc` | Verified | *"USDC is used as the native gas token on Arc."* |
| **Mainnet USDC Address** | `0x3600000000000000000000000000000000000000` | `https://docs.arc.network/tokens/usdc` | Verified | *"ERC-20 Interface Address: 0x3600000000000000000000000000000000000000"* |

### Alternative Managed RPC Providers
* **dRPC:** `https://rpc.drpc.mainnet.arc.io` — `https://docs.arc.network/rpc-endpoints` — **Verified** (*"dRPC: https://rpc.drpc.mainnet.arc.io"*)
* **Blockdaemon:** `https://rpc.blockdaemon.mainnet.arc.io` — `https://docs.arc.network/rpc-endpoints` — **Verified** (*"Blockdaemon: https://rpc.blockdaemon.mainnet.arc.io"*)
* **QuickNode:** `https://rpc.quicknode.mainnet.arc.io` — `https://docs.arc.network/rpc-endpoints` — **Verified** (*"QuickNode: https://rpc.quicknode.mainnet.arc.io"*)
* **Alchemy:** `https://arc-mainnet.g.alchemy.com/v2/YOUR_API_KEY` — `https://docs.arc.network/rpc-endpoints` — **Template, needs your own key** (*"Alchemy: https://arc-mainnet.g.alchemy.com/v2/YOUR_API_KEY"*)

---

## 2. Arc Testnet Parameters

| Parameter | Value | Exact Live Docs URL | Status | Quoted Source Line / Verification Note |
| :--- | :--- | :--- | :--- | :--- |
| **Network Name** | Arc Testnet | `https://docs.arc.network/connect-to-arc` | Verified | *"Arc Testnet"* (Network Name in Connect to Arc table) |
| **Chain ID** | `5042002` | `https://docs.arc.network/connect-to-arc` | Verified | *"Chain ID: 5042002"* |
| **Primary RPC (HTTPS)** | `https://rpc.testnet.arc.io` | `https://docs.arc.network/rpc-endpoints` | Verified | *"HTTPS: https://rpc.testnet.arc.io"* |
| **Fallback RPC (dRPC)** | `https://rpc.drpc.testnet.arc.io` | `https://docs.arc.network/rpc-endpoints` | Verified | *"dRPC: https://rpc.drpc.testnet.arc.io"* |
| **Primary RPC (WSS)** | `wss://rpc.testnet.arc.io` | `https://docs.arc.network/rpc-endpoints` | Verified | *"WSS: wss://rpc.testnet.arc.io"* |
| **Block Explorer** | `https://explorer.testnet.arc.io` | `https://docs.arc.network/connect-to-arc` | Verified | *"Block Explorer: https://explorer.testnet.arc.io"* |
| **Testnet USDC Address** | `0x3600000000000000000000000000000000000000` | `https://docs.arc.network/tokens/usdc` | Verified | *"Testnet ERC-20 Address: 0x3600000000000000000000000000000000000000"* |

---

## 3. USDC Token Architecture & Decimals (6 vs 18 Decimals)

Source URL: [https://docs.arc.network/tokens/usdc](https://docs.arc.network/tokens/usdc)

### Confirmed Specifications & Quotes:
* **Dual Interface Architecture:**
  > *"USDC on Arc has two interfaces that share the same underlying balance: the native interface uses 18 decimals and is used for gas accounting, native sends, and msg.value; the ERC-20 interface uses 6 decimals and is available at address 0x3600000000000000000000000000000000000000 for application-level transfers, approvals, and allowances."* — **Verified** ([https://docs.arc.network/tokens/usdc](https://docs.arc.network/tokens/usdc))
* **Direct Integration Without Wrappers:**
  > *"There is no WETH-style wrapper; the USDC contract at 0x3600000000000000000000000000000000000000 should be used directly for ERC-20 interactions."* — **Verified** ([https://docs.arc.network/tokens/usdc](https://docs.arc.network/tokens/usdc))
* **Application Standard for Claimline:**
  All Claimline contracts interact exclusively with the **6-decimal ERC-20 interface** at `0x3600000000000000000000000000000000000000`.
