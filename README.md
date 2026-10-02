# ClaimLine

**ClaimLine** is a decentralized lien-priority registry designed for Arc network, enabling transparent, deterministic priority-ordered claims and liens against assets denominated in USDC.

---

## ⚡ Key Highlights
* **Native USDC Settlement:** Uses Arc's native USDC ERC-20 interface (`0x3600000000000000000000000000000000000000`) with standard 6-decimal precision.
* **Deterministic Priority Order:** Registered claims maintain immutable timestamps and senior/subordinate priority hierarchies.
* **Built for Arc Network:** Fully compatible with Arc's sub-second finality and Osaka/Cancun EVM execution environment.

---

## 📖 Documentation & Network Facts
Refer to [`docs/arc-facts.md`](docs/arc-facts.md) for network details:
* **Arc Mainnet Chain ID:** `5042` | RPC: `https://rpc.mainnet.arc.io` | Explorer: `https://explorer.arc.io`
* **Arc Testnet Chain ID:** `5042002` | RPC: `https://rpc.testnet.arc.io` | Explorer: `https://explorer.testnet.arc.io`
* **USDC Address (Mainnet & Testnet):** `0x3600000000000000000000000000000000000000` (ERC-20 interface, 6 decimals)

---

## 🚀 Testnet Deployment & Verification

* **Contract Name:** `ClaimLine`
* **Network:** Arc Testnet (Chain ID `5042002`)
* **Contract Address:** [`0xc33690cc821df614ba23c37dc3d3b448654363e3`](https://explorer.testnet.arc.io/address/0xc33690cc821df614ba23c37dc3d3b448654363e3#code)
* **Deployment Tx Hash:** [`0x8577b2e62359e3df42871de4823a40b3b818322d8ac737cf0f09072a5c1dd8c6`](https://explorer.testnet.arc.io/tx/0x8577b2e62359e3df42871de4823a40b3b818322d8ac737cf0f09072a5c1dd8c6)
* **Verification Status:** Verified on Blockscout Explorer

---

## 🛠️ Development & Testing

### Build
```bash
forge build
```

### Run Tests
```bash
forge test -vvv
```

### Deploy to Arc Testnet
```bash
forge script script/DeployClaimLine.s.sol:DeployClaimLine \
  --rpc-url https://rpc.drpc.testnet.arc.io \
  --broadcast
```

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
