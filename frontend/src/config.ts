import { defineChain, parseAbi, type Chain } from 'viem';
import { CLAIMLINE_ABI } from './abi/ClaimLineAbi';

export { CLAIMLINE_ABI };

export const arcMainnet = defineChain({
  id: 5042,
  name: 'Arc Mainnet',
  network: 'arc-mainnet',
  nativeCurrency: {
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://rpc.mainnet.arc.io'] },
    public: { http: ['https://rpc.mainnet.arc.io'] },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://explorer.arc.io' },
  },
});

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  network: 'arc-testnet',
  nativeCurrency: {
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.io'] },
    public: { http: ['https://rpc.testnet.arc.io'] },
  },
  blockExplorers: {
    default: { name: 'Arc Testnet Explorer', url: 'https://explorer.testnet.arc.io' },
  },
});

export type ChainConfig = Chain & {
  blockExplorers: {
    default: { name: string; url: string };
  };
  claimLineAddress: `0x${string}` | '';
  usdcAddress: `0x${string}`;
  deploymentBlock: bigint;
};

export const CHAINS_CONFIG: Record<number, ChainConfig> = {
  5042002: {
    ...arcTestnet,
    blockExplorers: {
      default: { name: 'Arc Testnet Explorer', url: 'https://explorer.testnet.arc.io' },
    },
    claimLineAddress: '0xeFCBD627341F70AED57d0099B030B06C40516279',
    usdcAddress: '0x3600000000000000000000000000000000000000',
    deploymentBlock: 65571537n,
  },
  5042: {
    ...arcMainnet,
    blockExplorers: {
      default: { name: 'Arc Explorer', url: 'https://explorer.arc.io' },
    },
    claimLineAddress: '', // Not deployed yet
    usdcAddress: '0x3600000000000000000000000000000000000000',
    deploymentBlock: 0n,
  },
};

export const DEFAULT_CHAIN_ID = 5042002;

export const ERC20_ABI = parseAbi([
  'function balanceOf(address account) external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

