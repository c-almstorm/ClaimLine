import React, { useState } from 'react';
import { useWallet } from './hooks/useWallet';
import { Banner } from './components/Banner';
import { Header } from './components/Header';
import { AssetList } from './components/AssetList';
import { AssetDetail } from './components/AssetDetail';
import { RegisterAssetModal } from './components/RegisterAssetModal';
import { TxModal, TxState } from './components/TxModal';
import { CLAIMLINE_ABI } from './config';
import { Shield, Sparkles, PlusCircle } from 'lucide-react';

export function App() {
  const {
    chainId,
    activeConfig,
    address,
    usdcBalance,
    nativeBalance,
    isConnecting,
    error: walletError,
    publicClient,
    getWalletClient,
    connect,
    disconnect,
    switchChain,
    addArcNetwork,
    refreshBalances,
  } = useWallet();

  const [selectedAssetId, setSelectedAssetId] = useState<`0x${string}` | null>(
    // Default to the known testnet asset if on testnet
    chainId === 5042002 ? '0x5332f8c73598b74c29884a65205f0b258bd3fd337692ed52ccee1d68a9c77691' : null
  );

  const [isRegisterOpen, setIsRegisterOpen] = useState<boolean>(false);
  const [txState, setTxState] = useState<TxState>({
    isOpen: false,
    status: 'idle',
    title: '',
    description: '',
  });

  // Action: Register Asset
  const handleRegisterAsset = async (params: {
    assetType: string;
    docId: string;
    custodian: `0x${string}`;
    obligor: `0x${string}`;
    faceValue: bigint;
    seniorCapacity: bigint;
    juniorCapacity: bigint;
    seniorRepaymentOwed: bigint;
    juniorRepaymentOwed: bigint;
    deadline: bigint;
  }) => {
    if (!address) return;
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('Wallet client unavailable');

    setTxState({
      isOpen: true,
      status: 'pending',
      title: 'Registering Collateral Asset',
      description: `Submitting registration for ${params.assetType} (${params.docId})...`,
    });

    try {
      const tx = await walletClient.writeContract({
        address: activeConfig.claimLineAddress,
        abi: CLAIMLINE_ABI,
        functionName: 'registerAsset',
        args: [
          params.assetType,
          params.docId,
          params.custodian,
          params.obligor,
          params.faceValue,
          params.seniorCapacity,
          params.juniorCapacity,
          params.seniorRepaymentOwed,
          params.juniorRepaymentOwed,
          params.deadline,
        ],
        account: address,
        chain: activeConfig,
      });

      setTxState((prev) => ({
        ...prev,
        txHash: tx,
        description: 'Waiting for registration confirmation on Arc...',
      }));

      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

      // Extract assetId from event log if possible
      setTxState((prev) => ({
        ...prev,
        status: 'success',
        title: 'Asset Registered Successfully',
        description: 'Collateral asset registered on Arc! Open for escrow locks.',
      }));

      refreshBalances();
    } catch (err: any) {
      console.error('Registration failed:', err);
      setTxState({
        isOpen: true,
        status: 'error',
        title: 'Registration Failed',
        description: 'Asset registration transaction failed or was rejected.',
        errorMessage: err?.message || 'Transaction failed',
      });
      throw err;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Banner */}
      <Banner activeConfig={activeConfig} />

      {/* Header */}
      <Header
        activeConfig={activeConfig}
        chainId={chainId}
        address={address}
        usdcBalance={usdcBalance}
        nativeBalance={nativeBalance}
        isConnecting={isConnecting}
        onConnect={connect}
        onDisconnect={disconnect}
        onSwitchChain={switchChain}
        onAddArcNetwork={addArcNetwork}
        onOpenRegisterModal={() => setIsRegisterOpen(true)}
        onRefresh={refreshBalances}
      />

      {/* Wallet Error Alert */}
      {walletError && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 w-full">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
            {walletError}
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Sidebar: Asset Explorer List */}
          <div className="lg:col-span-4 space-y-6">
            <AssetList
              activeConfig={activeConfig}
              publicClient={publicClient}
              selectedAssetId={selectedAssetId}
              onSelectAsset={(id) => setSelectedAssetId(id)}
              onOpenRegisterModal={() => setIsRegisterOpen(true)}
            />

            {/* Quick Info Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm text-xs text-slate-600 space-y-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-blue-600" />
                <span>Protocol Rules & Architecture</span>
              </h3>
              <ul className="space-y-1.5 list-disc list-inside text-slate-600 leading-relaxed">
                <li>
                  <strong className="text-slate-800">Native USDC:</strong> Interacts with 6-decimal USDC at <code>{activeConfig.usdcAddress.slice(0, 8)}...</code>
                </li>
                <li>
                  <strong className="text-slate-800">FIFO Queue:</strong> Max 32 locks per asset race filled in strict arrival sequence.
                </li>
                <li>
                  <strong className="text-slate-800">Waterfall Priority:</strong> Repayments satisfy Senior tranche in full before Junior receives funds.
                </li>
                <li>
                  <strong className="text-slate-800">Pull-Based Safety:</strong> Proceeds and refunds remain safe from blocklists and non-responsive addresses.
                </li>
              </ul>
            </div>
          </div>

          {/* Right Main Area: Selected Asset Details & Action Center */}
          <div className="lg:col-span-8">
            {selectedAssetId ? (
              <AssetDetail
                assetId={selectedAssetId}
                activeConfig={activeConfig}
                userAddress={address}
                publicClient={publicClient}
                getWalletClient={getWalletClient}
                onRefreshBalances={refreshBalances}
                setTxState={setTxState}
              />
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 mb-2">No Asset Selected</h2>
                <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
                  Select a registered asset from the list on the left or register a new collateral asset to inspect lien priority, lock history, and waterfall settlement.
                </p>
                {address && (
                  <button
                    onClick={() => setIsRegisterOpen(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Register New Asset</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Claimline Protocol &copy; 2026. Built on Arc Network.</span>
          <div className="flex items-center gap-4">
            <a
              href={`${activeConfig.blockExplorers.default.url}/address/${activeConfig.claimLineAddress}`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-blue-600 underline"
            >
              Block Explorer
            </a>
            <a
              href="https://faucet.circle.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-blue-600 underline"
            >
              Circle Testnet Faucet
            </a>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {address && (
        <RegisterAssetModal
          isOpen={isRegisterOpen}
          userAddress={address}
          onClose={() => setIsRegisterOpen(false)}
          onSubmit={handleRegisterAsset}
        />
      )}

      <TxModal
        state={txState}
        activeConfig={activeConfig}
        onClose={() => setTxState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
export default App;
