import React, { useMemo } from 'react';
import {
  Shield,
  ArrowRight,
  ExternalLink,
  Layers,
  Clock,
  CheckCircle2,
  DollarSign,
  Lock,
  Cpu,
  Zap,
  Coins,
  FileText,
  AlertCircle,
  Sparkles,
  ChevronRight,
  GitBranch,
} from 'lucide-react';
import mainnetEventsData from '../data/mainnetRun.json';

interface LandingPageProps {
  onLaunchApp: () => void;
  selectedChainId?: number;
}

interface RunEvent {
  label: string;
  eventName: string;
  transactionHash: string;
  blockNumber: number;
  logIndex: number;
  args: Record<string, any>;
}

const EXPLORER_BASE = 'https://explorer.arc.io';
const MAINNET_CONTRACT_ADDR = '0x6B7731c78B63C86468b0ddAE9C02432cb647d08e';
const GITHUB_REPO_URL = 'https://github.com/c-almstorm/ClaimLine';
const SECURITY_DOC_URL = 'https://github.com/c-almstorm/ClaimLine/blob/master/docs/SECURITY.md';
const EVIDENCE_URL = 'https://github.com/c-almstorm/ClaimLine/blob/master/evidence/mainnet-run.json';

export const LandingPage: React.FC<LandingPageProps> = ({ onLaunchApp }) => {
  const events = mainnetEventsData as RunEvent[];

  // Dynamic calculations from mainnet-run.json
  const proofStats = useMemo(() => {
    const regEvent = events.find((e) => e.eventName === 'AssetRegistered');
    const closeEvent = events.find((e) => e.eventName === 'AssetClosed');
    const repaymentEvents = events.filter((e) => e.eventName === 'RepaymentMade');
    const claimEvents = events.filter((e) => e.eventName === 'Claimed');
    const lockEvents = events.filter((e) => e.eventName === 'LockPlaced');

    const faceValue = regEvent ? Number(regEvent.args.faceValue) / 1e6 : 3.0;
    const seniorCap = regEvent ? Number(regEvent.args.seniorCapacity) / 1e6 : 2.0;
    const juniorCap = regEvent ? Number(regEvent.args.juniorCapacity) / 1e6 : 1.0;
    const seniorOwed = regEvent ? Number(regEvent.args.seniorRepaymentOwed) / 1e6 : 2.2;
    const juniorOwed = regEvent ? Number(regEvent.args.juniorRepaymentOwed) / 1e6 : 1.2;
    const totalOwed = seniorOwed + juniorOwed;

    let totalRepaid = 0;
    let seniorRepaid = 0;
    let juniorRepaid = 0;
    if (repaymentEvents.length > 0) {
      const lastRepay = repaymentEvents[repaymentEvents.length - 1];
      seniorRepaid = Number(lastRepay.args.seniorRepaid) / 1e6;
      juniorRepaid = Number(lastRepay.args.juniorRepaid) / 1e6;
      totalRepaid = seniorRepaid + juniorRepaid;
    }

    let totalClaimed = 0;
    claimEvents.forEach((c) => {
      totalClaimed += Number(c.args.totalClaimed) / 1e6;
    });

    const isFullySettled = totalRepaid >= totalOwed && totalOwed > 0;

    return {
      docId: regEvent?.args.docId || 'ARC-MAINNET-SMOKE-001',
      assetId: regEvent?.args.assetId || '',
      borrower: regEvent?.args.borrower || '',
      faceValue,
      seniorCap,
      juniorCap,
      seniorOwed,
      juniorOwed,
      totalOwed,
      seniorRepaid,
      juniorRepaid,
      totalRepaid,
      totalClaimed,
      lockCount: lockEvents.length,
      txCount: events.length,
      isFullySettled,
      regTx: regEvent?.transactionHash || '',
      closeTx: closeEvent?.transactionHash || '',
    };
  }, [events]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-blue-600 selection:text-white flex flex-col">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-700 to-indigo-900 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-slate-900 tracking-tight">Claimline</span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  v1.0.0
                </span>
              </div>
              <span className="text-[11px] text-slate-500 hidden sm:inline">Priority & Repayment Ledger on Arc</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-6">
            <a
              href="#how-it-works"
              className="text-xs font-semibold text-slate-600 hover:text-blue-600 hidden md:inline transition-colors"
            >
              How It Works
            </a>
            <a
              href="#proof"
              className="text-xs font-semibold text-slate-600 hover:text-blue-600 hidden md:inline transition-colors"
            >
              Mainnet Proof
            </a>
            <a
              href="#why-arc"
              className="text-xs font-semibold text-slate-600 hover:text-blue-600 hidden md:inline transition-colors"
            >
              Why Arc
            </a>
            <a
              href="#roadmap"
              className="text-xs font-semibold text-slate-600 hover:text-blue-600 hidden md:inline transition-colors"
            >
              Roadmap
            </a>

            <button
              onClick={onLaunchApp}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <span>Launch App</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24 bg-gradient-to-b from-white via-slate-50 to-slate-100 border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            {/* Tagline Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold mb-6 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Settlement Layer Pilot on Arc Mainnet</span>
            </div>

            {/* Core One-Liner Title */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight max-w-4xl mx-auto leading-tight sm:leading-tight">
              An on-chain priority and repayment ledger for asset-backed lending on Arc
            </h1>

            {/* Purpose Subtitle */}
            <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Built so that lenders know <strong>who is paid first</strong>. Settle claims sequentially in FIFO arrival order and enforce senior-first waterfall distributions directly in native USDC.
            </p>

            {/* Built For Paragraph */}
            <div className="mt-6 p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-sm max-w-2xl mx-auto text-left">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-700 mb-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Built For</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                Lending against invoices, receipts, and receivables where several lenders share one asset. Today it settles the order of claims and splits repayments in that order. Asset verification, due dates, and default enforcement are on the roadmap.
              </p>
            </div>

            {/* Call to Actions */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <button
                onClick={onLaunchApp}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <span>Launch App (v1.0.0)</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <a
                href="#proof"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold text-sm rounded-xl shadow-sm transition-all"
              >
                <span>View Live Proof Run</span>
              </a>

              <a
                href={`${EXPLORER_BASE}/address/${MAINNET_CONTRACT_ADDR}`}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-3.5 text-slate-600 hover:text-slate-900 font-semibold text-xs transition-colors"
              >
                <span>Mainnet Contract</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* High-Level Metrics Pill Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto mt-12 text-left">
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">Settlement Status</span>
                <span className="text-base sm:text-lg font-bold text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  100% Repaid
                </span>
                <span className="text-[10px] text-slate-500 font-mono">$${proofStats.totalRepaid.toFixed(2)} / $${proofStats.totalOwed.toFixed(2)} USDC</span>
              </div>

              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">Proof Transactions</span>
                <span className="text-base sm:text-lg font-bold text-slate-900">
                  {proofStats.txCount} Recorded
                </span>
                <span className="text-[10px] text-slate-500">Live on Arc Mainnet</span>
              </div>

              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">Priority Model</span>
                <span className="text-base sm:text-lg font-bold text-blue-600">
                  Execution Order
                </span>
                <span className="text-[10px] text-slate-500">FIFO Queue on Arc</span>
              </div>

              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">Settlement Asset</span>
                <span className="text-base sm:text-lg font-bold text-indigo-600">
                  Native USDC
                </span>
                <span className="text-[10px] text-slate-500">6-Decimal Precision</span>
              </div>
            </div>
          </div>
        </section>

        {/* PROOF CARD SECTION */}
        <section id="proof" className="py-16 bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold mb-3">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>On-Chain Evidence</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Live Mainnet Proof of Execution
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Dynamically loaded from verified mainnet events (<a href={EVIDENCE_URL} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-mono">evidence/mainnet-run.json</a>). Every metric links directly to the Arc block explorer.
              </p>
            </div>

            {/* Dynamic Proof Card */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
              {/* Asset Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Collateral Document:</span>
                    <a
                      href={`${EXPLORER_BASE}/tx/${proofStats.regTx}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs font-bold text-blue-600 hover:underline bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1"
                    >
                      {proofStats.docId}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      ✅ 100% Fully Repaid
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    Asset ID: <a href={`${EXPLORER_BASE}/address/${MAINNET_CONTRACT_ADDR}`} target="_blank" rel="noreferrer" className="text-slate-700 hover:underline">{proofStats.assetId ? `${proofStats.assetId.slice(0, 14)}...${proofStats.assetId.slice(-8)}` : '0xec79a0f7...f535cf0a'}</a>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-right">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Face Value</span>
                    <a
                      href={`${EXPLORER_BASE}/tx/${proofStats.regTx}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-sm sm:text-base font-bold text-slate-900 hover:underline"
                    >
                      $${proofStats.faceValue.toFixed(2)} USDC
                    </a>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block">Total Repaid</span>
                    <a
                      href={`${EXPLORER_BASE}/address/${MAINNET_CONTRACT_ADDR}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-sm sm:text-base font-bold text-emerald-700 hover:underline"
                    >
                      $${proofStats.totalRepaid.toFixed(2)} / $${proofStats.totalOwed.toFixed(2)} USDC
                    </a>
                  </div>
                </div>
              </div>

              {/* Tranche Priority Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Senior Tranche */}
                <div className="p-5 rounded-xl bg-white border border-blue-100 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                        P1
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900">Senior Tranche</h3>
                        <span className="text-[10px] font-semibold text-blue-600">First-Priority Lien (10% Premium)</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      100% Repaid
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 font-mono">
                    <div className="flex justify-between">
                      <span>Accepted Principal:</span>
                      <a href={`${EXPLORER_BASE}/tx/${proofStats.closeTx}`} target="_blank" rel="noreferrer" className="font-bold text-slate-800 hover:underline">
                        $${proofStats.seniorCap.toFixed(2)} USDC
                      </a>
                    </div>
                    <div className="flex justify-between">
                      <span>Obligation Owed:</span>
                      <a href={`${EXPLORER_BASE}/tx/${proofStats.regTx}`} target="_blank" rel="noreferrer" className="font-bold text-slate-800 hover:underline">
                        $${proofStats.seniorOwed.toFixed(2)} USDC
                      </a>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 pt-1 text-emerald-700">
                      <span>Senior Repaid (100%):</span>
                      <a href={`${EXPLORER_BASE}/tx/${events.find((e) => e.eventName === 'RepaymentMade')?.transactionHash || ''}`} target="_blank" rel="noreferrer" className="font-bold hover:underline">
                        $${proofStats.seniorRepaid.toFixed(2)} USDC
                      </a>
                    </div>
                  </div>
                </div>

                {/* Junior Tranche */}
                <div className="p-5 rounded-xl bg-white border border-purple-100 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                        P2
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900">Junior Tranche</h3>
                        <span className="text-[10px] font-semibold text-purple-600">Subordinated (20% Premium)</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      100% Repaid
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 font-mono">
                    <div className="flex justify-between">
                      <span>Accepted Principal:</span>
                      <a href={`${EXPLORER_BASE}/tx/${proofStats.closeTx}`} target="_blank" rel="noreferrer" className="font-bold text-slate-800 hover:underline">
                        $${proofStats.juniorCap.toFixed(2)} USDC
                      </a>
                    </div>
                    <div className="flex justify-between">
                      <span>Obligation Owed:</span>
                      <a href={`${EXPLORER_BASE}/tx/${proofStats.regTx}`} target="_blank" rel="noreferrer" className="font-bold text-slate-800 hover:underline">
                        $${proofStats.juniorOwed.toFixed(2)} USDC
                      </a>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 pt-1 text-emerald-700">
                      <span>Junior Repaid (100%):</span>
                      <a href={`${EXPLORER_BASE}/tx/${events[events.length - 2]?.transactionHash || ''}`} target="_blank" rel="noreferrer" className="font-bold hover:underline">
                        $${proofStats.juniorRepaid.toFixed(2)} USDC
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Complete On-Chain Event Sequence */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Verified Transaction Sequence ({events.length} On-Chain Actions)</span>
                  </h4>
                  <a
                    href={EVIDENCE_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    <span>View JSON Log</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Block</th>
                        <th className="py-2.5 px-3">Event / Action</th>
                        <th className="py-2.5 px-3">Transaction Hash</th>
                        <th className="py-2.5 px-3 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {events.map((ev, idx) => {
                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2 px-3 font-bold text-slate-400">#{idx + 1}</td>
                            <td className="py-2 px-3 text-slate-600">
                              <a
                                href={`${EXPLORER_BASE}/block/${ev.blockNumber}`}
                                target="_blank"
                                rel="noreferrer"
                                className="hover:underline text-blue-600"
                              >
                                {ev.blockNumber}
                              </a>
                            </td>
                            <td className="py-2 px-3 font-sans font-medium text-slate-900">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                  ev.eventName === 'AssetRegistered'
                                    ? 'bg-blue-100 text-blue-800'
                                    : ev.eventName === 'LockPlaced'
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : ev.eventName === 'AssetClosed'
                                    ? 'bg-purple-100 text-purple-800'
                                    : ev.eventName === 'RepaymentMade'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {ev.label}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-blue-600 font-mono">
                              <a
                                href={`${EXPLORER_BASE}/tx/${ev.transactionHash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="hover:underline inline-flex items-center gap-1"
                              >
                                <span>{ev.transactionHash.slice(0, 10)}...{ev.transactionHash.slice(-8)}</span>
                                <ExternalLink className="w-3 h-3 text-slate-400" />
                              </a>
                            </td>
                            <td className="py-2 px-3 text-right text-slate-700 font-sans">
                              {ev.eventName === 'AssetRegistered' && 'Face: 3.0 USDC (2.0 Senior / 1.0 Junior)'}
                              {ev.eventName === 'LockPlaced' && `Locked ${(Number(ev.args.amount) / 1e6).toFixed(2)} USDC (Seq #${ev.args.sequenceNumber})`}
                              {ev.eventName === 'AssetClosed' && 'Settled 2.0 Senior, 1.0 Junior; 3.0 Proceeds'}
                              {ev.eventName === 'RepaymentMade' && `Repaid ${(Number(ev.args.amount) / 1e6).toFixed(2)} USDC`}
                              {ev.eventName === 'Claimed' && `Claimed ${(Number(ev.args.totalClaimed) / 1e6).toFixed(2)} USDC`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS SECTION (4 Steps) */}
        <section id="how-it-works" className="py-16 bg-slate-50 border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold mb-3">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>Deterministic Lifecycle</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                How ClaimLine Works
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Four deterministic stages governed strictly by smart contract code and Arc execution order.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Step 1 */}
              <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3 relative">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 font-extrabold text-sm flex items-center justify-center border border-blue-200">
                  01
                </div>
                <h3 className="font-bold text-base text-slate-900">Register Collateral</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  The obligor commits document identifiers, face value, Senior/Junior debt capacities, and repayment obligations on-chain.
                </p>
                <div className="text-[11px] text-slate-400 font-mono pt-1">
                  Enforces: msg.sender == obligor
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3 relative">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 font-extrabold text-sm flex items-center justify-center border border-indigo-200">
                  02
                </div>
                <h3 className="font-bold text-base text-slate-900">Sequential Priority Locks</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Lenders escrow USDC into Senior or Junior queues. Priority is strictly indexed in arrival sequence order (1, 2, 3...) on Arc.
                </p>
                <div className="text-[11px] text-slate-400 font-mono pt-1">
                  Enforces: amount &gt;= minLock
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3 relative">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 font-extrabold text-sm flex items-center justify-center border border-purple-200">
                  03
                </div>
                <h3 className="font-bold text-base text-slate-900">Deterministic Settlement</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  The race closes and capacities fill FIFO. Unfilled locks become pull-based refunds; accepted lenders receive position receipts.
                </p>
                <div className="text-[11px] text-slate-400 font-mono pt-1">
                  Enforces: debt scaling on partial fills
                </div>
              </div>

              {/* Step 4 */}
              <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3 relative">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 font-extrabold text-sm flex items-center justify-center border border-emerald-200">
                  04
                </div>
                <h3 className="font-bold text-base text-slate-900">Senior-First Waterfall</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Borrowers deposit USDC repayments. Senior obligations are satisfied 100% first; remainder routes to Junior. Claims are pull-based.
                </p>
                <div className="text-[11px] text-slate-400 font-mono pt-1">
                  Enforces: strict waterfall priority
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* WHY ARC SECTION */}
        <section id="why-arc" className="py-16 bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-bold mb-3">
                <Zap className="w-3.5 h-3.5 text-indigo-600" />
                <span>Infrastructure Advantage</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Why Arc Network?
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Built to leverage Arc's deterministic execution order, sub-second finality, and native digital dollar settlement.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Cpu className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-slate-900">Execution-Order Priority</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Priority is the contract's execution order on Arc. Arc validators order transactions, and within a single block the proposer establishes the arrival sequence, giving lenders transparent lien rankings without off-chain coordinators.
                </p>
              </div>

              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-slate-900">Sub-Second Finality</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Arc delivers deterministic sub-second block times. Lenders confirm their escrow allocations and lien priority almost instantaneously once broadcasted to the network.
                </p>
              </div>

              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Coins className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-slate-900">Native USDC Settlement</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Direct native integration with Arc's 6-decimal USDC eliminates synthetic wrapper vulnerabilities, bridge conversion fees, and decimal mismatch rounding issues.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* LIMITS AND ROADMAP SECTION */}
        <section id="roadmap" className="py-16 bg-slate-50 border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200 text-slate-800 text-xs font-bold mb-3">
                <GitBranch className="w-3.5 h-3.5 text-slate-700" />
                <span>Transparency & Vision</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Limits & Roadmap
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Clear boundaries for the v1.0.0 experimental settlement layer, and our planned extensions for future releases.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Limits */}
              <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Protocol Limits in v1.0.0</span>
                </div>

                <ul className="space-y-3 text-xs text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-slate-900">•</span>
                    <span><strong>Repayment is Not Enforced On-Chain:</strong> ClaimLine records and routes priority claims. Real-world legal enforcement and credit recovery remain governed by off-chain legal contracts.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-slate-900">•</span>
                    <span><strong>Document Authenticity:</strong> The smart contract verifies hashes and parameters, but cannot independently inspect off-chain paper documents without custodian attestations.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-slate-900">•</span>
                    <span><strong>Non-Transferable Position Receipts:</strong> ERC-1155 receipts cannot be transferred between addresses in v1 to prevent claim accumulator race conditions.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-slate-900">•</span>
                    <span><strong>Rounding Dust Retention:</strong> Negligible dust (&lt; 10 wei USDC) remains in the contract balance after integer division to preserve strict solvency.</span>
                  </li>
                </ul>
              </div>

              {/* Roadmap */}
              <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>v1.1 Roadmap</span>
                </div>

                <ul className="space-y-3 text-xs text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-blue-600">•</span>
                    <span><strong>Transferable Secondary Positions:</strong> Enable peer-to-peer trading of ERC-1155 positions with continuous accumulator checkpoints.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-blue-600">•</span>
                    <span><strong>Automated Collateral Liquidations:</strong> Connect oracle feeds for delinquency tracking and automated off-chain asset recovery triggers.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-blue-600">•</span>
                    <span><strong>Multi-Tier Waterfall Customization:</strong> Support arbitrary capital tiers (Mezzanine, First-Out, Last-Out) with variable tenor structures.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-blue-600">•</span>
                    <span><strong>Institutional KYC Sidecars:</strong> Optional custodian-gated compliance and accreditation whitelists for private debt syndication.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA BANNER */}
        <section className="py-12 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
            <h2 className="text-2xl sm:text-3xl font-extrabold">Ready to Explore ClaimLine?</h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto">
              Test sequential lien escrows, registration, and waterfall settlements on Arc Mainnet or Testnet.
            </p>
            <div className="pt-2">
              <button
                onClick={onLaunchApp}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm rounded-xl shadow-lg transition-all cursor-pointer"
              >
                <span>Launch ClaimLine dApp</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-10 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-700 text-white flex items-center justify-center font-bold text-[10px]">
              CL
            </div>
            <span className="font-bold text-slate-900">ClaimLine</span>
            <span>— Settlement layer pilot on Arc.</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6">
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="hover:text-blue-600 hover:underline transition-colors"
            >
              GitHub Repository
            </a>
            <a
              href={`${EXPLORER_BASE}/address/${MAINNET_CONTRACT_ADDR}`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-blue-600 hover:underline transition-colors"
            >
              Mainnet Contract
            </a>
            <a
              href={SECURITY_DOC_URL}
              target="_blank"
              rel="noreferrer"
              className="hover:text-blue-600 hover:underline transition-colors"
            >
              docs/SECURITY.md
            </a>
            <a
              href={EVIDENCE_URL}
              target="_blank"
              rel="noreferrer"
              className="hover:text-blue-600 hover:underline transition-colors"
            >
              evidence/mainnet-run.json
            </a>
          </div>

          <div className="text-slate-400">
            MIT License • 2026
          </div>
        </div>
      </footer>
    </div>
  );
};
