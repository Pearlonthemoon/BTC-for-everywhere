import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BarChart3, Download, Megaphone, Settings2, Smartphone } from 'lucide-react';
import type { AppConfig, ChainId, DailyCampaign, StoreState } from './types/app';
import { CreatorSetupView } from './components/CreatorSetupView';
import { AndroidAppRuntime } from './components/AndroidAppRuntime';
import { DownloadPortalView } from './components/DownloadPortalView';
import { GrowthCampaignView } from './components/GrowthCampaignView';
import { PayoutLedgerView } from './components/PayoutLedgerView';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';

type WorkspaceTab = 'setup' | 'preview' | 'download' | 'growth' | 'ledger';

export default function App() {
  const [state, setState] = useState<StoreState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('setup');
  const [utmSource] = useState<string>(() => {
    if (typeof window === 'undefined') return 'direct';
    const params = new URLSearchParams(window.location.search);
    return params.get('utm_source') || 'direct';
  });
  const [standaloneAppMode, setStandaloneAppMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'app';
  });

  const loadState = useCallback(async () => {
    try {
      setError('');
      const res = await fetch('/api/state');
      if (!res.ok) throw new Error('Failed to load ShareDroid configuration.');
      const data = (await res.json()) as StoreState;
      setState(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach backend API.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  // Track real UTM referral visit once per session
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = `sd_visit_${utmSource}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    fetch('/api/events/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ utmSource }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: StoreState | null) => {
        if (data) setState(data);
      })
      .catch(() => {
        // Non-blocking telemetry
      });
  }, [utmSource]);

  const handleSaveConfig = async (nextConfig: AppConfig) => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextConfig),
      });
      const data = (await res.json()) as StoreState & { error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to save configuration.');
      setState(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration.');
    } finally {
      setSaving(false);
    }
  };

  const handleRecordDownload = async (payload: { chain: ChainId; customUsd: number; txRef?: string }) => {
    setError('');
    const res = await fetch('/api/events/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, utmSource }),
    });
    const data = (await res.json()) as { state?: StoreState; error?: string };
    if (!res.ok || !data.state) {
      setError(data.error || 'Unable to record download event.');
      return;
    }
    setState(data.state);
  };

  const handleRecordRun = async (payload: { chain: ChainId; amountUsd: number; txRef?: string; isTip?: boolean }) => {
    setError('');
    const res = await fetch('/api/events/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, utmSource }),
    });
    const data = (await res.json()) as { state?: StoreState; error?: string };
    if (!res.ok || !data.state) {
      setError(data.error || 'Unable to record run event.');
      return;
    }
    setState(data.state);
  };

  const handleSaveCampaign = async (campaign: Partial<DailyCampaign>) => {
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campaign),
    });
    if (res.ok) {
      const data = (await res.json()) as StoreState;
      setState(data);
    }
  };

  const handleLogCampaignPost = async (campaignId: string) => {
    const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/log-post`, {
      method: 'POST',
    });
    if (res.ok) {
      const data = (await res.json()) as StoreState;
      setState(data);
    }
  };

  const handleTogglePlatform = async (platformId: string, checked: boolean) => {
    const res = await fetch('/api/platforms/checklist', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [platformId]: checked }),
    });
    if (res.ok) {
      const data = (await res.json()) as StoreState;
      setState(data);
    }
  };

  const handleSettlePending = async () => {
    const res = await fetch('/api/payouts/settle', { method: 'POST' });
    if (res.ok) {
      const data = (await res.json()) as StoreState;
      setState(data);
    }
  };

  const handleClearLedger = async () => {
    const res = await fetch('/api/events', { method: 'DELETE' });
    if (res.ok) {
      const data = (await res.json()) as StoreState;
      setState(data);
    }
  };

  if (loading || !state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md space-y-3 rounded-xl border border-slate-200 bg-white p-6">
          <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
    );
  }

  if (standaloneAppMode) {
    return (
      <div className="min-h-screen bg-slate-100">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-2.5">
          <button
            type="button"
            onClick={() => {
              setStandaloneAppMode(false);
              if (window.location.search.includes('mode=app')) {
                window.history.replaceState({}, '', '/');
              }
            }}
            className="inline-flex min-h-[38px] items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Creator Console</span>
          </button>
          <span className="text-xs text-slate-500">Android User View</span>
        </div>
        <AndroidAppRuntime
          config={state.config}
          standalone
          onRecordDownload={handleRecordDownload}
          onRecordRun={handleRecordRun}
          onNavigateSetup={() => {
            setStandaloneAppMode(false);
            setActiveTab('setup');
          }}
        />
        <OfflineIndicator />
      </div>
    );
  }

  const navItems: Array<{ id: WorkspaceTab; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'setup', label: 'Creator Setup', shortLabel: 'Setup', icon: Settings2 },
    { id: 'preview', label: 'Android Preview', shortLabel: 'Preview', icon: Smartphone },
    { id: 'download', label: 'Download Portal', shortLabel: 'Download', icon: Download },
    { id: 'growth', label: 'Growth & Ads', shortLabel: 'Promote', icon: Megaphone },
    { id: 'ledger', label: 'Payout Ledger', shortLabel: 'Ledger', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-20 text-slate-900 md:pb-12">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('setup')}
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            ShareDroid
          </button>

          {/* Zone 2: 5 single-line nav links */}
          <nav aria-label="Primary" className="hidden md:flex items-center gap-6">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`relative py-1 text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'text-slate-900 after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:bg-slate-900'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <PWAInstallButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        )}

        {activeTab === 'setup' && (
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
            <CreatorSetupView config={state.config} saving={saving} onSaveConfig={handleSaveConfig} />
            <aside className="hidden lg:block lg:sticky lg:top-24">
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-slate-700">Live Android App Preview</span>
                <button
                  type="button"
                  onClick={() => setStandaloneAppMode(true)}
                  className="text-xs font-medium text-amber-700 hover:underline"
                >
                  Open Full Mobile View
                </button>
              </div>
              <AndroidAppRuntime
                config={state.config}
                onRecordDownload={handleRecordDownload}
                onRecordRun={handleRecordRun}
              />
            </aside>
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-5">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                  Interactive Android App Runtime
                </h1>
                <p className="mt-1.5 max-w-xl text-sm text-slate-600">
                  Test the exact download, unlock, and session-run flow your Android users experience. Actions inside the phone frame write real share entries to your Payout Ledger.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="text-xs font-medium text-slate-500">Download Share Trigger</div>
                  <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900">
                    ${((state.config.downloadModel === 'free_run_share' ? 0 : state.config.downloadPriceUsd) * state.config.creatorSharePercent / 100).toFixed(2)}
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Credited when a user downloads and unlocks {state.config.appName}.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="text-xs font-medium text-slate-500">Per-Run Session Share</div>
                  <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-amber-700">
                    ${((state.config.runShareUsd * state.config.creatorSharePercent) / 100).toFixed(2)}
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Credited each time a user runs the built-in utility session or tips.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setStandaloneAppMode(true)}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  <Smartphone className="h-4 w-4" />
                  <span>Launch Fullscreen Android App</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('growth')}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50"
                >
                  <Megaphone className="h-4 w-4" />
                  <span>Promote &amp; Daily Campaigns</span>
                </button>
              </div>
            </div>

            <AndroidAppRuntime
              config={state.config}
              onRecordDownload={handleRecordDownload}
              onRecordRun={handleRecordRun}
              onNavigateSetup={() => setActiveTab('setup')}
            />
          </div>
        )}

        {activeTab === 'download' && (
          <DownloadPortalView
            config={state.config}
            onOpenStandaloneApp={() => setStandaloneAppMode(true)}
          />
        )}

        {activeTab === 'growth' && (
          <GrowthCampaignView
            config={state.config}
            campaigns={state.campaigns}
            channelMetrics={state.channelMetrics}
            platformChecklist={state.platformChecklist}
            onSaveCampaign={handleSaveCampaign}
            onLogCampaignPost={handleLogCampaignPost}
            onTogglePlatform={handleTogglePlatform}
            onGoToDownload={() => setActiveTab('download')}
          />
        )}

        {activeTab === 'ledger' && (
          <PayoutLedgerView
            config={state.config}
            events={state.events}
            stats={state.stats}
            onSettlePending={handleSettlePending}
            onClearLedger={handleClearLedger}
            onGoToPreview={() => setActiveTab('preview')}
          />
        )}
      </main>

      {/* Mobile Bottom Thumb Navigation (<= 15% mobile sticky height) */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed right-0 bottom-0 left-0 z-40 grid h-16 grid-cols-5 border-t border-slate-200 bg-white/95 backdrop-blur-md md:hidden"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                active ? 'text-slate-900' : 'text-slate-500'
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? 'text-amber-600' : 'text-slate-400'}`} />
              <span>{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      <OfflineIndicator />
    </div>
  );
}
