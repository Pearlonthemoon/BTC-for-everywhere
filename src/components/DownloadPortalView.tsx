import React, { useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, FileArchive, QrCode, Smartphone } from 'lucide-react';
import type { AppConfig } from '../types/app';
import { generateAndroidProjectZip, getZipFileName } from '../utils/androidProjectGenerator';
import { validateWalletAddress } from '../utils/cryptoValidation';
import { QRCodeCard } from './QRCodeCard';
import { PWAInstallButton } from './PWAInstallButton';

interface DownloadPortalViewProps {
  config: AppConfig;
  onOpenStandaloneApp: () => void;
}

export const DownloadPortalView: React.FC<DownloadPortalViewProps> = ({ config, onOpenStandaloneApp }) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [buildingZip, setBuildingZip] = useState(false);
  const [zipStatus, setZipStatus] = useState('');

  const appLiveUrl = useMemo(() => {
    if (typeof window === 'undefined') return 'https://example.com/?mode=app';
    return `${window.location.origin}/?mode=app`;
  }, []);

  const activeWallets = useMemo(
    () => config.wallets.filter((w) => w.enabled && validateWalletAddress(w.chain, w.address).valid),
    [config.wallets]
  );

  const manifestPreview = useMemo(() => {
    return JSON.stringify(
      {
        appName: config.appName,
        packageId: config.packageId,
        version: config.version,
        downloadModel: config.downloadModel,
        downloadPriceUsd: config.downloadPriceUsd,
        runShareUsd: config.runShareUsd,
        creatorSharePercent: config.creatorSharePercent,
        runtimeUrl: appLiveUrl,
        wallets: activeWallets.map((w) => ({
          chain: w.chain,
          address: w.address.trim(),
          splitPercent: w.splitPercent,
        })),
      },
      null,
      2
    );
  }, [config, appLiveUrl, activeWallets]);

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(appLiveUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 1800);
  };

  const handleDownloadAndroidZip = async () => {
    setBuildingZip(true);
    setZipStatus('');
    try {
      const blob = await generateAndroidProjectZip(config, appLiveUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = getZipFileName(config.appName);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setZipStatus(`Downloaded ${getZipFileName(config.appName)} with ${activeWallets.length} payout wallet(s) embedded.`);
    } finally {
      setBuildingZip(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Android Download &amp; APK Packaging
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
          Share the instant Android WebAPK link so users can install and run your app on any Android phone, or export the Kotlin Android Studio source bundle to compile a signed APK.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Card 1: Direct Android PWA Distribution */}
        <section className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6">
          <div>
            <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-900">
              <QrCode className="h-4 w-4 text-amber-600" />
              <h2>Instant Android App Link (PWA / WebAPK)</h2>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              Anyone scanning this QR code on Android opens {config.appName} directly in app mode and can install it to their home screen without a store review delay.
            </p>

            <div className="mt-5 flex flex-col items-center rounded-xl border border-slate-100 bg-slate-50 p-5">
              <QRCodeCard value={appLiveUrl} size={172} alt={`QR code to download ${config.appName} on Android`} />
              <p className="mt-3 text-xs text-slate-500">
                {config.appName} v{config.version} · {config.creatorSharePercent}% creator split
              </p>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-700">{appLiveUrl}</span>
              <button
                type="button"
                onClick={() => void handleCopyUrl()}
                className="inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 hover:bg-slate-100"
              >
                {copiedUrl ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedUrl ? 'Copied' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            <PWAInstallButton />
            <button
              type="button"
              onClick={onOpenStandaloneApp}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Open User App View</span>
            </button>
          </div>
        </section>

        {/* Card 2: Native Android Studio Kotlin Bundle */}
        <section className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6">
          <div>
            <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-900">
              <Smartphone className="h-4 w-4 text-slate-900" />
              <h2>Android Studio Kotlin Project (.zip)</h2>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              Download a ready-to-compile Gradle &amp; Kotlin Android project with native <code className="font-mono text-slate-800">bitcoin:</code> / <code className="font-mono text-slate-800">ethereum:</code> / <code className="font-mono text-slate-800">solana:</code> wallet intent handling and your payout addresses baked into <code className="font-mono text-slate-800">assets/creator-payout-config.json</code>.
            </p>

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                <span>Embedded Payout Manifest</span>
                <span className="font-mono">{activeWallets.length} active wallets</span>
              </div>
              <pre className="mt-1.5 max-h-56 overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-3.5 font-mono text-[11px] leading-relaxed text-slate-200">
                {manifestPreview}
              </pre>
            </div>
          </div>

          <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              disabled={buildingZip}
              onClick={() => void handleDownloadAndroidZip()}
              className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
            >
              <FileArchive className="h-4 w-4" />
              <span>{buildingZip ? 'Packaging Android Project...' : 'Download Android Studio ZIP'}</span>
            </button>
            {zipStatus && (
              <p className="text-xs text-emerald-700" role="status">
                {zipStatus}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
