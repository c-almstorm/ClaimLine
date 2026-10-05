import React from 'react';
import { Loader2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { ChainConfig } from '../config';

export interface TxState {
  isOpen: boolean;
  status: 'idle' | 'approving' | 'pending' | 'success' | 'error';
  title: string;
  description: string;
  txHash?: `0x${string}` | string;
  approvalTxHash?: `0x${string}` | string;
  errorMessage?: string;
}

interface TxModalProps {
  state: TxState;
  activeConfig: ChainConfig;
  onClose: () => void;
}

export const TxModal: React.FC<TxModalProps> = ({ state, activeConfig, onClose }) => {
  if (!state.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 text-center animate-in fade-in zoom-in-95 duration-150">
        {/* Status Icons */}
        <div className="flex justify-center mb-4">
          {state.status === 'approving' || state.status === 'pending' ? (
            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : state.status === 'success' ? (
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
              <XCircle className="w-8 h-8" />
            </div>
          )}
        </div>

        {/* Title & Description */}
        <h3 className="text-lg font-bold text-slate-900 mb-1">{state.title}</h3>
        <p className="text-sm text-slate-600 mb-5">{state.description}</p>

        {/* Error message */}
        {state.errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-mono text-left mb-4 break-words max-h-32 overflow-y-auto">
            {state.errorMessage}
          </div>
        )}

        {/* Tx Links */}
        <div className="space-y-2 mb-6">
          {state.approvalTxHash && (
            <a
              href={`${activeConfig.blockExplorers.default.url}/tx/${state.approvalTxHash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 underline font-medium"
            >
              <span>USDC Approval Transaction</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          {state.txHash && (
            <div>
              <a
                href={`${activeConfig.blockExplorers.default.url}/tx/${state.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 underline font-medium"
              >
                <span>View Action on Explorer ({state.txHash.slice(0, 10)}...)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>

        {/* Close button */}
        {(state.status === 'success' || state.status === 'error') && (
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
};
