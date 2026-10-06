import React, { useState, useEffect, useCallback } from 'react';
import {
  formatUnits,
  parseUnits,
  type PublicClient,
  type WalletClient,
  maxUint256,
} from 'viem';
import {
  Shield,
  Lock,
  Layers,
  Clock,
  Coins,
  ArrowRight,
  CheckCircle,
  ExternalLink,
  DollarSign,
  AlertCircle,
  Sparkles,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { ChainConfig, CLAIMLINE_ABI, ERC20_ABI } from '../config';
import { TxState } from './TxModal';

export interface AssetData {
  assetId: `0x${string}`;
  borrower: `0x${string}`;
  faceValue: bigint;
  seniorCapacity: bigint;
  juniorCapacity: bigint;
  seniorRepaymentOwed: bigint;
  juniorRepaymentOwed: bigint;
  minLock: bigint;
  deadline: bigint;
  state: number;
  lockCount: bigint;
  totalSeniorAccepted: bigint;
  totalJuniorAccepted: bigint;
  seniorRepaid: bigint;
  juniorRepaid: bigint;
}

export interface LockRecord {
  lender: `0x${string}`;
  amount: bigint;
  tranche: number;
  sequenceNumber: bigint;
}

export interface PendingClaimData {
  refund: bigint;
  proceeds: bigint;
  seniorPayout: bigint;
  juniorPayout: bigint;
  totalClaim: bigint;
}

interface AssetDetailProps {
  assetId: `0x${string}`;
  activeConfig: ChainConfig;
  userAddress: `0x${string}` | null;
  publicClient: PublicClient;
  blockTrigger: number;
  getWalletClient: () => WalletClient | null;
  onRefreshBalances: () => void;
  setTxState: React.Dispatch<React.SetStateAction<TxState>>;
}

export const AssetDetail: React.FC<AssetDetailProps> = ({
  assetId,
  activeConfig,
  userAddress,
  publicClient,
  blockTrigger,
  getWalletClient,
  onRefreshBalances,
  setTxState,
}) => {
  const [asset, setAsset] = useState<AssetData | null>(null);
  const [locks, setLocks] = useState<LockRecord[]>([]);
  const [pendingClaim, setPendingClaim] = useState<PendingClaimData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form states
  const [lockAmountUSDC, setLockAmountUSDC] = useState<string>('');
  const [lockTranche, setLockTranche] = useState<number>(0);
  const [repayAmountUSDC, setRepayAmountUSDC] = useState<string>('');

  const fetchAssetDetails = useCallback(async () => {
    if (!activeConfig.claimLineAddress) {
      setAsset(null);
      setLocks([]);
      setPendingClaim(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setLoadError(null);

      const [rawAsset, rawLocks] = await Promise.all([
        publicClient.readContract({
          address: activeConfig.claimLineAddress,
          abi: CLAIMLINE_ABI,
          functionName: 'assets',
          args: [assetId],
        }) as Promise<any>,
        publicClient.readContract({
          address: activeConfig.claimLineAddress,
          abi: CLAIMLINE_ABI,
          functionName: 'getAssetLocks',
          args: [assetId],
        }) as Promise<any>,
      ]);

      if (!rawAsset) {
        setAsset(null);
        setLoading(false);
        return;
      }

      const borrower = (rawAsset.borrower || rawAsset[1] || '0x0000000000000000000000000000000000000000') as `0x${string}`;
      const faceValue = BigInt(rawAsset.faceValue ?? rawAsset[2] ?? 0n);

      if (faceValue === 0n && borrower === '0x0000000000000000000000000000000000000000') {
        setAsset(null);
        setLoading(false);
        return;
      }

      const formattedAsset: AssetData = {
        assetId: (rawAsset.assetId || rawAsset[0] || assetId) as `0x${string}`,
        borrower,
        faceValue,
        seniorCapacity: BigInt(rawAsset.seniorCapacity ?? rawAsset[3] ?? 0n),
        juniorCapacity: BigInt(rawAsset.juniorCapacity ?? rawAsset[4] ?? 0n),
        seniorRepaymentOwed: BigInt(rawAsset.seniorRepaymentOwed ?? rawAsset[5] ?? 0n),
        juniorRepaymentOwed: BigInt(rawAsset.juniorRepaymentOwed ?? rawAsset[6] ?? 0n),
        minLock: BigInt(rawAsset.minLock ?? rawAsset[7] ?? 0n),
        deadline: BigInt(rawAsset.deadline ?? rawAsset[8] ?? 0n),
        state: Number(rawAsset.state ?? rawAsset[9] ?? 0),
        lockCount: BigInt(rawAsset.lockCount ?? rawAsset[10] ?? 0n),
        totalSeniorAccepted: BigInt(rawAsset.totalSeniorAccepted ?? rawAsset[11] ?? 0n),
        totalJuniorAccepted: BigInt(rawAsset.totalJuniorAccepted ?? rawAsset[12] ?? 0n),
        seniorRepaid: BigInt(rawAsset.seniorRepaid ?? rawAsset[13] ?? 0n),
        juniorRepaid: BigInt(rawAsset.juniorRepaid ?? rawAsset[14] ?? 0n),
      };

      setAsset(formattedAsset);

      if (Array.isArray(rawLocks)) {
        setLocks(
          rawLocks.map((l: any, idx: number) => ({
            lender: (l.lender || l[0] || '0x0000000000000000000000000000000000000000') as `0x${string}`,
            amount: BigInt(l.amount ?? l[1] ?? 0n),
            tranche: Number(l.tranche ?? l[2] ?? 0),
            sequenceNumber: BigInt(l.sequenceNumber ?? l[3] ?? idx + 1),
          }))
        );
      } else {
        setLocks([]);
      }

      if (userAddress) {
        try {
          const rawClaim = (await publicClient.readContract({
            address: activeConfig.claimLineAddress,
            abi: CLAIMLINE_ABI,
            functionName: 'getPendingClaim',
            args: [assetId, userAddress],
          })) as any;

          if (rawClaim) {
            setPendingClaim({
              refund: BigInt(rawClaim.refund ?? rawClaim[0] ?? 0n),
              proceeds: BigInt(rawClaim.proceeds ?? rawClaim[1] ?? 0n),
              seniorPayout: BigInt(rawClaim.seniorPayout ?? rawClaim[2] ?? 0n),
              juniorPayout: BigInt(rawClaim.juniorPayout ?? rawClaim[3] ?? 0n),
              totalClaim: BigInt(rawClaim.totalClaim ?? rawClaim[4] ?? 0n),
            });
          }
        } catch (e) {
          console.warn('getPendingClaim failed:', e);
          setPendingClaim(null);
        }
      }
    } catch (err: any) {
      console.error('Error loading asset details:', err);
      setLoadError(err?.shortMessage || err?.message || 'Could not load asset data from RPC, retrying...');
    } finally {
      setLoading(false);
    }
  }, [assetId, activeConfig, userAddress, publicClient]);

  useEffect(() => {
    fetchAssetDetails();
  }, [fetchAssetDetails, blockTrigger]);

  const ensureAllowance = async (amount: bigint) => {
    if (!userAddress) throw new Error('Wallet not connected');
    if (!activeConfig.claimLineAddress) throw new Error('Contract not deployed on this network');
    const contractAddress = activeConfig.claimLineAddress as `0x${string}`;
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('Wallet not available');

    const currentAllowance = (await publicClient.readContract({
      address: activeConfig.usdcAddress,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [userAddress, contractAddress],
    })) as bigint;

    if (currentAllowance < amount) {
      setTxState({
        isOpen: true,
        status: 'approving',
        title: 'Approving USDC',
        description: 'Please approve USDC transfer in your wallet...',
      });

      const approveTx = await walletClient.writeContract({
        address: activeConfig.usdcAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [contractAddress, maxUint256],
        account: userAddress,
        chain: activeConfig,
      });

      setTxState((prev) => ({
        ...prev,
        txHash: approveTx,
        description: 'Waiting for USDC approval confirmation...',
      }));

      await publicClient.waitForTransactionReceipt({ hash: approveTx });
    }
  };

  const handleLock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAddress || !activeConfig.claimLineAddress) return;
    const contractAddress = activeConfig.claimLineAddress as `0x${string}`;
    const walletClient = getWalletClient();
    if (!walletClient) return;

    try {
      const amountUnits = parseUnits(lockAmountUSDC, 6);
      if (amountUnits <= 0n) return;

      await ensureAllowance(amountUnits);

      setTxState({
        isOpen: true,
        status: 'pending',
        title: 'Placing Priority Lock',
        description: `Escrowing ${lockAmountUSDC} USDC into ${lockTranche === 0 ? 'Senior' : 'Junior'} tranche...`,
      });

      const tx = await walletClient.writeContract({
        address: contractAddress,
        abi: CLAIMLINE_ABI,
        functionName: 'lock',
        args: [assetId, amountUnits, lockTranche],
        account: userAddress,
        chain: activeConfig,
      });

      setTxState((prev) => ({
        ...prev,
        txHash: tx,
        description: 'Waiting for lock transaction confirmation...',
      }));

      await publicClient.waitForTransactionReceipt({ hash: tx });

      setTxState({
        isOpen: true,
        status: 'success',
        title: 'Lock Placed Successfully',
        description: `Successfully locked ${lockAmountUSDC} USDC in FIFO sequence queue.`,
        txHash: tx,
      });

      setLockAmountUSDC('');
      fetchAssetDetails();
      onRefreshBalances();
    } catch (err: any) {
      console.error('Lock failed:', err);
      setTxState({
        isOpen: true,
        status: 'error',
        title: 'Lock Failed',
        description: 'Failed to place escrow lock.',
        errorMessage: err?.shortMessage || err?.message || 'Transaction failed',
      });
    }
  };

  const handleClose = async () => {
    if (!userAddress || !activeConfig.claimLineAddress) return;
    const contractAddress = activeConfig.claimLineAddress as `0x${string}`;
    const walletClient = getWalletClient();
    if (!walletClient) return;

    try {
      setTxState({
        isOpen: true,
        status: 'pending',
        title: 'Closing Priority Race',
        description: 'Executing deterministic FIFO allocation and issuing position tokens...',
      });

      const tx = await walletClient.writeContract({
        address: contractAddress,
        abi: CLAIMLINE_ABI,
        functionName: 'close',
        args: [assetId],
        account: userAddress,
        chain: activeConfig,
      });

      setTxState((prev) => ({
        ...prev,
        txHash: tx,
        description: 'Waiting for race closing confirmation...',
      }));

      await publicClient.waitForTransactionReceipt({ hash: tx });

      setTxState({
        isOpen: true,
        status: 'success',
        title: 'Race Closed Successfully',
        description: 'Principal allocated in FIFO sequence order. Proceeds & refunds claimable.',
        txHash: tx,
      });

      fetchAssetDetails();
      onRefreshBalances();
    } catch (err: any) {
      console.error('Close race failed:', err);
      setTxState({
        isOpen: true,
        status: 'error',
        title: 'Closing Failed',
        description: 'Failed to close priority race.',
        errorMessage: err?.shortMessage || err?.message || 'Transaction failed',
      });
    }
  };

  const handleRepay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAddress || !activeConfig.claimLineAddress) return;
    const contractAddress = activeConfig.claimLineAddress as `0x${string}`;
    const walletClient = getWalletClient();
    if (!walletClient) return;

    try {
      const amountUnits = parseUnits(repayAmountUSDC, 6);
      if (amountUnits <= 0n) return;

      await ensureAllowance(amountUnits);

      setTxState({
        isOpen: true,
        status: 'pending',
        title: 'Depositing Repayment',
        description: `Executing ${repayAmountUSDC} USDC waterfall repayment...`,
      });

      const tx = await walletClient.writeContract({
        address: contractAddress,
        abi: CLAIMLINE_ABI,
        functionName: 'repay',
        args: [assetId, amountUnits],
        account: userAddress,
        chain: activeConfig,
      });

      setTxState((prev) => ({
        ...prev,
        txHash: tx,
        description: 'Waiting for repayment confirmation on Arc...',
      }));

      await publicClient.waitForTransactionReceipt({ hash: tx });

      setTxState({
        isOpen: true,
        status: 'success',
        title: 'Repayment Completed',
        description: `${repayAmountUSDC} USDC deposited into seniority waterfall.`,
        txHash: tx,
      });

      setRepayAmountUSDC('');
      fetchAssetDetails();
      onRefreshBalances();
    } catch (err: any) {
      console.error('Repayment failed:', err);
      setTxState({
        isOpen: true,
        status: 'error',
        title: 'Repayment Failed',
        description: 'Repayment transaction failed.',
        errorMessage: err?.shortMessage || err?.message || 'Transaction failed',
      });
    }
  };

  const handleClaim = async () => {
    if (!userAddress || !activeConfig.claimLineAddress) return;
    const contractAddress = activeConfig.claimLineAddress as `0x${string}`;
    const walletClient = getWalletClient();
    if (!walletClient) return;

    try {
      setTxState({
        isOpen: true,
        status: 'pending',
        title: 'Claiming Payouts',
        description: 'Withdrawing pending proceeds, refunds, and repayment payouts...',
      });

      const tx = await walletClient.writeContract({
        address: contractAddress,
        abi: CLAIMLINE_ABI,
        functionName: 'claim',
        args: [assetId],
        account: userAddress,
        chain: activeConfig,
      });

      setTxState((prev) => ({
        ...prev,
        txHash: tx,
        description: 'Waiting for claim withdrawal confirmation...',
      }));

      await publicClient.waitForTransactionReceipt({ hash: tx });

      setTxState({
        isOpen: true,
        status: 'success',
        title: 'Claim Successful',
        description: 'Funds successfully withdrawn to your wallet!',
        txHash: tx,
      });

      fetchAssetDetails();
      onRefreshBalances();
    } catch (err: any) {
      console.error('Claim failed:', err);
      setTxState({
        isOpen: true,
        status: 'error',
        title: 'Claim Failed',
        description: 'Failed to claim payouts.',
        errorMessage: err?.shortMessage || err?.message || 'Transaction failed',
      });
    }
  };

  if (loading && !asset && !loadError) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
        <p className="text-sm text-slate-500 font-medium">Loading asset parameters and on-chain lock history...</p>
      </div>
    );
  }

  if (loadError && !asset) {
    return (
      <div className="bg-white rounded-2xl border border-amber-200 p-8 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
        <p className="text-sm font-semibold text-slate-900">RPC Busy or Network Error</p>
        <p className="text-xs text-slate-500 font-mono">{loadError}</p>
        <button
          onClick={fetchAssetDetails}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Loading</span>
        </button>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
        <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
        <p className="text-sm font-semibold text-slate-900">Asset Not Found</p>
        <p className="text-xs text-slate-500 font-mono break-all">{assetId}</p>
      </div>
    );
  }

  const deadlineMs = Number(asset.deadline ?? 0n) * 1000;
  const deadlineDate = new Date(deadlineMs);
  const isExpired = Date.now() > deadlineMs;
  const isBorrower = userAddress ? userAddress.toLowerCase() === asset.borrower.toLowerCase() : false;
  const canClose = asset.state === 1 && (isBorrower || isExpired);

  const seniorAccepted = formatUnits(asset.totalSeniorAccepted ?? 0n, 6);
  const seniorCap = formatUnits(asset.seniorCapacity ?? 0n, 6);
  const juniorAccepted = formatUnits(asset.totalJuniorAccepted ?? 0n, 6);
  const juniorCap = formatUnits(asset.juniorCapacity ?? 0n, 6);

  const seniorRepaid = formatUnits(asset.seniorRepaid ?? 0n, 6);
  const seniorRepayOwed = formatUnits(asset.seniorRepaymentOwed ?? 0n, 6);
  const juniorRepaid = formatUnits(asset.juniorRepaid ?? 0n, 6);
  const juniorRepayOwed = formatUnits(asset.juniorRepaymentOwed ?? 0n, 6);

  const totalOwed = (asset.seniorRepaymentOwed ?? 0n) + (asset.juniorRepaymentOwed ?? 0n);
  const totalRepaid = (asset.seniorRepaid ?? 0n) + (asset.juniorRepaid ?? 0n);
  const isFullyRepaid = totalOwed > 0n && totalRepaid >= totalOwed;

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-slate-400">Asset ID:</span>
              <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                {asset.assetId.slice(0, 10)}...{asset.assetId.slice(-8)}
              </span>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                  asset.state === 1
                    ? 'bg-emerald-100 text-emerald-800'
                    : asset.state === 2
                    ? isFullyRepaid
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {asset.state === 1
                  ? '🟢 Open for Locks'
                  : asset.state === 2
                  ? isFullyRepaid
                    ? '✅ Fully repaid'
                    : '🔄 Closed, repaying'
                  : 'None'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Borrower:</span>
              <a
                href={`${activeConfig.blockExplorers.default.url}/address/${asset.borrower}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                {asset.borrower.slice(0, 6)}...{asset.borrower.slice(-4)}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-slate-400">Document Face Value</div>
            <div className="text-xl font-bold text-slate-900">{formatUnits(asset.faceValue ?? 0n, 6)} USDC</div>
          </div>
        </div>

        {/* Capacity Progress */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {/* Senior Tranche */}
          <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-blue-900 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-blue-600" />
                Senior Tranche (Priority 1)
              </span>
              <span className="text-slate-500">
                {seniorAccepted} / {seniorCap} USDC
              </span>
            </div>
            <div className="w-full bg-blue-200/50 h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all"
                style={{
                  width: `${
                    Number(asset.seniorCapacity ?? 0n) > 0
                      ? Math.min(100, (Number(asset.totalSeniorAccepted ?? 0n) / Number(asset.seniorCapacity)) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 pt-1">
              <span>Repayment Owed: {seniorRepayOwed} USDC</span>
              <span className="text-emerald-700 font-medium">Repaid: {seniorRepaid} USDC</span>
            </div>
          </div>

          {/* Junior Tranche */}
          <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-purple-900 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-600" />
                Junior Tranche (Priority 2)
              </span>
              <span className="text-slate-500">
                {juniorAccepted} / {juniorCap} USDC
              </span>
            </div>
            <div className="w-full bg-purple-200/50 h-2 rounded-full overflow-hidden">
              <div
                className="bg-purple-600 h-full rounded-full transition-all"
                style={{
                  width: `${
                    Number(asset.juniorCapacity ?? 0n) > 0
                      ? Math.min(100, (Number(asset.totalJuniorAccepted ?? 0n) / Number(asset.juniorCapacity)) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 pt-1">
              <span>Repayment Owed: {juniorRepayOwed} USDC</span>
              <span className="text-emerald-700 font-medium">Repaid: {juniorRepaid} USDC</span>
            </div>
          </div>
        </div>

        {/* Parameters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-400 block mb-0.5">Min Lock Size</span>
            <span className="font-bold text-slate-800">{formatUnits(asset.minLock ?? 0n, 6)} USDC</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-400 block mb-0.5">Locks Placed</span>
            <span className="font-bold text-slate-800">{Number(asset.lockCount ?? 0n)} / 32</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-400 block mb-0.5">Lock Deadline</span>
            <span className={`font-bold ${isExpired ? 'text-rose-600' : 'text-slate-800'}`}>
              {deadlineDate.toLocaleDateString()} {deadlineDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-400 block mb-0.5">Repayment Due Date</span>
            <span className="font-medium text-slate-600 italic">not enforced in v1</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-400 block mb-0.5">Status</span>
            <span className="font-bold text-slate-800">
              {asset.state === 2
                ? isFullyRepaid
                  ? 'Fully repaid'
                  : 'Closed, repaying'
                : isExpired
                ? 'Deadline Passed'
                : 'Active Escrow'}
            </span>
          </div>
        </div>
      </div>

      {/* User Claims Banner (if any) */}
      {userAddress && pendingClaim && pendingClaim.totalClaim > 0n && (
        <div className="p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1 text-left w-full sm:w-auto">
            <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>You Have Claimable USDC Payouts</span>
            </div>
            <div className="text-xs text-emerald-800 flex flex-wrap gap-x-4 gap-y-1">
              {pendingClaim.refund > 0n && <span>Refund: <strong>{formatUnits(pendingClaim.refund, 6)} USDC</strong></span>}
              {pendingClaim.proceeds > 0n && <span>Proceeds: <strong>{formatUnits(pendingClaim.proceeds, 6)} USDC</strong></span>}
              {pendingClaim.seniorPayout > 0n && <span>Senior Payout: <strong>{formatUnits(pendingClaim.seniorPayout, 6)} USDC</strong></span>}
              {pendingClaim.juniorPayout > 0n && <span>Junior Payout: <strong>{formatUnits(pendingClaim.juniorPayout, 6)} USDC</strong></span>}
            </div>
          </div>
          <button
            onClick={handleClaim}
            className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all whitespace-nowrap"
          >
            Claim {formatUnits(pendingClaim.totalClaim, 6)} USDC
          </button>
        </div>
      )}

      {/* Action Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Place Lock Action (Lenders) */}
        {asset.state === 1 && !isExpired && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Lock className="w-4 h-4 text-blue-600" />
              <span>Place Escrow Lock</span>
            </div>
            <p className="text-xs text-slate-500">
              Locks are allocated in deterministic FIFO sequence order. Minimum lock requirement: <strong>{formatUnits(asset.minLock ?? 0n, 6)} USDC</strong>.
            </p>

            <form onSubmit={handleLock} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tranche Selection</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLockTranche(0)}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      lockTranche === 0
                        ? 'bg-blue-50 border-blue-600 text-blue-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Senior (Priority 1)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLockTranche(1)}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      lockTranche === 1
                        ? 'bg-purple-50 border-purple-600 text-purple-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Junior (Priority 2)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (USDC)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={lockAmountUSDC}
                  onChange={(e) => setLockAmountUSDC(e.target.value)}
                  placeholder={`Min ${formatUnits(asset.minLock ?? 0n, 6)} USDC`}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={!userAddress || !lockAmountUSDC || parseFloat(lockAmountUSDC) <= 0}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
              >
                {!userAddress ? 'Connect Wallet to Lock' : 'Approve & Lock USDC'}
              </button>
            </form>
          </div>
        )}

        {/* Close Race Action (Borrower before deadline, or Anyone after deadline) */}
        {canClose && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>Close Race & Allocate Positions</span>
            </div>
            <p className="text-xs text-slate-500">
              {isBorrower
                ? 'As the borrower, you can close the race early to claim locked proceeds.'
                : 'The deadline has passed. Anyone can trigger final allocation and minting of position tokens.'}
            </p>
            <button
              onClick={handleClose}
              disabled={!userAddress}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              {!userAddress ? 'Connect Wallet to Close' : 'Close Race'}
            </button>
          </div>
        )}

        {/* Repayment Action (Once closed) */}
        {asset.state === 2 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span>Repay Debt Waterfall</span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                Due Date: <span className="italic text-slate-500">not enforced in v1</span>
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Repayments strictly satisfy Senior obligations before flowing to Junior tranches.
            </p>

            <form onSubmit={handleRepay} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Repayment Amount (USDC)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={repayAmountUSDC}
                  onChange={(e) => setRepayAmountUSDC(e.target.value)}
                  placeholder="e.g. 5000 USDC"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={!userAddress || !repayAmountUSDC || parseFloat(repayAmountUSDC) <= 0}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
              >
                {!userAddress ? 'Connect Wallet to Repay' : 'Approve & Deposit Repayment'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Lock Sequence Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-sm text-slate-900">FIFO Escrow Lock Sequence</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">{locks.length} locks recorded</span>
        </div>

        {locks.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            No locks placed yet on this collateral asset.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-semibold">
                  <th className="pb-2 px-3">Seq #</th>
                  <th className="pb-2 px-3">Lender Address</th>
                  <th className="pb-2 px-3">Amount</th>
                  <th className="pb-2 px-3">Tranche</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {locks.map((l, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-bold text-slate-900">#{l.sequenceNumber?.toString() ?? String(idx + 1)}</td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {l.lender ? `${l.lender.slice(0, 6)}...${l.lender.slice(-4)}` : 'Unknown'}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {formatUnits(l.amount ?? 0n, 6)} USDC
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold font-sans ${
                          l.tranche === 0
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {l.tranche === 0 ? 'Senior' : 'Junior'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
