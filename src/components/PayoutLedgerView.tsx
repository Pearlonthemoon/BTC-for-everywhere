import React, { useMemo, useState } from 'react';
import { ArrowUpRight, CheckCircle2, Clock, Download, FileSpreadsheet, Play, Search, Trash2 } from 'lucide-react';
import type { AppConfig, AppStats, ChainId, LedgerEvent } from '../types/app';
import { shortenAddress } from '../utils/cryptoValidation';

interface PayoutLedgerViewProps {
  config: AppConfig;
  events: LedgerEvent[];
  stats: AppStats;
  onSettlePending: () => Promise<void>;
  onClearLedger: () => Promise<void>;
  onGoToPreview: () => void;
}

type FilterType = 'all' | 'download' | 'run' | 'tip' | 'payout';

export const PayoutLedgerView: React.FC<PayoutLedgerViewProps> = ({
  config,
  events,
  stats,
  onSettlePending,
  onClearLedger,
  onGoToPreview,
}) => {
  const [filter, setFilter] = useState<FilterType>('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (filter !== 'all' && e.type !== filter) return false;
      if (!q) return true;
      return (
        e.chain.toLowerCase().includes(q) ||
        e.recipientAddress.toLowerCase().includes(q) ||
        e.txRef.toLowerCase().includes(q) ||
        e.deviceInfo.toLowerCase().includes(q)
      );
    });
  }, [events, filter, query]);

  const activeChains = useMemo(() => {
    const set = new Set<ChainId>();
    for (const w of config.wallets) {
      if (w.enabled && w.address.trim()) set.add(w.chain);
    }
    for (const e of events) {
      set.add(e.chain);
    }
    return Array.from(set);
  }, [config.wallets, events]);

  const handleSettle = async () => {
    setBusy(true);
    try {
      await onSettlePending();
    } finally {
      setBusy(false);
    }
  };

  const handleExportCsv = () => {
    const headers = ['ID', 'Type', 'Chain', 'RecipientAddress', 'GrossUSD', 'CreatorShareUSD', 'CryptoAmount', 'TxRef', 'Status', 'Timestamp'];
    const rows = events.map((e) => [
      e.id,
      e.type,
      e.chain,
      e.recipientAddress,
      e.grossUsd.toFixed(2),
      e.creatorShareUsd.toFixed(2),
      e.cryptoAmount,
      e.txRef,
      e.status,
      e.createdAt,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sharedroid-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Creator Share &amp; Payout Ledger
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
            Real-time accounting of Android app downloads, active utility runs, and creator payouts routed to your configured wallet addresses.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy || stats.pendingShareUsd <= 0}
            onClick={() => void handleSettle()}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-40"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            <span>Settle Pending (${stats.pendingShareUsd.toFixed(2)})</span>
          </button>
          <button
            type="button"
            disabled={events.length === 0}
            onClick={handleExportCsv}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-40"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
          {events.length > 0 && (
            <button
              type="button"
              onClick={() => void onClearLedger()}
              aria-label="Clear ledger events"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">Total Downloads</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-slate-900">
            {stats.totalDownloads}
          </div>
          <div className="mt-1 text-xs text-slate-500">Verified APK / PWA unlocks</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">Active App Runs</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-slate-900">
            {stats.totalRuns}
          </div>
          <div className="mt-1 text-xs text-slate-500">${config.runShareUsd.toFixed(2)} base per session</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">Creator Share Earned</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-amber-700">
            ${stats.totalCreatorShareUsd.toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {config.creatorSharePercent}% of ${stats.totalGrossUsd.toFixed(2)} gross
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">Pending / Settled</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-slate-900">
            ${stats.pendingShareUsd.toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-emerald-700">
            ${stats.settledShareUsd.toFixed(2)} settled
          </div>
        </div>
      </div>

      {/* Per-Chain Breakdown */}
      {activeChains.length > 0 && (
        <section aria-labelledby="chain-breakdown-heading" className="space-y-3">
          <h2 id="chain-breakdown-heading" className="text-sm font-semibold text-slate-900">
            Accrued Share by Configured Network
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {activeChains.map((chain) => {
              const bucket = stats.byChain[chain] ?? { shareUsd: 0, cryptoTotal: 0, count: 0 };
              const wallet = config.wallets.find((w) => w.chain === chain && w.address.trim());
              return (
                <div key={chain} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900">{chain}</span>
                    <span className="font-mono tabular-nums text-slate-500">{bucket.count} events</span>
                  </div>
                  <div className="mt-2 font-mono text-lg font-semibold tabular-nums text-slate-900">
                    {bucket.cryptoTotal.toFixed(chain === 'USDT' ? 2 : chain === 'BTC' || chain === 'LN' ? 8 : 5)} {chain}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                    <span className="font-mono tabular-nums">${bucket.shareUsd.toFixed(2)} USD eq.</span>
                    {wallet && <span className="font-mono">{shortenAddress(wallet.address)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Filter & Event Table */}
      <section aria-labelledby="ledger-table-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(['all', 'download', 'run', 'tip', 'payout'] as FilterType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFilter(t)}
                className={`min-h-[34px] rounded-md px-3 text-xs font-medium capitalize transition-colors ${
                  filter === t ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t === 'all' ? 'All Events' : `${t}s`}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search address, chain, or TX..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pr-3 pl-9 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
            />
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
            <Play className="mx-auto h-8 w-8 text-slate-400" />
            <h3 className="mt-3 text-base font-semibold text-slate-900">No download or run events yet</h3>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-600">
              Once users download your Android app or run an active session, every creator share event and wallet payout appears here.
            </p>
            <button
              type="button"
              onClick={onGoToPreview}
              className="mt-5 inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Test Download &amp; Run in Android Preview</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="px-4 py-3 font-medium">Event</th>
                  <th className="px-4 py-3 font-medium">Network &amp; Recipient</th>
                  <th className="px-4 py-3 font-medium text-right">Creator Share</th>
                  <th className="px-4 py-3 font-medium text-right">Crypto Amount</th>
                  <th className="px-4 py-3 font-medium">Reference</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-medium capitalize text-slate-900">{evt.type}</span>
                      <div className="text-[11px] text-slate-500">
                        {new Date(evt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {evt.deviceInfo}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-semibold text-slate-900">{evt.chain}</span>
                      <div className="font-mono text-[11px] text-slate-500" title={evt.recipientAddress}>
                        {shortenAddress(evt.recipientAddress)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-slate-900 whitespace-nowrap">
                      ${evt.creatorShareUsd.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {evt.cryptoAmount} {evt.chain}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {evt.txRef}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                        {evt.status === 'confirmed' ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Confirmed</span>
                          </>
                        ) : (
                          <>
                            <Clock className="h-3.5 w-3.5 text-amber-600" />
                            <span className="text-amber-700">Pending</span>
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
