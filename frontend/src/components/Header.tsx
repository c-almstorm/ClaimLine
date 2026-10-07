import React from 'react';
import { Shield, Wallet, PlusCircle, ExternalLink, ChevronDown, RefreshCw } from 'lucide-react';
import { ChainConfig, CHAINS_CONFIG } from '../config';

interface HeaderProps {
  activeConfig: ChainConfig;
  chainId: number;
  address: `0x${string}` | null;
  usdcBalance: string;
  nativeBalance: string;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onSwitchChain: (chainId: number) => void;
  onAddArcNetwork: () => void;
  onOpenRegisterModal: () => void;
  onRefresh: () => void;
  onGoHome?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeConfig,
  chainId,
  address,
  usdcBalance,
  nativeBalance,
  isConnecting,
  onConnect,
  onDisconnect,
  onSwitchChain,
  onAddArcNetwork,
  onOpenRegisterModal,
  onRefresh,
  onGoHome,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo & Title */}
        <div
          onClick={onGoHome}
          className={`flex items-center gap-3 ${onGoHome ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
          title={onGoHome ? 'Back to Landing Page' : undefined}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-700 to-indigo-900 flex items-center justify-center text-white shadow-sm shadow-blue-500/20 flex-shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-slate-900 tracking-tight">Claimline</span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                v1.0.0
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              On-chain priority and repayment ledger on Arc — built so lenders know who is paid first
            </p>
          </div>
        </div>

        {/* Right Actions: Network Selector, Register Button, Wallet */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Add Arc Network to MetaMask button */}
          <button
            onClick={onAddArcNetwork}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
            title="Add Arc network to your Web3 wallet"
          >
            <span>+ Add Arc Network</span>
          </button>

          {/* Network Switcher Toggle */}
          <div className="relative inline-block text-left">
            <select
              value={chainId}
              onChange={(e) => onSwitchChain(Number(e.target.value))}
              className="bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value={5042002}>🟢 Arc Testnet (5042002)</option>
              <option value={5042}>🔵 Arc Mainnet (5042)</option>
            </select>
          </div>

          {/* Register Asset Button */}
          {address && (
            activeConfig.claimLineAddress ? (
              <button
                onClick={onOpenRegisterModal}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Register Asset</span>
                <span className="sm:hidden">Register</span>
              </button>
            ) : (
              <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-400 border border-slate-200">
                Not deployed yet
              </span>
            )
          )}

          {/* Wallet State */}
          {address ? (
            <div className="flex items-center gap-2">
              {/* Balances badge */}
              <div className="hidden lg:flex flex-col items-end text-right px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-xs font-bold text-slate-900">
                  {parseFloat(usdcBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                  <span className="text-blue-600 font-medium">USDC</span>
                </span>
                <span className="text-[10px] text-slate-500">
                  {parseFloat(nativeBalance).toFixed(4)} Gas
                </span>
              </div>

              {/* Account button */}
              <button
                onClick={onDisconnect}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors"
                title="Click to disconnect"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span>{address.slice(0, 6)}...{address.slice(-4)}</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onConnect}
              disabled={isConnecting}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs sm:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              <Wallet className="w-4 h-4" />
              <span>{isConnecting ? 'Connecting...' : 'Connect Wallet'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
