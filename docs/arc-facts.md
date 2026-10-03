# Arc Network Facts & Configuration

This document lists network parameters, RPC endpoints, contract addresses, and token mechanics confirmed directly from the official Arc documentation.

---

## 1. Arc Mainnet Parameters

| Parameter | Value | Source URL | Status | Verification Summary |
| :--- | :--- | :--- | :--- | :--- |
| **Network Name** | Arc Mainnet | `https://docs.arc.network/connect-to-arc` | Verified | Official network name displayed in the connection guide. |
| **Chain ID** | `5042` | `https://docs.arc.network/connect-to-arc` | Verified | Arc Mainnet EVM chain ID is 5042. |
| **Primary RPC (HTTPS)** | `https://rpc.mainnet.arc.io` | `https://docs.arc.network/rpc-endpoints` | Verified | Public load-balanced HTTPS RPC endpoint. |
| **Primary RPC (WSS)** | `wss://rpc.mainnet.arc.io` | `https://docs.arc.network/rpc-endpoints` | Verified | Public WebSocket RPC endpoint. |
| **Block Explorer** | `https://explorer.arc.io` | `https://docs.arc.network/connect-to-arc` | Verified | Blockscout-powered official block explorer. |
| **Native Gas Token** | USDC (18 decimals native) | `https://docs.arc.io/arc/concepts/stablecoin-native-model` | Verified | Arc is a stablecoin-native Layer 1 using USDC as the native gas asset. |
| **Mainnet USDC Address** | `0x3600000000000000000000000000000000000000` | `https://docs.arc.io/arc/concepts/stablecoin-native-model` | Verified | ERC-20 interface for USDC token accounting and DeFi operations. |

### Alternative Managed RPC Providers
* **dRPC:** `https://rpc.drpc.mainnet.arc.io` — `https://docs.arc.network/rpc-endpoints` — **Verified** (Third-party RPC provider listed in docs)
* **Blockdaemon:** `https://rpc.blockdaemon.mainnet.arc.io` — `https://docs.arc.network/rpc-endpoints` — **Verified** (Third-party RPC provider listed in docs)
* **QuickNode:** `https://rpc.quicknode.mainnet.arc.io` — `https://docs.arc.network/rpc-endpoints` — **Verified** (Third-party RPC provider listed in docs)
* **Alchemy:** `https://arc-mainnet.g.alchemy.com/v2/YOUR_API_KEY` — `https://docs.arc.network/rpc-endpoints` — **Template, needs your own key** (Custom API key required)

---

## 2. Arc Testnet Parameters

| Parameter | Value | Source URL | Status | Verification Summary |
| :--- | :--- | :--- | :--- | :--- |
| **Network Name** | Arc Testnet | `https://docs.arc.network/connect-to-arc` | Verified | Official network name displayed in the connection guide. |
| **Chain ID** | `5042002` | `https://docs.arc.network/connect-to-arc` | Verified | Arc Testnet EVM chain ID is 5042002. |
| **Primary RPC (HTTPS)** | `https://rpc.testnet.arc.io` | `https://docs.arc.network/rpc-endpoints` | Verified | Public testnet HTTPS RPC endpoint. |
| **Fallback RPC (dRPC)** | `https://rpc.drpc.testnet.arc.io` | `https://docs.arc.network/rpc-endpoints` | Verified | Alternative testnet HTTPS RPC endpoint. |
| **Primary RPC (WSS)** | `wss://rpc.testnet.arc.io` | `https://docs.arc.network/rpc-endpoints` | Verified | Public testnet WebSocket RPC endpoint. |
| **Block Explorer** | `https://explorer.testnet.arc.io` | `https://docs.arc.network/connect-to-arc` | Verified | Blockscout-powered testnet block explorer. |
| **Testnet USDC Address** | `0x3600000000000000000000000000000000000000` | `https://docs.arc.io/arc/concepts/stablecoin-native-model` | Verified | Testnet ERC-20 system contract address for native USDC. |

---

## 3. USDC Token Architecture & Decimals (6 vs 18 Decimals)

Source URL: `https://docs.arc.io/arc/concepts/stablecoin-native-model`

### Architectural Summary:
* **Dual Interface Design:** Arc implements a dual-interface architecture for USDC sharing a unified underlying balance. The native EVM layer uses 18 decimals for gas fee execution and native transfers (`msg.value`), while the ERC-20 interface at `0x3600000000000000000000000000000000000000` uses standard 6 decimals (`10^6` units).
* **Native DeFi Compatibility:** Smart contracts interact directly with the ERC-20 interface at `0x3600000000000000000000000000000000000000` without requiring wrapped tokens (e.g. WUSDC or WETH).
* **Claimline Standard:** All Claimline accounting, capacities, repayments, and position balances operate in 6 decimals.
