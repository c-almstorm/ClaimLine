import React, { useState } from 'react';
import { X, Calculator, ShieldCheck, AlertCircle } from 'lucide-react';
import { parseUnits } from 'viem';

interface RegisterAssetModalProps {
  isOpen: boolean;
  userAddress: `0x${string}`;
  onClose: () => void;
  onSubmit: (params: {
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
  }) => Promise<void>;
}

export const RegisterAssetModal: React.FC<RegisterAssetModalProps> = ({
  isOpen,
  userAddress,
  onClose,
  onSubmit,
}) => {
  const [assetType, setAssetType] = useState('Invoice');
  const [docId, setDocId] = useState(`INV-${Date.now().toString().slice(-6)}`);
  const [custodian, setCustodian] = useState<string>(userAddress);
  const [faceValueUSDC, setFaceValueUSDC] = useState('100.00');
  const [seniorCapUSDC, setSeniorCapUSDC] = useState('60.00');
  const [juniorCapUSDC, setJuniorCapUSDC] = useState('30.00');
  const [seniorRepayUSDC, setSeniorRepayUSDC] = useState('66.00');
  const [juniorRepayUSDC, setJuniorRepayUSDC] = useState('36.00');
  const [daysValid, setDaysValid] = useState('7');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const fv = parseFloat(faceValueUSDC) || 0;
  const sCap = parseFloat(seniorCapUSDC) || 0;
  const jCap = parseFloat(juniorCapUSDC) || 0;
  const sRep = parseFloat(seniorRepayUSDC) || 0;
  const jRep = parseFloat(juniorRepayUSDC) || 0;

  const totalCap = sCap + jCap;
  const isCapOverFace = totalCap > fv;
  const isRepayInvalid = sRep < sCap || jRep < jCap;
  const minLockEstimated = totalCap > 0 ? (totalCap / 32).toFixed(4) : '0';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCapOverFace || isRepayInvalid || totalCap <= 0) return;

    try {
      setIsSubmitting(true);
      const deadlineBigInt = BigInt(Math.floor(Date.now() / 1000) + Math.max(1, parseInt(daysValid) || 1) * 86400);

      await onSubmit({
        assetType,
        docId,
        custodian: custodian as `0x${string}`,
        obligor: userAddress,
        faceValue: parseUnits(faceValueUSDC, 6),
        seniorCapacity: parseUnits(seniorCapUSDC, 6),
        juniorCapacity: parseUnits(juniorCapUSDC, 6),
        seniorRepaymentOwed: parseUnits(seniorRepayUSDC, 6),
        juniorRepaymentOwed: parseUnits(juniorRepayUSDC, 6),
        deadline: deadlineBigInt,
      });

      onClose();
    } catch (err) {
      console.error('Registration failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Register Collateral Asset</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4 text-sm">
          {/* Obligor Notice */}
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800">
            <strong>Borrower & Obligor:</strong> Connected wallet (<code>{userAddress.slice(0, 10)}...</code>) will be set as the borrower and entitled to pull-based principal proceeds upon race close.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Asset Type</label>
              <input
                type="text"
                value={assetType}
                onChange={(e) => setAssetType(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="e.g. Invoice, RealEstate"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Document / Ref ID</label>
              <input
                type="text"
                value={docId}
                onChange={(e) => setDocId(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="e.g. INV-2026-001"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Custodian Address</label>
            <input
              type="text"
              value={custodian}
              onChange={(e) => setCustodian(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="0x..."
            />
          </div>

          {/* Face Value & Capacities */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Face Value (USDC)</label>
              <input
                type="number"
                step="any"
                min="0.01"
                value={faceValueUSDC}
                onChange={(e) => setFaceValueUSDC(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-emerald-700 mb-1">Senior Cap (USDC)</label>
              <input
                type="number"
                step="any"
                min="0"
                value={seniorCapUSDC}
                onChange={(e) => setSeniorCapUSDC(e.target.value)}
                required
                className="w-full px-3 py-2 bg-emerald-50/50 border border-emerald-300 rounded-lg text-xs font-semibold text-emerald-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-amber-700 mb-1">Junior Cap (USDC)</label>
              <input
                type="number"
                step="any"
                min="0"
                value={juniorCapUSDC}
                onChange={(e) => setJuniorCapUSDC(e.target.value)}
                required
                className="w-full px-3 py-2 bg-amber-50/50 border border-amber-300 rounded-lg text-xs font-semibold text-amber-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Repayments Owed */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Deadline (Days)</label>
              <input
                type="number"
                min="1"
                max="365"
                value={daysValid}
                onChange={(e) => setDaysValid(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-emerald-700 mb-1">Senior Repay Owed</label>
              <input
                type="number"
                step="any"
                value={seniorRepayUSDC}
                onChange={(e) => setSeniorRepayUSDC(e.target.value)}
                required
                className="w-full px-3 py-2 bg-emerald-50/50 border border-emerald-300 rounded-lg text-xs font-semibold text-emerald-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-amber-700 mb-1">Junior Repay Owed</label>
              <input
                type="number"
                step="any"
                value={juniorRepayUSDC}
                onChange={(e) => setJuniorRepayUSDC(e.target.value)}
                required
                className="w-full px-3 py-2 bg-amber-50/50 border border-amber-300 rounded-lg text-xs font-semibold text-amber-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Validation Warnings & Live minLock Calculation */}
          <div className="pt-2">
            {isCapOverFace && (
              <div className="flex items-center gap-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>Senior ({sCap}) + Junior ({jCap}) = {totalCap} USDC exceeds Face Value ({fv} USDC).</span>
              </div>
            )}
            {isRepayInvalid && (
              <div className="flex items-center gap-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs mt-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>Repayments owed cannot be less than their respective principal capacities.</span>
              </div>
            )}
            {!isCapOverFace && !isRepayInvalid && (
              <div className="flex items-center justify-between p-2.5 bg-slate-100 rounded-lg text-slate-700 text-xs">
                <span className="flex items-center gap-1.5 font-medium">
                  <Calculator className="w-4 h-4 text-blue-600" />
                  Calculated Minimum Lock (<code>minLock</code>):
                </span>
                <span className="font-bold text-slate-900">~{minLockEstimated} USDC</span>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isCapOverFace || isRepayInvalid}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Registering...' : 'Confirm Registration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
