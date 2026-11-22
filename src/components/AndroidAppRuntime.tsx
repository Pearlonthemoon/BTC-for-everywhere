import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BatteryCharging,
  Check,
  Coins,
  Copy,
  Download,
  ExternalLink,
  Play,
  ShieldCheck,
  Smartphone,
  Timer,
  Wifi,
} from 'lucide-react';
import type { AppConfig, ChainId } from '../types/app';
import { buildPaymentUri, CHAIN_META, shortenAddress, usdToCrypto, validateWalletAddress } from '../utils/cryptoValidation';
import { QRCodeCard } from './QRCodeCard';
import { PWAInstallButton } from './PWAInstallButton';

interface AndroidAppRuntimeProps {
  config: AppConfig;
  standalone?: boolean;
  onRecordDownload: (payload: { chain: ChainId; customUsd: number; txRef?: string }) => Promise<void>;
  onRecordRun: (payload: { chain: ChainId; amountUsd: number; txRef?: string; isTip?: boolean }) => Promise<void>;
  onNavigateSetup?: () => void;
}

export const AndroidAppRuntime: React.FC<AndroidAppRuntimeProps> = ({
  config,
  standalone = false,
  onRecordDownload,
  onRecordRun,
  onNavigateSetup,
}) => {
  const activeWallets = useMemo(
    () => config.wallets.filter((w) => w.enabled && validateWalletAddress(w.chain, w.address).valid),
    [config.wallets]
  );

  const [selectedChain, setSelectedChain] = useState<ChainId>(activeWallets[0]?.chain ?? 'BTC');
  const [phase, setPhase] = useState<'download' | 'running'>('download');
  const [txRef, setTxRef] = useState('');
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [runCountLocal, setRunCountLocal] = useState(0);
  const [usdInput, setUsdInput] = useState<string>('25');

  React.useEffect(() => {
    if (activeWallets.length > 0 && !activeWallets.some((w) => w.chain === selectedChain)) {
      setSelectedChain(activeWallets[0].chain);
    }
  }, [activeWallets, selectedChain]);

  const activeWallet = activeWallets.find((w) => w.chain === selectedChain) ?? activeWallets[0] ?? null;

  const downloadUsd = config.downloadModel === 'free_run_share' ? 0 : config.downloadPriceUsd;
  const creatorDownloadShareUsd = Number(((downloadUsd * config.creatorSharePercent) / 100).toFixed(2));
  const creatorRunShareUsd = Number(((config.runShareUsd * config.creatorSharePercent) / 100).toFixed(2));

  const paymentUri = activeWallet
    ? buildPaymentUri(activeWallet, Math.max(downloadUsd, 1), `${config.appName} Download`)
    : '';

  const copyAddress = async () => {
    if (!activeWallet) return;
    await navigator.clipboard.writeText(activeWallet.address.trim());
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 1800);
  };

  const handleDownloadAndLaunch = async () => {
    if (!activeWallet) return;
    setBusy(true);
    setFeedback('');
    try {
      await onRecordDownload({
        chain: activeWallet.chain,
        customUsd: downloadUsd,
        txRef: txRef.trim() || undefined,
      });
      setPhase('running');
      setFeedback(
        downloadUsd > 0
          ? `Download unlocked. Creator share ($${creatorDownloadShareUsd.toFixed(2)} in ${activeWallet.chain}) recorded.`
          : `App installed & launched. Creator receives $${creatorRunShareUsd.toFixed(2)} per active run.`
      );
    } finally {
      setBusy(false);
    }
  };

  const handleTriggerRun = async (tipUsd?: number) => {
    if (!activeWallet) return;
    setBusy(true);
    setFeedback('');
    try {
      const gross = tipUsd ?? config.runShareUsd;
      await onRecordRun({
        chain: activeWallet.chain,
        amountUsd: gross,
        isTip: typeof tipUsd === 'number',
      });
      setRunCountLocal((c) => c + 1);
      const share = ((gross * config.creatorSharePercent) / 100).toFixed(2);
      setFeedback(
        typeof tipUsd === 'number'
          ? `Sent $${tipUsd.toFixed(2)} supporter tip ($${share} creator share to ${activeWallet.chain}).`
          : `Run session #${runCountLocal + 1} recorded ($${share} creator share to ${activeWallet.chain}).`
      );
    } finally {
      setBusy(false);
    }
  };

  const parsedUsd = Math.max(0, Number.parseFloat(usdInput) || 0);

  const phoneBody = (
    <div className="flex h-full flex-col bg-slate-50 text-slate-900">
      {/* Android Status Bar */}
      <div className="flex items-center justify-between bg-slate-900 px-5 py-2 text-[11px] font-medium text-slate-200">
        <span className="font-mono tabular-nums">9:41</span>
        <div className="flex items-center gap-2">
          <Wifi className="h-3.5 w-3.5" />
          <BatteryCharging className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* Android App Top Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{config.appName}</p>
          <p className="truncate text-[11px] text-slate-500">
            v{config.version} · {config.creatorSharePercent}% creator share
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {phase === 'running' && (
            <button
              type="button"
              onClick={() => setPhase('download')}
              className="min-h-[36px] rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Unlock Info
            </button>
          )}
          {standalone && <PWAInstallButton compact />}
        </div>
      </div>

      {/* Main Scrollable App Viewport */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!activeWallet ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
            <Smartphone className="mx-auto h-8 w-8 text-amber-700" />
            <h3 className="mt-3 text-base font-semibold text-slate-900">Creator Address Needed</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              Enter at least one valid BTC or crypto address in Creator Setup so users can download and send your revenue share.
            </p>
            {onNavigateSetup && (
              <button
                type="button"
                onClick={onNavigateSetup}
                className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-medium text-white"
              >
                <span>Enter BTC Address</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : phase === 'download' ? (
          <>
            {/* App Hero Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <img
                  src="/icon.svg"
                  alt={config.appName}
                  className="h-12 w-12 shrink-0 rounded-xl border border-slate-200"
                />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold text-slate-900">{config.appName}</h2>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{config.tagline}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
                <div>
                  <span className="text-slate-500">Download Unlock</span>
                  <p className="mt-0.5 font-mono font-semibold tabular-nums text-slate-900">
                    {downloadUsd === 0 ? 'Free' : `$${downloadUsd.toFixed(2)}`}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Creator Share</span>
                  <p className="mt-0.5 font-mono font-semibold tabular-nums text-amber-700">
                    {config.creatorSharePercent}% · ${creatorDownloadShareUsd.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Chain Selector & QR */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900">Select Payout Coin</span>
                <span className="text-[11px] text-slate-500">Direct wallet routing</span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {activeWallets.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setSelectedChain(w.chain)}
                    className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      selectedChain === w.chain
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {w.chain} · {w.splitPercent}%
                  </button>
                ))}
              </div>

              <div className="flex flex-col items-center rounded-xl bg-slate-50 p-3">
                <QRCodeCard
                  value={paymentUri}
                  size={136}
                  alt={`${activeWallet.chain} creator payment QR code`}
                />
                <p className="mt-2 font-mono text-[11px] font-medium tabular-nums text-slate-700">
                  {usdToCrypto(Math.max(downloadUsd, 1), activeWallet.chain)} {activeWallet.chain}
                </p>
              </div>

              <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="truncate font-mono text-[11px] text-slate-700" title={activeWallet.address}>
                  {shortenAddress(activeWallet.address)}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => void copyAddress()}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                  >
                    {copiedAddr ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedAddr ? 'Copied' : 'Copy'}</span>
                  </button>
                  <a
                    href={paymentUri}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span>Wallet</span>
                  </a>
                </div>
              </div>

              <div>
                <label htmlFor="android-tx-ref" className="block text-[11px] font-medium text-slate-600">
                  Optional TXID / Payment Reference
                </label>
                <input
                  id="android-tx-ref"
                  type="text"
                  value={txRef}
                  onChange={(e) => setTxRef(e.target.value)}
                  placeholder="Paste TX hash or leave blank for demo unlock"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => void handleDownloadAndLaunch()}
              className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              <span>{busy ? 'Recording Download...' : 'Download & Run Android App'}</span>
            </button>
          </>
        ) : (
          <>
            {/* Active Running Android App View */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="h-4 w-4 text-emerald-700" />
                <span>App Running · Verified Creator Split Active</span>
              </div>
              <p className="mt-1 text-emerald-800">
                {config.creatorSharePercent}% of active run shares route to {shortenAddress(activeWallet.address)} ({activeWallet.chain}).
              </p>
            </div>

            {/* Built-in Utility Tool inside the Android App */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-amber-600" />
                  <h3 className="text-sm font-semibold text-slate-900">Multi-Chain Sats &amp; Value Tool</h3>
                </div>
                <span className="font-mono text-[11px] tabular-nums text-slate-500">Runs: {runCountLocal}</span>
              </div>

              <div>
                <label htmlFor="sats-usd" className="block text-[11px] font-medium text-slate-600">
                  Enter USD Amount to Convert
                </label>
                <input
                  id="sats-usd"
                  type="number"
                  min={0}
                  value={usdInput}
                  onChange={(e) => setUsdInput(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-base font-semibold tabular-nums text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(['BTC', 'ETH', 'SOL', 'USDT'] as ChainId[]).map((c) => (
                  <div key={c} className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                    <div className="text-[11px] font-medium text-slate-500">{CHAIN_META[c].name}</div>
                    <div className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-slate-900">
                      {usdToCrypto(parsedUsd, c)} {c}
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => void handleTriggerRun()}
                className="flex w-full min-h-[46px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Run Utility Session (+${creatorRunShareUsd.toFixed(2)} Share)</span>
              </button>
            </div>

            {/* Direct Tipping / Session Support */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-slate-700" />
                <h3 className="text-sm font-semibold text-slate-900">Send Creator Tip ({activeWallet.chain})</h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[1, 5, 10].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    disabled={busy}
                    onClick={() => void handleTriggerRun(amt)}
                    className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs font-semibold tabular-nums text-slate-900 hover:bg-slate-100"
                  >
                    +${amt}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {feedback && (
          <div className="rounded-xl border border-slate-200 bg-slate-900 p-3 text-xs text-white" role="status">
            {feedback}
          </div>
        )}
      </div>

      {/* Android Gesture Nav Pill */}
      <div className="flex items-center justify-center bg-white py-2 border-t border-slate-100">
        <div className="h-1 w-24 rounded-full bg-slate-300" />
      </div>
    </div>
  );

  if (standalone) {
    return <div className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-50">{phoneBody}</div>;
  }

  return (
    <div className="mx-auto w-full max-w-[360px] rounded-[40px] border-[8px] border-slate-900 bg-slate-900 shadow-xl overflow-hidden">
      <div className="h-[640px] overflow-hidden rounded-[32px] bg-white">{phoneBody}</div>
    </div>
  );
};
