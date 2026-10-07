import React, { useState } from 'react';
import { X, Calculator, ShieldCheck, AlertCircle, AlertTriangle, Sparkles, RotateCcw } from 'lucide-react';
import { parseUnits } from 'viem';
import {
  ZERO_ADDRESS,
  calculateRepaymentOwed,
  calculateRepaymentOwedBigInt,
  validateCapacities,
  isSeniorPremiumHigher,
  formatRegistrationSummary,
} from '../utils/calc';

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

const ASSET_TYPES = [
  'Invoice',
  'Warehouse receipt',
  'Trade receivable',
  'Other',
];

export const RegisterAssetModal: React.FC<RegisterAssetModalProps> = ({
  isOpen,
  userAddress,
  onClose,
  onSubmit,
}) => {
  const [assetType, setAssetType] = useState('');
  const [docId, setDocId] = useState('');
  const [custodian, setCustodian] = useState('');
  const [faceValueUSDC, setFaceValueUSDC] = useState('');
  const [seniorCapUSDC, setSeniorCapUSDC] = useState('');
  const [juniorCapUSDC, setJuniorCapUSDC] = useState('');
  const [seniorPremium, setSeniorPremium] = useState('');
  const [juniorPremium, setJuniorPremium] = useState('');
  const [daysValid, setDaysValid] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleFillExample = () => {
    setAssetType('Invoice');
    setDocId('ARC-EXAMPLE-001');
    setCustodian('');
    setFaceValueUSDC('3');
    setSeniorCapUSDC('2');
    setSeniorPremium('10');
    setJuniorCapUSDC('1');
    setJuniorPremium('20');
    setDaysValid('7');
  };

  const handleClearForm = () => {
    setAssetType('');
    setDocId('');
    setCustodian('');
    setFaceValueUSDC('');
    setSeniorCapUSDC('');
    setJuniorCapUSDC('');
    setSeniorPremium('');
    setJuniorPremium('');
    setDaysValid('');
  };

  const capValidation = validateCapacities(faceValueUSDC, seniorCapUSDC, juniorCapUSDC);
  const seniorOwed = calculateRepaymentOwed(seniorCapUSDC, seniorPremium);
  const juniorOwed = calculateRepaymentOwed(juniorCapUSDC, juniorPremium);
  const seniorPremiumHigher = Boolean(
    seniorPremium && juniorPremium && isSeniorPremiumHigher(seniorPremium, juniorPremium)
  );

  const fv = parseFloat(faceValueUSDC) || 0;
  const sCap = parseFloat(seniorCapUSDC) || 0;
  const jCap = parseFloat(juniorCapUSDC) || 0;
  const totalCap = capValidation.totalCapacity;
  const minLockEstimated = totalCap > 0 ? (totalCap / 32).toFixed(6) : '0';

  const isFormIncomplete =
    !assetType ||
    !docId.trim() ||
    fv <= 0 ||
    totalCap <= 0 ||
    !seniorCapUSDC ||
    !juniorCapUSDC ||
    !seniorPremium ||
    !juniorPremium ||
    !daysValid;

  const isSubmissionBlocked = !capValidation.valid || isFormIncomplete;

  const summaryLine =
    totalCap > 0
      ? formatRegistrationSummary(
          assetType,
          faceValueUSDC,
          seniorCapUSDC,
          seniorPremium,
          juniorCapUSDC,
          juniorPremium
        )
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmissionBlocked) return;

    try {
      setIsSubmitting(true);
      const days = Math.max(1, parseInt(daysValid, 10) || 1);
      const deadlineBigInt = BigInt(Math.floor(Date.now() / 1000) + days * 86400);

      const parsedCustodian = custodian.trim()
        ? (custodian.trim() as `0x${string}`)
        : ZERO_ADDRESS;

      const seniorRepayBigInt = calculateRepaymentOwedBigInt(seniorCapUSDC, seniorPremium);
      const juniorRepayBigInt = calculateRepaymentOwedBigInt(juniorCapUSDC, juniorPremium);

      await onSubmit({
        assetType,
        docId: docId.trim(),
        custodian: parsedCustodian,
        obligor: userAddress,
        faceValue: parseUnits(faceValueUSDC, 6),
        seniorCapacity: parseUnits(seniorCapUSDC, 6),
        juniorCapacity: parseUnits(juniorCapUSDC, 6),
        seniorRepaymentOwed: seniorRepayBigInt,
        juniorRepaymentOwed: juniorRepayBigInt,
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
            <div>
              <h2 className="text-base font-bold text-slate-900">Register Collateral Asset</h2>
              <p className="text-xs text-slate-500">Record a new asset race on Arc</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center justify-between gap-2 pt-3 pb-1">
          <button
            type="button"
            onClick={handleFillExample}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Fill an example</span>
          </button>
          <button
            type="button"
            onClick={handleClearForm}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear form</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2 text-sm">
          {/* Public Data Warning */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
            <span>
              <strong>Privacy Notice:</strong> Everything you enter is public on-chain. Don't enter personal names or locations.
            </span>
          </div>

          {/* Obligor Notice */}
          <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-800">
            <strong>Borrower & Obligor:</strong> Connected wallet (<code>{userAddress.slice(0, 10)}...</code>) will be set as the borrower entitled to pull-based principal proceeds upon race close.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Asset Type</label>
              <select
                value={assetType}
                onChange={(e) => setAssetType(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">Select asset type...</option>
                {ASSET_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">Classification category of the receivable or collateral.</p>
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
              <p className="text-[11px] text-slate-400 mt-1">Unique identifier or hash for off-chain reference.</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Custodian Address <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={custodian}
              onChange={(e) => setCustodian(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="0x0000000000000000000000000000000000000000 (default)"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Leave blank to default to zero address (<code>0x0000...0000</code>), meaning no third-party custodian is designated.
            </p>
          </div>

          {/* Face Value & Capacities */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Face Value (USDC)</label>
              <input
                type="number"
                step="any"
                min="0.000001"
                value={faceValueUSDC}
                onChange={(e) => setFaceValueUSDC(e.target.value)}
                required
                placeholder="e.g. 3.00"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500 mt-1">Maximum you can raise = face value</p>
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
                placeholder="e.g. 2.00"
                className="w-full px-3 py-2 bg-emerald-50/50 border border-emerald-300 rounded-lg text-xs font-semibold text-emerald-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <p className="text-[11px] text-emerald-600/80 mt-1">First-priority principal</p>
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
                placeholder="e.g. 1.00"
                className="w-full px-3 py-2 bg-amber-50/50 border border-amber-300 rounded-lg text-xs font-semibold text-amber-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
              <p className="text-[11px] text-amber-600/80 mt-1">Second-priority principal</p>
            </div>
          </div>

          {/* Premium (%) and Repayments Owed */}
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
                placeholder="e.g. 7"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">Lock race duration</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-emerald-700 mb-1">Senior Premium (%)</label>
              <input
                type="number"
                step="any"
                min="0"
                value={seniorPremium}
                onChange={(e) => setSeniorPremium(e.target.value)}
                required
                placeholder="e.g. 10"
                className="w-full px-3 py-2 bg-emerald-50/50 border border-emerald-300 rounded-lg text-xs font-semibold text-emerald-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <p className="text-[11px] text-emerald-700 font-medium mt-1">
                You will owe {seniorOwed} USDC
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-amber-700 mb-1">Junior Premium (%)</label>
              <input
                type="number"
                step="any"
                min="0"
                value={juniorPremium}
                onChange={(e) => setJuniorPremium(e.target.value)}
                required
                placeholder="e.g. 20"
                className="w-full px-3 py-2 bg-amber-50/50 border border-amber-300 rounded-lg text-xs font-semibold text-amber-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
              <p className="text-[11px] text-amber-700 font-medium mt-1">
                You will owe {juniorOwed} USDC
              </p>
            </div>
          </div>

          {/* Validation Warnings */}
          <div className="space-y-2 pt-1">
            {seniorPremiumHigher && (
              <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-800 text-xs">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                <span>
                  <strong>Premium Inversion Warning:</strong> Senior premium ({seniorPremium}%) is higher than junior premium ({juniorPremium}%). Senior lenders take lower risk and typically receive a lower premium than junior lenders.
                </span>
              </div>
            )}

            {!capValidation.valid && (faceValueUSDC || seniorCapUSDC || juniorCapUSDC) && (
              <div className="flex items-center gap-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{capValidation.error}</span>
              </div>
            )}

            {capValidation.valid && totalCap > 0 && (
              <div className="flex items-center justify-between p-2.5 bg-slate-100 rounded-lg text-slate-700 text-xs">
                <span className="flex items-center gap-1.5 font-medium">
                  <Calculator className="w-4 h-4 text-blue-600" />
                  Calculated Minimum Lock (<code>minLock</code>):
                </span>
                <span className="font-bold text-slate-900">~{minLockEstimated} USDC</span>
              </div>
            )}
          </div>

          {/* One-line summary before submission */}
          {summaryLine && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed font-mono">
              <strong className="text-slate-900 font-sans block mb-0.5">Registration Summary:</strong>
              {summaryLine}
            </div>
          )}

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
              disabled={isSubmitting || isSubmissionBlocked}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Registering...' : 'Confirm Registration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
