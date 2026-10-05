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
  state: number; // 0: None, 1: Open, 2: Closed
  lockCount: bigint;
  totalSeniorAccepted: bigint;
  totalJuniorAccepted: bigint;
  seniorRepaid: bigint;
  juniorRepaid: bigint;
}

export interface LockRecord {
  lender: `0x${string}`;
  amount: bigint;
  tranche: number; // 0: Senior, 1: Junior
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
  getWalletClient: () => WalletClient | null;
  onRefreshBalances: () => void;
  setTxState: React.Dispatch<React.SetStateAction<TxState>>;
}

export const AssetDetail: React.FC<AssetDetailProps> = ({
  assetId,
  activeConfig,
  userAddress,
  publicClient,
  getWalletClient,
  onRefreshBalances,
  setTxState,
}) => {
  const [asset, setAsset] = useState<AssetData | null>(null);
  const [locks, setLocks] = useState<LockRecord[]>([]);
  const [pendingClaim, setPendingClaim] = useState<PendingClaimData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Form states
  const [lockAmountUSDC, setLockAmountUSDC] = useState<string>('');
  const [lockTranche, setLockTranche] = useState<number>(0); // 0: Senior, 1: Junior
  const [repayAmountUSDC, setRepayAmountUSDC] = useState<string>('');

  const fetchAssetDetails = useCallback(async () => {
    try {
      setLoading(true);
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

      const formattedAsset: AssetData = {
        assetId: rawAsset.assetId || rawAsset[0],
        borrower: rawAsset.borrower || rawAsset[1],
        faceValue: rawAsset.faceValue || rawAsset[2],
        seniorCapacity: rawAsset.seniorCapacity || rawAsset[3],
        juniorCapacity: rawAsset.juniorCapacity || rawAsset[4],
        seniorRepaymentOwed: rawAsset.seniorRepaymentOwed || rawAsset[5],
        juniorRepaymentOwed: rawAsset.juniorRepaymentOwed || rawAsset[6],
        minLock: rawAsset.minLock || rawAsset[7],
        deadline: rawAsset.deadline || rawAsset[8],
        state: Number(rawAsset.state ?? rawAsset[9]),
        lockCount: rawAsset.lockCount || rawAsset[10],
        totalSeniorAccepted: rawAsset.totalSeniorAccepted || rawAsset[11],
        totalJuniorAccepted: rawAsset.totalJuniorAccepted || rawAsset[12],
        seniorRepaid: rawAsset.seniorRepaid || rawAsset[13],
        juniorRepaid: rawAsset.juniorRepaid || rawAsset[14],
      };

      setAsset(formattedAsset);
      setLocks(
        rawLocks.map((l: any) => ({
          lender: l.lender || l[0],
          amount: l.amount || l[1],
          tranche: Number(l.tranche ?? l[2]),
          sequenceNumber: l.sequenceNumber || l[3],
        }))
      );

      // If user is connected, check pending claim
      if (userAddress) {
        const rawClaim = (await publicClient.readContract({
          address: activeConfig.claimLineAddress,
          abi: CLAIMLINE_ABI,
          functionName: 'getPendingClaim',
          args: [assetId, userAddress],
        })) as any;

        setPendingClaim({
          refund: rawClaim.refund || rawClaim[0],
          proceeds: rawClaim.proceeds || rawClaim[1],
          seniorPayout: rawClaim.seniorPayout || rawClaim[2],
          juniorPayout: rawClaim.juniorPayout || rawClaim[3],
          totalClaim: rawClaim.totalClaim || rawClaim[4],
        });
      }
    } catch (err) {
      console.error('Error loading asset details:', err);
    } finally {
      setLoading(false);
    }
  }, [assetId, activeConfig, userAddress, publicClient]);

  useEffect(() => {
    fetchAssetDetails();
    const interval = setInterval(fetchAssetDetails, 8000);
    return () => clearInterval(interval);
  }, [fetchAssetDetails]);

  // Helper for USDC Allowance & Approval
  const ensureAllowance = async (amount: bigint) => {
    if (!userAddress) throw new Error('Wallet not connected');
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('Wallet not available');

    const currentAllowance = (await publicClient.readContract({
      address: activeConfig.usdcAddress,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [userAddress, activeConfig.claimLineAddress],
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
        args: [activeConfig.claimLineAddress, maxUint256],
        account: userAddress,
        chain: activeConfig,
      });

      setTxState((prev) => ({
        ...prev,
        approvalTxHash: approveTx,
        description: 'Waiting for USDC approval transaction confirmation on Arc...',
      }));

      await publicClient.waitForTransactionReceipt({ hash: approveTx });
    }
  };

  // Action: Place Lock
  const handleLock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAddress || !asset) return;

    try {
      const lockAmount = parseUnits(lockAmountUSDC, 6);
      if (lockAmount < asset.minLock) {
        alert(`Amount is below minimum lock requirement (${formatUnits(asset.minLock, 6)} USDC)`);
        return;
      }

      await ensureAllowance(lockAmount);

      const walletClient = getWalletClient();
      if (!walletClient) throw new Error('Wallet unavailable');

      setTxState((prev) => ({
        ...prev,
        isOpen: true,
        status: 'pending',
        title: 'Placing Lock',
        description: `Escrowing ${lockAmountUSDC} USDC into ${lockTranche === 0 ? 'Senior' : 'Junior'} tranche...`,
      }));

      const tx = await walletClient.writeContract({
        address: activeConfig.claimLineAddress,
        abi: CLAIMLINE_ABI,
        functionName: 'lock',
        args: [assetId, lockAmount, lockTranche],
        account: userAddress,
        chain: activeConfig,
      });

      setTxState((prev) => ({
        ...prev,
        txHash: tx,
        description: 'Waiting for lock transaction confirmation on Arc...',
      }));

      await publicClient.waitForTransactionReceipt({ hash: tx });

      setTxState((prev) => ({
        ...prev,
        status: 'success',
        title: 'Lock Placed Successfully',
        description: `Successfully escrowed ${lockAmountUSDC} USDC in ${lockTranche === 0 ? 'Senior' : 'Junior'} tranche!`,
      }));

      setLockAmountUSDC('');
      fetchAssetDetails();
      onRefreshBalances();
    } catch (err: any) {
      console.error('Lock error:', err);
      setTxState((prev) => ({
        ...prev,
        isOpen: true,
        status: 'error',
        title: 'Lock Failed',
        description: 'Transaction failed or was rejected.',
        errorMessage: err?.message || 'Transaction failed',
      }));
    }
  };

  // Action: Close Race
  const handleClose = async () => {
    if (!userAddress || !asset) return;

    try {
      const walletClient = getWalletClient();
      if (!walletClient) throw new Error('Wallet unavailable');

      setTxState({
        isOpen: true,
        status: 'pending',
        title: 'Closing Race',
        description: 'Sealing capacities in FIFO order and minting position tokens...',
      });

      const tx = await walletClient.writeContract({
        address: activeConfig.claimLineAddress,
        abi: CLAIMLINE_ABI,
        functionName: 'close',
        args: [assetId],
        account: userAddress,
        chain: activeConfig,
      });

      setTxState((prev) => ({
        ...prev,
        txHash: tx,
        description: 'Waiting for race close confirmation on Arc...',
      }));

      await publicClient.waitForTransactionReceipt({ hash: tx });

      setTxState((prev) => ({
        ...prev,
        status: 'success',
        title: 'Race Closed',
        description: 'Asset race closed! Allocations sealed and borrower proceeds credited.',
      }));

      fetchAssetDetails();
      onRefreshBalances();
    } catch (err: any) {
      console.error('Close error:', err);
      setTxState({
        isOpen: true,
        status: 'error',
        title: 'Close Failed',
        description: 'Transaction failed or was rejected.',
        errorMessage: err?.message || 'Transaction failed',
      });
    }
  };

  // Action: Repay
  const handleRepay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAddress || !asset) return;

    try {
      const repayAmount = parseUnits(repayAmountUSDC, 6);
      if (repayAmount <= 0n) return;

      await ensureAllowance(repayAmount);

      const walletClient = getWalletClient();
      if (!walletClient) throw new Error('Wallet unavailable');

      setTxState((prev) => ({
        ...prev,
        isOpen: true,
        status: 'pending',
        title: 'Depositing Repayment',
        description: `Repaying ${repayAmountUSDC} USDC through priority waterfall...`,
      }));

      const tx = await walletClient.writeContract({
        address: activeConfig.claimLineAddress,
        abi: CLAIMLINE_ABI,
        functionName: 'repay',
        args: [assetId, repayAmount],
        account: userAddress,
        chain: activeConfig,
      });

      setTxState((prev) => ({
        ...prev,
        txHash: tx,
        description: 'Waiting for repayment confirmation on Arc...',
      }));

      await publicClient.waitForTransactionReceipt({ hash: tx });

      setTxState((prev) => ({
        ...prev,
        status: 'success',
        title: 'Repayment Completed',
        description: `Deposited ${repayAmountUSDC} USDC into the priority waterfall!`,
      }));

      setRepayAmountUSDC('');
      fetchAssetDetails();
      onRefreshBalances();
    } catch (err: any) {
      console.error('Repay error:', err);
      setTxState((prev) => ({
        ...prev,
        isOpen: true,
        status: 'error',
        title: 'Repayment Failed',
        description: 'Transaction failed or was rejected.',
        errorMessage: err?.message || 'Transaction failed',
      }));
    }
  };

  // Action: Claim
  const handleClaim = async () => {
    if (!userAddress || !asset) return;

    try {
      const walletClient = getWalletClient();
      if (!walletClient) throw new Error('Wallet unavailable');

      setTxState({
        isOpen: true,
        status: 'pending',
        title: 'Claiming Payouts',
        description: 'Withdrawing available refunds, proceeds, and repayments...',
      });

      const tx = await walletClient.writeContract({
        address: activeConfig.claimLineAddress,
        abi: CLAIMLINE_ABI,
        functionName: 'claim',
        args: [assetId],
        account: userAddress,
        chain: activeConfig,
      });

      setTxState((prev) => ({
        ...prev,
        txHash: tx,
        description: 'Waiting for claim withdrawal confirmation on Arc...',
      }));

      await publicClient.waitForTransactionReceipt({ hash: tx });

      setTxState((prev) => ({
        ...prev,
        status: 'success',
        title: 'Claim Successful',
        description: 'All pending USDC payouts successfully transferred to your wallet!',
      }));

      fetchAssetDetails();
      onRefreshBalances();
    } catch (err: any) {
      console.error('Claim error:', err);
      setTxState({
        isOpen: true,
        status: 'error',
        title: 'Claim Failed',
        description: 'Transaction failed or was rejected.',
        errorMessage: err?.message || 'Transaction failed',
      });
    }
  };

  if (loading && !asset) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3"></div>
        <p className="text-sm text-slate-500">Loading asset parameters and on-chain lock history...</p>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-900">Asset not found</p>
        <p className="text-xs text-slate-500 mt-1 font-mono">{assetId}</p>
      </div>
    );
  }

  const deadlineDate = new Date(Number(asset.deadline) * 1000);
  const isExpired = Date.now() > Number(asset.deadline) * 1000;
  const isBorrower = userAddress?.toLowerCase() === asset.borrower.toLowerCase();
  const canClose = asset.state === 1 && (isBorrower || isExpired);

  const seniorAccepted = formatUnits(asset.totalSeniorAccepted, 6);
  const seniorCap = formatUnits(asset.seniorCapacity, 6);
  const juniorAccepted = formatUnits(asset.totalJuniorAccepted, 6);
  const juniorCap = formatUnits(asset.juniorCapacity, 6);

  const seniorRepaid = formatUnits(asset.seniorRepaid, 6);
  const seniorRepayOwed = formatUnits(asset.seniorRepaymentOwed, 6);
  const juniorRepaid = formatUnits(asset.juniorRepaid, 6);
  const juniorRepayOwed = formatUnits(asset.juniorRepaymentOwed, 6);

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
                    ? 'bg-slate-100 text-slate-700'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {asset.state === 1 ? '🟢 Open for Locks' : asset.state === 2 ? '🔒 Race Closed' : 'None'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Borrower / Obligor:</span>
              <a
                href={`${activeConfig.blockExplorers.default.url}/address/${asset.borrower}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-blue-600 hover:underline flex items-center gap-0.5"
              >
                <span>{asset.borrower.slice(0, 6)}...{asset.borrower.slice(-4)}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              {isBorrower && (
                <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.2 rounded">
                  YOU
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {canClose && (
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
              >
                Close Race & Seal Allocations
              </button>
            )}
          </div>
        </div>

        {/* Metric Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-500 block mb-1">Face Value</span>
            <span className="text-base font-bold text-slate-900">
              {formatUnits(asset.faceValue, 6)} <span className="text-xs font-normal text-slate-500">USDC</span>
            </span>
          </div>

          <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-xl">
            <span className="text-[11px] font-semibold text-emerald-700 block mb-1">Senior Capacity</span>
            <span className="text-base font-bold text-emerald-900">
              {seniorCap} <span className="text-xs font-normal text-emerald-600">USDC</span>
            </span>
            <span className="text-[10px] text-emerald-700 block mt-0.5 font-medium">
              Repay Owed: {seniorRepayOwed} USDC
            </span>
          </div>

          <div className="p-3.5 bg-amber-50/50 border border-amber-200 rounded-xl">
            <span className="text-[11px] font-semibold text-amber-700 block mb-1">Junior Capacity</span>
            <span className="text-base font-bold text-amber-900">
              {juniorCap} <span className="text-xs font-normal text-amber-600">USDC</span>
            </span>
            <span className="text-[10px] text-amber-700 block mt-0.5 font-medium">
              Repay Owed: {juniorRepayOwed} USDC
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-500 block mb-1">Minimum Lock (minLock)</span>
            <span className="text-base font-bold text-slate-900">
              {formatUnits(asset.minLock, 6)} <span className="text-xs font-normal text-slate-500">USDC</span>
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Deadline: {deadlineDate.toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Repayment Waterfall Progress Bar */}
        <div className="mt-6 pt-6 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
            <span>Waterfall Repayment Status</span>
            <span>
              Total Repaid:{' '}
              <strong className="text-blue-600">
                {formatUnits(asset.seniorRepaid + asset.juniorRepaid, 6)} USDC
              </strong>
            </span>
          </div>

          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                <span>Senior Tranche: {seniorRepaid} / {seniorRepayOwed} USDC</span>
                <span className="font-semibold">{Number(seniorRepayOwed) > 0 ? ((Number(seniorRepaid) / Number(seniorRepayOwed)) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{
                    width: `${Number(seniorRepayOwed) > 0 ? Math.min(100, (Number(seniorRepaid) / Number(seniorRepayOwed)) * 100) : 0}%`,
                  }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                <span>Junior Tranche: {juniorRepaid} / {juniorRepayOwed} USDC</span>
                <span className="font-semibold">{Number(juniorRepayOwed) > 0 ? ((Number(juniorRepaid) / Number(juniorRepayOwed)) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-500"
                  style={{
                    width: `${Number(juniorRepayOwed) > 0 ? Math.min(100, (Number(juniorRepaid) / Number(juniorRepayOwed)) * 100) : 0}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Lock Escrow Action */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">1. Place Escrow Lock</h3>
          </div>

          {asset.state === 1 ? (
            <form onSubmit={handleLock} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tranche Priority</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLockTranche(0)}
                    className={`py-2 px-3 rounded-lg font-semibold border transition-all text-center ${
                      lockTranche === 0
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Senior Tranche
                  </button>
                  <button
                    type="button"
                    onClick={() => setLockTranche(1)}
                    className={`py-2 px-3 rounded-lg font-semibold border transition-all text-center ${
                      lockTranche === 1
                        ? 'bg-amber-50 border-amber-500 text-amber-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Junior Tranche
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  USDC Amount (min: {formatUnits(asset.minLock, 6)} USDC)
                </label>
                <input
                  type="number"
                  step="any"
                  min={formatUnits(asset.minLock, 6)}
                  value={lockAmountUSDC}
                  onChange={(e) => setLockAmountUSDC(e.target.value)}
                  required
                  disabled={!userAddress}
                  placeholder={`>= ${formatUnits(asset.minLock, 6)}`}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={!userAddress || !lockAmountUSDC}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-sm disabled:opacity-50"
              >
                Approve & Escrow Lock
              </button>
            </form>
          ) : (
            <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500">
              Race is closed. Escrow locks are no longer accepted.
            </div>
          )}
        </div>

        {/* 2. Repayment Action */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">2. Waterfall Repayment</h3>
          </div>

          {asset.state === 2 ? (
            <form onSubmit={handleRepay} className="space-y-3 text-xs">
              <p className="text-slate-500 text-[11px]">
                Repayments flow strictly to the Senior tranche first until fully satisfied, then to Junior.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Repayment Amount (USDC)</label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  value={repayAmountUSDC}
                  onChange={(e) => setRepayAmountUSDC(e.target.value)}
                  required
                  disabled={!userAddress}
                  placeholder="e.g. 50.00"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={!userAddress || !repayAmountUSDC}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all shadow-sm disabled:opacity-50"
              >
                Approve & Deposit Repayment
              </button>
            </form>
          ) : (
            <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500">
              Repayments become available after the race is closed.
            </div>
          )}
        </div>

        {/* 3. Pull-Based Claim Action */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">3. Pull-Based Claims</h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 border border-slate-100">
              <div className="flex justify-between text-slate-600">
                <span>Unfilled Lock Refund:</span>
                <span className="font-semibold text-slate-900">
                  {pendingClaim ? formatUnits(pendingClaim.refund, 6) : '0.00'} USDC
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Borrower Proceeds:</span>
                <span className="font-semibold text-slate-900">
                  {pendingClaim ? formatUnits(pendingClaim.proceeds, 6) : '0.00'} USDC
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Senior Repayment Payout:</span>
                <span className="font-semibold text-emerald-700">
                  {pendingClaim ? formatUnits(pendingClaim.seniorPayout, 6) : '0.00'} USDC
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Junior Repayment Payout:</span>
                <span className="font-semibold text-amber-700">
                  {pendingClaim ? formatUnits(pendingClaim.juniorPayout, 6) : '0.00'} USDC
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900 text-sm">
                <span>Total Claimable:</span>
                <span className="text-blue-600">
                  {pendingClaim ? formatUnits(pendingClaim.totalClaim, 6) : '0.00'} USDC
                </span>
              </div>
            </div>

            <button
              onClick={handleClaim}
              disabled={!userAddress || !pendingClaim || pendingClaim.totalClaim === 0n}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-all shadow-sm disabled:opacity-40"
            >
              Claim All Payouts
            </button>
          </div>
        </div>
      </div>

      {/* Lock Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-900">Sequential Lock History ({locks.length}/32)</h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">FIFO Queue Order</span>
        </div>

        {locks.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
            No locks placed yet. Be the first lender to escrow USDC!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 font-semibold"># Seq</th>
                  <th className="py-2.5 px-3 font-semibold">Lender</th>
                  <th className="py-2.5 px-3 font-semibold">Tranche</th>
                  <th className="py-2.5 px-3 font-semibold">Escrow Amount</th>
                  <th className="py-2.5 px-3 font-semibold">Settlement Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {locks.map((l, idx) => {
                  const isUser = userAddress?.toLowerCase() === l.lender.toLowerCase();
                  return (
                    <tr key={idx} className={isUser ? 'bg-blue-50/50' : ''}>
                      <td className="py-2.5 px-3 font-bold text-slate-900">#{l.sequenceNumber.toString()}</td>
                      <td className="py-2.5 px-3 font-sans">
                        <a
                          href={`${activeConfig.blockExplorers.default.url}/address/${l.lender}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <span>{l.lender.slice(0, 6)}...{l.lender.slice(-4)}</span>
                          {isUser && <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded font-sans font-semibold">YOU</span>}
                        </a>
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            l.tranche === 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {l.tranche === 0 ? 'Senior' : 'Junior'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {formatUnits(l.amount, 6)} USDC
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        {asset.state === 1 ? (
                          <span className="text-slate-500">Pending Close</span>
                        ) : (
                          <span className="text-emerald-700 font-medium">Settled</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
