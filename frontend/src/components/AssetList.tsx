import React, { useState, useEffect, useCallback, useRef } from 'react';
import { formatUnits, parseAbiItem, type PublicClient } from 'viem';
import { Shield, Search, RefreshCw, Layers, Plus, AlertCircle, Loader2, User, Globe } from 'lucide-react';
import { ChainConfig } from '../config';

export interface DiscoveredAsset {
  assetId: `0x${string}`;
  borrower: `0x${string}`;
  assetType: string;
  docId: string;
  faceValue: bigint;
  seniorCapacity: bigint;
  juniorCapacity: bigint;
  deadline: bigint;
}

interface AssetListProps {
  activeConfig: ChainConfig;
  publicClient: PublicClient;
  currentBlock: bigint | null;
  blockTrigger: number;
  userAddress: `0x${string}` | null;
  selectedAssetId: `0x${string}` | null;
  onSelectAsset: (assetId: `0x${string}`) => void;
  onOpenRegisterModal: () => void;
}

function getStoredScan(
  chainId: number,
  contractAddress: string
): { lastScannedBlock: bigint; assets: DiscoveredAsset[] } | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const key = `claimline_scan_${chainId}_${contractAddress.toLowerCase()}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.lastScannedBlock) return null;

    const assets: DiscoveredAsset[] = (parsed.assets || []).map((a: any) => ({
      assetId: a.assetId,
      borrower: a.borrower,
      assetType: a.assetType || 'Invoice',
      docId: a.docId || 'DOC-001',
      faceValue: BigInt(a.faceValue || '0'),
      seniorCapacity: BigInt(a.seniorCapacity || '0'),
      juniorCapacity: BigInt(a.juniorCapacity || '0'),
      deadline: BigInt(a.deadline || '0'),
    }));

    return {
      lastScannedBlock: BigInt(parsed.lastScannedBlock),
      assets,
    };
  } catch (err) {
    console.warn('Failed to read scan cache from localStorage:', err);
    return null;
  }
}

function setStoredScan(
  chainId: number,
  contractAddress: string,
  lastScannedBlock: bigint,
  assets: DiscoveredAsset[]
): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const key = `claimline_scan_${chainId}_${contractAddress.toLowerCase()}`;
    const serialized = {
      lastScannedBlock: lastScannedBlock.toString(),
      assets: assets.map((a) => ({
        assetId: a.assetId,
        borrower: a.borrower,
        assetType: a.assetType,
        docId: a.docId,
        faceValue: (a.faceValue ?? 0n).toString(),
        seniorCapacity: (a.seniorCapacity ?? 0n).toString(),
        juniorCapacity: (a.juniorCapacity ?? 0n).toString(),
        deadline: (a.deadline ?? 0n).toString(),
      })),
    };
    window.localStorage.setItem(key, JSON.stringify(serialized));
  } catch (err) {
    console.warn('Failed to write scan cache to localStorage:', err);
  }
}

function isRateLimitError(err: any): boolean {
  if (!err) return false;
  const str =
    (err.message || '') +
    ' ' +
    (err.shortMessage || '') +
    ' ' +
    (err.details || '') +
    ' ' +
    JSON.stringify(err);
  return (
    err.code === -32005 ||
    err?.cause?.code === -32005 ||
    err?.status === 429 ||
    str.includes('-32005') ||
    str.toLowerCase().includes('rate limit') ||
    str.toLowerCase().includes('too many requests')
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const AssetList: React.FC<AssetListProps> = ({
  activeConfig,
  publicClient,
  currentBlock,
  blockTrigger,
  userAddress,
  selectedAssetId,
  onSelectAsset,
  onOpenRegisterModal,
}) => {
  const [assets, setAssets] = useState<DiscoveredAsset[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRpcBusy, setIsRpcBusy] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [searchId, setSearchId] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'my'>('all');

  const scanAbortControllerRef = useRef<AbortController | null>(null);
  const activeChainIdRef = useRef<number>(activeConfig.id);

  useEffect(() => {
    activeChainIdRef.current = activeConfig.id;
  }, [activeConfig.id]);

  const fetchAssets = useCallback(async () => {
    // Abort previous in-flight scan
    if (scanAbortControllerRef.current) {
      scanAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    scanAbortControllerRef.current = abortController;
    const scanChainId = activeConfig.id;

    try {
      setLoading(true);
      setScanError(null);
      setIsRpcBusy(false);

      if (!activeConfig.claimLineAddress) {
        setAssets([]);
        setLoading(false);
        return;
      }

      const contractAddr = activeConfig.claimLineAddress;
      const cached = getStoredScan(activeConfig.id, contractAddr);

      let existingAssets: DiscoveredAsset[] = [];
      let fromBlock = activeConfig.deploymentBlock > 0n ? activeConfig.deploymentBlock : 0n;

      if (cached) {
        existingAssets = cached.assets;
        setAssets(cached.assets);
        if (cached.lastScannedBlock >= fromBlock) {
          fromBlock = cached.lastScannedBlock + 1n;
        }
      }

      const targetBlock = currentBlock ?? (await publicClient.getBlockNumber());
      if (abortController.signal.aborted || scanChainId !== activeChainIdRef.current) return;

      // If already scanned up to current block, nothing new to scan
      if (fromBlock > targetBlock) {
        setAssets(existingAssets);
        setLoading(false);
        return;
      }

      const CHUNK_SIZE = 8000n;
      const eventAbi = parseAbiItem(
        'event AssetRegistered(bytes32 indexed assetId, address indexed borrower, string assetType, string docId, address custodian, address obligor, uint256 faceValue, uint256 seniorCapacity, uint256 juniorCapacity, uint256 seniorRepaymentOwed, uint256 juniorRepaymentOwed, uint256 minLock, uint256 deadline)'
      );

      const chunks: { start: bigint; end: bigint }[] = [];
      for (let start = fromBlock; start <= targetBlock; start += CHUNK_SIZE) {
        const end = start + CHUNK_SIZE - 1n > targetBlock ? targetBlock : start + CHUNK_SIZE - 1n;
        chunks.push({ start, end });
      }

      const fetchLogsWithRetry = async (
        start: bigint,
        end: bigint,
        attempt = 0
      ): Promise<any[]> => {
        if (abortController.signal.aborted || scanChainId !== activeChainIdRef.current) {
          return [];
        }
        try {
          return await publicClient.getLogs({
            address: contractAddr as `0x${string}`,
            event: eventAbi,
            fromBlock: start,
            toBlock: end,
          });
        } catch (err: any) {
          if (isRateLimitError(err)) {
            setIsRpcBusy(true);
            if (attempt < 5) {
              const backoffMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 10000);
              await sleep(backoffMs);
              return fetchLogsWithRetry(start, end, attempt + 1);
            }
          }

          if (end > start) {
            const mid = start + (end - start) / 2n;
            const [firstHalf, secondHalf] = await Promise.all([
              fetchLogsWithRetry(start, mid, 0),
              fetchLogsWithRetry(mid + 1n, end, 0),
            ]);
            return [...firstHalf, ...secondHalf];
          }
          throw err;
        }
      };

      let contiguousLastScannedBlock = cached?.lastScannedBlock ?? (fromBlock > 0n ? fromBlock - 1n : 0n);
      const chunkStatus: { success: boolean; logs: any[]; end: bigint }[] = new Array(chunks.length);

      const BATCH_SIZE = 3;
      let batchError: any = null;

      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        if (abortController.signal.aborted || scanChainId !== activeChainIdRef.current) return;
        const batch = chunks.slice(i, i + BATCH_SIZE);
        try {
          await Promise.all(
            batch.map(async (chunk, offset) => {
              const chunkIdx = i + offset;
              try {
                const logs = await fetchLogsWithRetry(chunk.start, chunk.end, 0);
                chunkStatus[chunkIdx] = { success: true, logs, end: chunk.end };
              } catch (chunkErr) {
                chunkStatus[chunkIdx] = { success: false, logs: [], end: chunk.end };
                throw chunkErr;
              }
            })
          );
        } catch (err) {
          batchError = err;
          break;
        }

        if (i + BATCH_SIZE < chunks.length) {
          await sleep(100);
        }
      }

      if (abortController.signal.aborted || scanChainId !== activeChainIdRef.current) return;

      const allNewLogs: any[] = [];
      for (let idx = 0; idx < chunks.length; idx++) {
        if (chunkStatus[idx]?.success) {
          contiguousLastScannedBlock = chunks[idx].end;
          allNewLogs.push(...chunkStatus[idx].logs);
        } else {
          break;
        }
      }

      const newParsed: DiscoveredAsset[] = allNewLogs.map((log: any) => ({
        assetId: log.args.assetId,
        borrower: log.args.borrower,
        assetType: log.args.assetType || 'Invoice',
        docId: log.args.docId || 'DOC-001',
        faceValue: BigInt(log.args.faceValue ?? 0n),
        seniorCapacity: BigInt(log.args.seniorCapacity ?? 0n),
        juniorCapacity: BigInt(log.args.juniorCapacity ?? 0n),
        deadline: BigInt(log.args.deadline ?? 0n),
      }));

      // Deduplicate and sort newest first
      const uniqueMap = new Map<string, DiscoveredAsset>();
      existingAssets.forEach((a) => uniqueMap.set(a.assetId.toLowerCase(), a));
      newParsed.forEach((a) => uniqueMap.set(a.assetId.toLowerCase(), a));

      const mergedList = Array.from(uniqueMap.values()).reverse();
      setAssets(mergedList);
      setIsRpcBusy(false);

      if (contiguousLastScannedBlock > (cached?.lastScannedBlock ?? 0n)) {
        setStoredScan(activeConfig.id, contractAddr, contiguousLastScannedBlock, Array.from(uniqueMap.values()));
      }

      if (batchError && allNewLogs.length === 0 && mergedList.length === 0) {
        throw batchError;
      }
    } catch (err: any) {
      if (!abortController.signal.aborted && scanChainId === activeChainIdRef.current) {
        console.warn('Error discovering assets:', err);
        if (isRateLimitError(err)) {
          setIsRpcBusy(true);
        }
        setScanError(err?.shortMessage || err?.message || 'Failed to scan on-chain event logs');
      }
    } finally {
      if (!abortController.signal.aborted && scanChainId === activeChainIdRef.current) {
        setLoading(false);
      }
    }
  }, [activeConfig, publicClient, currentBlock]);

  // Trigger scan on mount, chain switch, or when block number advances
  useEffect(() => {
    fetchAssets();
  }, [fetchAssets, blockTrigger]);

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchId) return;
    const clean = searchId.trim() as `0x${string}`;
    onSelectAsset(clean);
  };

  // Filter list: all vs my assets
  const displayedAssets = assets.filter((asset) => {
    if (filterMode === 'my' && userAddress) {
      return asset.borrower.toLowerCase() === userAddress.toLowerCase();
    }
    return true;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
      {/* Fast Path: Open Asset by ID */}
      <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
            <Search className="w-3.5 h-3.5 text-blue-600" />
            <span>Open Asset by ID</span>
          </div>
          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-200/80 text-blue-800">
            ⚡ Fast Path
          </span>
        </div>
        <form onSubmit={handleManualSearch} className="flex gap-2">
          <input
            type="text"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            placeholder="Paste bytes32 Asset ID (0x...)"
            className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!searchId.trim()}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors whitespace-nowrap"
          >
            Open
          </button>
        </form>
      </div>

      {/* Header & Filter Tabs */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">Collateral Assets</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
              {displayedAssets.length}
            </span>
          </div>

          <button
            onClick={fetchAssets}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50 transition-colors"
            title="Refresh asset list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>

        {/* Filter Mode Selector */}
        {userAddress && (
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setFilterMode('all')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all ${
                filterMode === 'all'
                  ? 'bg-white text-blue-700 font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>All Assets ({assets.length})</span>
            </button>
            <button
              onClick={() => setFilterMode('my')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all ${
                filterMode === 'my'
                  ? 'bg-white text-blue-700 font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>My Assets ({assets.filter((a) => a.borrower.toLowerCase() === userAddress.toLowerCase()).length})</span>
            </button>
          </div>
        )}
      </div>

      {/* RPC Busy / Retrying Notification */}
      {isRpcBusy && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-amber-600 flex-shrink-0" />
          <span className="font-medium">RPC busy, retrying...</span>
        </div>
      )}

      {/* Scan Error Banner with Retry */}
      {scanError && !isRpcBusy && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-2">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>Scan Error</span>
          </div>
          <p className="text-[11px] text-rose-700 font-mono break-all">{scanError}</p>
          <button
            onClick={fetchAssets}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg shadow-sm transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Scan</span>
          </button>
        </div>
      )}

      {/* Asset Cards */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
        {loading && assets.length === 0 && !scanError ? (
          <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span>
              {isRpcBusy ? 'RPC busy, retrying...' : 'Discovering on-chain assets...'}
            </span>
          </div>
        ) : !activeConfig.claimLineAddress ? (
          <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-2 font-medium">Contract is not deployed yet on {activeConfig.name}.</p>
            <span className="inline-block px-3 py-1 rounded bg-slate-200 text-slate-600 text-xs font-semibold">
              Not deployed yet
            </span>
          </div>
        ) : displayedAssets.length === 0 && !scanError ? (
          <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-3">
              {filterMode === 'my'
                ? 'No assets registered by your connected address.'
                : isRpcBusy
                ? 'RPC busy, retrying...'
                : 'No assets discovered yet on this network.'}
            </p>
            {!isRpcBusy && (
              <button
                onClick={onOpenRegisterModal}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register Collateral Asset</span>
              </button>
            )}
          </div>
        ) : (
          displayedAssets.map((asset) => {
            const isSelected = selectedAssetId?.toLowerCase() === asset.assetId.toLowerCase();
            const isMyAsset = userAddress && asset.borrower.toLowerCase() === userAddress.toLowerCase();
            return (
              <div
                key={asset.assetId}
                onClick={() => onSelectAsset(asset.assetId)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left ${
                  isSelected
                    ? 'bg-blue-50/60 border-blue-500 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-slate-900">{asset.assetType || 'Invoice'}</span>
                    {isMyAsset && (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                        Mine
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-medium">
                    Doc ID: {asset.docId || 'DOC-001'}
                  </span>
                </div>

                <div className="font-mono text-[11px] text-slate-500 truncate mb-2">
                  {asset.assetId}
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100/80">
                  <span className="text-slate-500">
                    Face: <strong className="text-slate-800">{formatUnits(asset.faceValue ?? 0n, 6)} USDC</strong>
                  </span>
                  <span className="text-emerald-700 font-semibold">
                    Cap: {formatUnits((asset.seniorCapacity ?? 0n) + (asset.juniorCapacity ?? 0n), 6)} USDC
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
