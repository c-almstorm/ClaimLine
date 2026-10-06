import React, { useState, useEffect, useCallback } from 'react';
import { formatUnits, parseAbiItem, type PublicClient } from 'viem';
import { Shield, Search, RefreshCw, Layers, ArrowRight, ExternalLink, Plus, AlertCircle } from 'lucide-react';
import { ChainConfig, CLAIMLINE_ABI } from '../config';

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
  selectedAssetId: `0x${string}` | null;
  onSelectAsset: (assetId: `0x${string}`) => void;
  onOpenRegisterModal: () => void;
}

export const AssetList: React.FC<AssetListProps> = ({
  activeConfig,
  publicClient,
  selectedAssetId,
  onSelectAsset,
  onOpenRegisterModal,
}) => {
  const [assets, setAssets] = useState<DiscoveredAsset[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanError, setScanError] = useState<string | null>(null);
  const [searchId, setSearchId] = useState<string>('');

  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true);
      setScanError(null);
      if (!activeConfig.claimLineAddress) {
        setAssets([]);
        return;
      }

      const currentBlock = await publicClient.getBlockNumber();
      const fromBlock = activeConfig.deploymentBlock > 0n ? activeConfig.deploymentBlock : 0n;
      // Arc RPC rejects ranges >= 10,000 blocks; 8,000 block chunks remain strictly within bounds
      const CHUNK_SIZE = 8000n;
      const eventAbi = parseAbiItem(
        'event AssetRegistered(bytes32 indexed assetId, address indexed borrower, string assetType, string docId, address custodian, address obligor, uint256 faceValue, uint256 seniorCapacity, uint256 juniorCapacity, uint256 seniorRepaymentOwed, uint256 juniorRepaymentOwed, uint256 minLock, uint256 deadline)'
      );

      // Build chunk ranges
      const chunks: { start: bigint; end: bigint }[] = [];
      for (let start = fromBlock; start <= currentBlock; start += CHUNK_SIZE) {
        const end = start + CHUNK_SIZE - 1n > currentBlock ? currentBlock : start + CHUNK_SIZE - 1n;
        chunks.push({ start, end });
      }

      // Recursive log query with automatic halving retry on range or node errors
      const fetchLogsWithHalving = async (start: bigint, end: bigint): Promise<any[]> => {
        try {
          return await publicClient.getLogs({
            address: activeConfig.claimLineAddress as `0x${string}`,
            event: eventAbi,
            fromBlock: start,
            toBlock: end,
          });
        } catch (err: any) {
          // If the range spans more than 1 block, split in half and retry both sub-chunks
          if (end > start) {
            const mid = start + (end - start) / 2n;
            const [firstHalf, secondHalf] = await Promise.all([
              fetchLogsWithHalving(start, mid),
              fetchLogsWithHalving(mid + 1n, end),
            ]);
            return [...firstHalf, ...secondHalf];
          }
          throw err;
        }
      };

      // Process in parallel batches of 10
      const BATCH_SIZE = 10;
      const allLogs: any[] = [];
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map((chunk) => fetchLogsWithHalving(chunk.start, chunk.end))
        );
        for (const logs of batchResults) {
          allLogs.push(...logs);
        }
      }

      const parsed: DiscoveredAsset[] = allLogs.map((log: any) => ({
        assetId: log.args.assetId,
        borrower: log.args.borrower,
        assetType: log.args.assetType || 'Invoice',
        docId: log.args.docId || 'DOC-001',
        faceValue: log.args.faceValue,
        seniorCapacity: log.args.seniorCapacity,
        juniorCapacity: log.args.juniorCapacity,
        deadline: log.args.deadline,
      }));

      // Deduplicate by assetId
      const uniqueMap = new Map<string, DiscoveredAsset>();
      parsed.forEach((a) => uniqueMap.set(a.assetId.toLowerCase(), a));

      const list = Array.from(uniqueMap.values()).reverse();
      setAssets(list);

      // Auto-select first asset if none selected
      if (!selectedAssetId && list.length > 0) {
        onSelectAsset(list[0].assetId);
      }
    } catch (err: any) {
      console.error('Error discovering assets from logs:', err);
      setScanError(err?.shortMessage || err?.message || 'Failed to scan on-chain event logs');
    } finally {
      setLoading(false);
    }
  }, [activeConfig, publicClient, selectedAssetId, onSelectAsset]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchId) return;
    const clean = searchId.trim() as `0x${string}`;
    onSelectAsset(clean);
  };

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

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-600" />
          <h2 className="text-sm font-bold text-slate-900">Registered Assets</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
            {assets.length}
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

      {/* Scan Error Banner with Retry */}
      {scanError && (
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
          <div className="py-8 text-center text-xs text-slate-400">Discovering on-chain assets...</div>
        ) : !activeConfig.claimLineAddress ? (
          <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-2 font-medium">Contract is not deployed yet on {activeConfig.name}.</p>
            <span className="inline-block px-3 py-1 rounded bg-slate-200 text-slate-600 text-xs font-semibold">
              Not deployed yet
            </span>
          </div>
        ) : assets.length === 0 && !scanError ? (
          <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-3">No assets discovered yet on this network.</p>
            <button
              onClick={onOpenRegisterModal}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register First Asset</span>
            </button>
          </div>
        ) : (
          assets.map((asset) => {
            const isSelected = selectedAssetId?.toLowerCase() === asset.assetId.toLowerCase();
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
                  <span className="font-bold text-xs text-slate-900">{asset.assetType}</span>
                  <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                    {asset.docId}
                  </span>
                </div>

                <div className="font-mono text-[11px] text-slate-500 truncate mb-2">
                  {asset.assetId}
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100/80">
                  <span className="text-slate-500">
                    Face: <strong className="text-slate-800">{formatUnits(asset.faceValue, 6)} USDC</strong>
                  </span>
                  <span className="text-emerald-700 font-semibold">
                    Cap: {formatUnits(asset.seniorCapacity + asset.juniorCapacity, 6)} USDC
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
