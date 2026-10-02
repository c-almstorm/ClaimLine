# Arc Network Facts & Configuration

This document lists network parameters, RPC endpoints, contract addresses, and token mechanics confirmed directly from the official Arc documentation at [docs.arc.network](https://docs.arc.network) (specifically the "Connect to Arc" and related network reference sections).

---

## 1. Arc Mainnet Parameters

| Parameter | Value | Source Link | Status |
| :--- | :--- | :--- | :--- |
| **Network Name** | Arc Mainnet | [https://docs.arc.network](https://docs.arc.network) | Verified |
| **Chain ID** | `5042` | [https://docs.arc.network/connect-to-arc](https://docs.arc.network) | Verified |
| **Primary RPC (HTTPS)** | `https://rpc.mainnet.arc.io` | [https://docs.arc.network/rpc-endpoints](https://docs.arc.network) | Verified |
| **Primary RPC (WSS)** | `wss://rpc.mainnet.arc.io` | [https://docs.arc.network/rpc-endpoints](https://docs.arc.network) | Verified |
| **Block Explorer** | [https://explorer.arc.io](https://explorer.arc.io) | [https://docs.arc.network/connect-to-arc](https://docs.arc.network) | Verified |
| **Native Gas Token** | USDC (18 decimals native) | [https://docs.arc.network/connect-to-arc](https://docs.arc.network) | Verified |
| **Mainnet USDC Address** | `0x3600000000000000000000000000000000000000` | [https://docs.arc.network/tokens/usdc](https://docs.arc.network) | Verified |

### Alternative Managed RPC Providers
* **dRPC:** `https://rpc.drpc.mainnet.arc.io` — [Source](https://docs.arc.network) (Verified)
* **Blockdaemon:** `https://rpc.blockdaemon.mainnet.arc.io` — [Source](https://docs.arc.network) (Verified)
* **QuickNode:** `https://rpc.quicknode.mainnet.arc.io` — [Source](https://docs.arc.network) (Verified)
* **Alchemy:** `https://arc-mainnet.g.alchemy.com/v2/YOUR_API_KEY` — [Source](https://docs.arc.network) (Verified)

---

## 2. Arc Testnet Parameters

| Parameter | Value | Source Link | Status |
| :--- | :--- | :--- | :--- |
| **Network Name** | Arc Testnet | [https://docs.arc.network](https://docs.arc.network) | Verified |
| **Chain ID** | `5042002` | [https://docs.arc.network/connect-to-arc](https://docs.arc.network) | Verified |
| **Primary RPC (HTTPS)** | `https://rpc.testnet.arc.io` | [https://docs.arc.network/rpc-endpoints](https://docs.arc.network) | Verified |
| **Fallback RPC (dRPC)** | `https://rpc.drpc.testnet.arc.io` | [https://docs.arc.network/rpc-endpoints](https://docs.arc.network) | Verified |
| **Primary RPC (WSS)** | `wss://rpc.testnet.arc.io` | [https://docs.arc.network/rpc-endpoints](https://docs.arc.network) | Verified |
| **Block Explorer** | [https://explorer.testnet.arc.io](https://explorer.testnet.arc.io) | [https://docs.arc.network/connect-to-arc](https://docs.arc.network) | Verified |
| **Testnet USDC Address** | `0x3600000000000000000000000000000000000000` | [https://docs.arc.network/tokens/usdc](https://docs.arc.network) | Verified |

---

## 3. USDC Token Architecture & Decimals

Arc is a stablecoin-native Layer 1 blockchain where **USDC is the native gas token**.

* **Dual Interface Specification:**
  * **Native EVM Balance (Gas):** 18 decimals (`10^18` wei units) used internally by the EVM for gas execution. — [Source](https://docs.arc.network) (Verified)
  * **ERC-20 Interface (Contract/Tokens):** 6 decimals (`10^6` units) accessible at system address `0x3600000000000000000000000000000000000000`. — [Source](https://docs.arc.network) (Verified)
* **Smart Contract Standard:** All smart contracts must interact with USDC via its **ERC-20 interface (6 decimals)** for accounting, deposits, lien amounts, and transfers without wrapped token adapters.

---

## 4. Contract Verification

* **Verifier:** Blockscout
* **Verifier URL (Testnet):** `https://explorer.testnet.arc.io/api/` — [Source](https://docs.arc.network) (Verified)
* **Verifier URL (Mainnet):** `https://explorer.arc.io/api/` — [Source](https://docs.arc.network) (Verified)

---

## Source References
* Official Documentation: [https://docs.arc.network](https://docs.arc.network)
* Connect to Arc: [https://docs.arc.network/connect-to-arc](https://docs.arc.network)
* RPC Endpoints: [https://docs.arc.network/rpc-endpoints](https://docs.arc.network)
