import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Plus, RotateCcw, Save, Trash2, Wand2 } from 'lucide-react';
import type { AppConfig, ChainId, DownloadModel, RevenueMode, WalletAddressConfig } from '../types/app';
import { CHAIN_META, validateWalletAddress } from '../utils/cryptoValidation';

interface CreatorSetupViewProps {
  config: AppConfig;
  saving: boolean;
  onSaveConfig: (nextConfig: AppConfig) => Promise<void>;
}

const ALL_CHAINS: ChainId[] = ['BTC', 'LN', 'ETH', 'SOL', 'USDT', 'LTC'];

export const CreatorSetupView: React.FC<CreatorSetupViewProps> = ({ config, saving, onSaveConfig }) => {
  const [draft, setDraft] = useState<AppConfig>(config);
  const [newChain, setNewChain] = useState<ChainId>('LN');
  const [savedNotice, setSavedNotice] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  // Keep draft synced if parent reloads fresh config externally
  React.useEffect(() => {
    setDraft(config);
  }, [config]);

  const splitTotal = useMemo(() => {
    return draft.wallets
      .filter((w) => w.enabled)
      .reduce((acc, w) => acc + (Number(w.splitPercent) || 0), 0);
  }, [draft.wallets]);

  const validEnabledWallets = useMemo(() => {
    return draft.wallets.filter((w) => w.enabled && validateWalletAddress(w.chain, w.address).valid);
  }, [draft.wallets]);

  const updateField = <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setSavedNotice('');
    setFormError('');
  };

  const updateWallet = (id: string, patch: Partial<WalletAddressConfig>) => {
    setDraft((prev) => ({
      ...prev,
      wallets: prev.wallets.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    }));
    setSavedNotice('');
    setFormError('');
  };

  const removeWallet = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      wallets: prev.wallets.filter((w) => w.id !== id),
    }));
    setSavedNotice('');
  };

  const addWallet = () => {
    const meta = CHAIN_META[newChain];
    const next: WalletAddressConfig = {
      id: `w-${newChain.toLowerCase()}-${Date.now()}`,
      chain: newChain,
      network: meta.defaultNetwork,
      label: `${newChain} Payout Wallet`,
      address: '',
      splitPercent: draft.wallets.filter((w) => w.enabled).length === 0 ? 100 : 10,
      enabled: true,
    };
    setDraft((prev) => ({ ...prev, wallets: [...prev.wallets, next] }));
    setSavedNotice('');
  };

  const autoBalanceSplits = () => {
    const enabled = draft.wallets.filter((w) => w.enabled);
    if (enabled.length === 0) return;
    const base = Math.floor(100 / enabled.length);
    const remainder = 100 - base * enabled.length;
    let seen = 0;
    setDraft((prev) => ({
      ...prev,
      wallets: prev.wallets.map((w) => {
        if (!w.enabled) return w;
        const extra = seen === 0 ? remainder : 0;
        seen += 1;
        return { ...w, splitPercent: base + extra };
      }),
    }));
    setSavedNotice('');
    setFormError('');
  };

  const fillDemoAddresses = () => {
    setDraft((prev) => ({
      ...prev,
      wallets: prev.wallets.map((w) => ({
        ...w,
        address: w.address.trim() ? w.address : CHAIN_META[w.chain].sampleAddress,
      })),
    }));
    setSavedNotice('');
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSavedNotice('');

    const enabled = draft.wallets.filter((w) => w.enabled);
    if (enabled.length === 0) {
      setFormError('Enable at least one crypto payout wallet to receive your creator share.');
      return;
    }

    for (const w of enabled) {
      const check = validateWalletAddress(w.chain, w.address);
      if (!check.valid) {
        setFormError(`${w.label || w.chain}: ${check.reason}`);
        return;
      }
    }

    if (Math.abs(splitTotal - 100) > 0.01) {
      setFormError(`Enabled wallet split percentages must total 100% (currently ${splitTotal}%). Click Auto-Balance to fix.`);
      return;
    }

    await onSaveConfig(draft);
    setSavedNotice('Creator addresses and Android revenue share rules saved.');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="border-b border-slate-200 pb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Creator Addresses &amp; Revenue Split
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
              Enter your Bitcoin and multi-chain addresses below. Every download, app launch, and supporter tip routes your configured share directly to these wallets.
            </p>
          </div>
          <button
            type="button"
            onClick={fillDemoAddresses}
            className="inline-flex min-h-[40px] items-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Wand2 className="h-3.5 w-3.5" />
            <span>Fill Sample Addresses</span>
          </button>
        </div>
      </div>

      {/* Section 1: Payout Addresses */}
      <section aria-labelledby="wallets-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="wallets-heading" className="text-lg font-semibold text-slate-900">
              01. Payout Wallet Addresses
            </h2>
            <p className="text-xs text-slate-500">
              {validEnabledWallets.length} verified active {validEnabledWallets.length === 1 ? 'wallet' : 'wallets'} · Total split allocation:{' '}
              <span className={`font-mono font-semibold tabular-nums ${splitTotal === 100 ? 'text-emerald-700' : 'text-amber-700'}`}>
                {splitTotal}%
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={autoBalanceSplits}
              className="inline-flex min-h-[38px] items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Auto-Balance 100%</span>
            </button>
            <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
              <select
                aria-label="Select cryptocurrency chain to add"
                value={newChain}
                onChange={(e) => setNewChain(e.target.value as ChainId)}
                className="min-h-[38px] bg-white px-2.5 text-xs font-medium text-slate-700 focus:outline-none"
              >
                {ALL_CHAINS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addWallet}
                className="inline-flex min-h-[38px] items-center gap-1 border-l border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-900 hover:bg-slate-100"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Wallet</span>
              </button>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {draft.wallets.map((wallet) => {
            const check = validateWalletAddress(wallet.chain, wallet.address);
            const meta = CHAIN_META[wallet.chain];
            return (
              <div key={wallet.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id={`enable-${wallet.id}`}
                      checked={wallet.enabled}
                      onChange={(e) => updateWallet(wallet.id, { enabled: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <label htmlFor={`enable-${wallet.id}`} className="text-sm font-semibold text-slate-900">
                      {meta.name}
                    </label>
                    <span className="text-xs text-slate-500">· {wallet.network}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <label htmlFor={`split-${wallet.id}`} className="text-xs font-medium text-slate-600">
                        Share %
                      </label>
                      <input
                        id={`split-${wallet.id}`}
                        type="number"
                        min={0}
                        max={100}
                        disabled={!wallet.enabled}
                        value={wallet.splitPercent}
                        onChange={(e) => updateWallet(wallet.id, { splitPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                        className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-right font-mono text-xs font-medium tabular-nums text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </div>
                    {draft.wallets.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeWallet(wallet.id)}
                        aria-label={`Remove ${wallet.chain} wallet`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <label htmlFor={`label-${wallet.id}`} className="block text-xs font-medium text-slate-600">
                      Wallet Label
                    </label>
                    <input
                      id={`label-${wallet.id}`}
                      type="text"
                      value={wallet.label}
                      onChange={(e) => updateWallet(wallet.id, { label: e.target.value })}
                      placeholder="Primary BTC Vault"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor={`addr-${wallet.id}`} className="block text-xs font-medium text-slate-600">
                      {wallet.chain} Receiving Address
                    </label>
                    <input
                      id={`addr-${wallet.id}`}
                      type="text"
                      value={wallet.address}
                      onChange={(e) => updateWallet(wallet.id, { address: e.target.value })}
                      placeholder={meta.placeholder}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none sm:text-sm"
                    />
                    {wallet.enabled && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                        {check.valid ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Valid {wallet.chain} address format</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                            <span className="text-amber-700">{check.reason}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 2: Android App Identity & Monetization Split */}
      <section aria-labelledby="app-rules-heading" className="space-y-4">
        <div>
          <h2 id="app-rules-heading" className="text-lg font-semibold text-slate-900">
            02. Android App Identity &amp; Share Rules
          </h2>
          <p className="text-xs text-slate-500">
            Configure your Android APK / PWA metadata and how your share is calculated on downloads and runs.
          </p>
        </div>

        <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <div>
            <label htmlFor="appName" className="block text-xs font-medium text-slate-600">
              Android App Name
            </label>
            <input
              id="appName"
              type="text"
              value={draft.appName}
              onChange={(e) => updateField('appName', e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="packageId" className="block text-xs font-medium text-slate-600">
                Android Package ID
              </label>
              <input
                id="packageId"
                type="text"
                value={draft.packageId}
                onChange={(e) => updateField('packageId', e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="version" className="block text-xs font-medium text-slate-600">
                Version
              </label>
              <input
                id="version"
                type="text"
                value={draft.version}
                onChange={(e) => updateField('version', e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="tagline" className="block text-xs font-medium text-slate-600">
              Short Tagline (shown on Android download screen)
            </label>
            <input
              id="tagline"
              type="text"
              value={draft.tagline}
              onChange={(e) => updateField('tagline', e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="downloadModel" className="block text-xs font-medium text-slate-600">
              Distribution Model
            </label>
            <select
              id="downloadModel"
              value={draft.downloadModel}
              onChange={(e) => updateField('downloadModel', e.target.value as DownloadModel)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
            >
              <option value="supporter_pwyw">Supporter Unlock (Recommended)</option>
              <option value="paid_unlock">Paid APK / App License</option>
              <option value="free_run_share">Free Download · Per-Run Share</option>
            </select>
          </div>

          <div>
            <label htmlFor="revenueMode" className="block text-xs font-medium text-slate-600">
              Share Trigger
            </label>
            <select
              id="revenueMode"
              value={draft.revenueMode}
              onChange={(e) => updateField('revenueMode', e.target.value as RevenueMode)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
            >
              <option value="hybrid">On Download + Every Active Run</option>
              <option value="download">On Download / Unlock Only</option>
              <option value="run">On Active App Run / Session Only</option>
            </select>
          </div>

          <div>
            <label htmlFor="downloadPriceUsd" className="block text-xs font-medium text-slate-600">
              Download Unlock Amount (USD eq.)
            </label>
            <input
              id="downloadPriceUsd"
              type="number"
              min={0}
              step={0.5}
              disabled={draft.downloadModel === 'free_run_share'}
              value={draft.downloadModel === 'free_run_share' ? 0 : draft.downloadPriceUsd}
              onChange={(e) => updateField('downloadPriceUsd', Math.max(0, Number(e.target.value) || 0))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums text-slate-900 disabled:bg-slate-100"
            />
          </div>

          <div>
            <label htmlFor="runShareUsd" className="block text-xs font-medium text-slate-600">
              Per-Run Session Share (USD eq.)
            </label>
            <input
              id="runShareUsd"
              type="number"
              min={0}
              step={0.05}
              value={draft.runShareUsd}
              onChange={(e) => updateField('runShareUsd', Math.max(0, Number(e.target.value) || 0))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums text-slate-900"
            />
          </div>

          <div className="sm:col-span-2 pt-1">
            <div className="flex items-center justify-between text-xs font-medium text-slate-700">
              <label htmlFor="creatorSharePercent">Your Creator Revenue Share</label>
              <span className="font-mono text-sm font-semibold tabular-nums text-amber-700">
                {draft.creatorSharePercent}% to your wallets
              </span>
            </div>
            <input
              id="creatorSharePercent"
              type="range"
              min={50}
              max={100}
              step={1}
              value={draft.creatorSharePercent}
              onChange={(e) => updateField('creatorSharePercent', Number(e.target.value))}
              className="mt-2 w-full accent-slate-900"
            />
            <div className="mt-1 flex justify-between text-[11px] text-slate-500">
              <span>50% Creator / 50% Ecosystem</span>
              <span>85% Creator / 15% Ops</span>
              <span>100% Direct to Creator</span>
            </div>
          </div>
        </div>
      </section>

      {formError && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <span>{formError}</span>
        </div>
      )}

      {savedNotice && (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800" role="status">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <span>{savedNotice}</span>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-5">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          <span>{saving ? 'Saving...' : 'Save Addresses & Publish Rules'}</span>
        </button>
      </div>
    </form>
  );
};
