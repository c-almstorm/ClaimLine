import { defineChain, parseAbi, type Chain } from 'viem';

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
  claimLineAddress: `0x${string}`;
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
    claimLineAddress: '0x5b73C5498c1E3b4dbA84de0F1833c4a029d90519', // Pending mainnet deploy
    usdcAddress: '0x3600000000000000000000000000000000000000',
    deploymentBlock: 0n,
  },
};

export const DEFAULT_CHAIN_ID = 5042002;

export const CLAIMLINE_ABI = parseAbi([
  'function assets(bytes32 assetId) external view returns ((bytes32 assetId, address borrower, uint256 faceValue, uint256 seniorCapacity, uint256 juniorCapacity, uint256 seniorRepaymentOwed, uint256 juniorRepaymentOwed, uint256 minLock, uint256 deadline, uint8 state, uint256 lockCount, uint256 totalSeniorAccepted, uint256 totalJuniorAccepted, uint256 seniorRepaid, uint256 juniorRepaid))',
  'function getAssetLocks(bytes32 assetId) external view returns ((address lender, uint256 amount, uint8 tranche, uint256 sequenceNumber)[])',
  'function getPendingClaim(bytes32 assetId, address account) external view returns (uint256 refund, uint256 proceeds, uint256 seniorPayout, uint256 juniorPayout, uint256 totalClaim)',
  'function getRepayments(bytes32 assetId) external view returns (uint256 seniorRepaid, uint256 juniorRepaid)',
  'function registerAsset(string assetType, string docId, address custodian, address obligor, uint256 faceValue, uint256 seniorCapacity, uint256 juniorCapacity, uint256 seniorRepaymentOwed, uint256 juniorRepaymentOwed, uint256 deadline) external returns (bytes32)',
  'function lock(bytes32 assetId, uint256 amount, uint8 tranche) external',
  'function close(bytes32 assetId) external',
  'function repay(bytes32 assetId, uint256 amount) external',
  'function claim(bytes32 assetId) external',
  'function MAX_LOCKS() external view returns (uint256)',
  'event AssetRegistered(bytes32 indexed assetId, address indexed borrower, string assetType, string docId, address custodian, address obligor, uint256 faceValue, uint256 seniorCapacity, uint256 juniorCapacity, uint256 seniorRepaymentOwed, uint256 juniorRepaymentOwed, uint256 minLock, uint256 deadline)',
  'event LockPlaced(bytes32 indexed assetId, address indexed lender, uint8 indexed tranche, uint256 amount, uint256 sequenceNumber)',
  'event AssetClosed(bytes32 indexed assetId, uint256 totalSeniorAccepted, uint256 totalJuniorAccepted, uint256 borrowerProceeds, uint256 seniorRepaymentOwedScaled, uint256 juniorRepaymentOwedScaled)',
  'event RepaymentMade(bytes32 indexed assetId, address indexed payer, uint256 amount, uint256 seniorRepaid, uint256 juniorRepaid)',
  'event Claimed(bytes32 indexed assetId, address indexed account, uint256 refundAmount, uint256 proceedsAmount, uint256 seniorRepaymentAmount, uint256 juniorRepaymentAmount, uint256 totalClaimed)',
]);

export const ERC20_ABI = parseAbi([
  'function balanceOf(address account) external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);
