import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  AppConfig,
  AppStats,
  ChainAggregate,
  ChainId,
  ChannelMetric,
  DailyCampaign,
  LedgerEvent,
  StoreState,
  WalletAddressConfig,
} from './src/types/app.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '.data');
const STORE_PATH = path.join(DATA_DIR, 'sharedroid-store.json');

const REFERENCE_USD_PRICES: Record<ChainId, number> = {
  BTC: 92400,
  LN: 92400,
  ETH: 3180,
  SOL: 215,
  USDT: 1,
  LTC: 98,
};

const DEFAULT_CONFIG: AppConfig = {
  appName: 'PulseUtility',
  packageId: 'com.sharedroid.pulseutility',
  version: '1.0.0',
  tagline: 'Offline-ready Android toolkit with direct creator payout split',
  description:
    'A lightweight Android utility app where users unlock or run sessions with transparent crypto revenue sharing directly to the creator.',
  downloadModel: 'supporter_pwyw',
  downloadPriceUsd: 4.99,
  runShareUsd: 0.25,
  creatorSharePercent: 85,
  revenueMode: 'hybrid',
  wallets: [
    {
      id: 'w-btc-primary',
      chain: 'BTC',
      network: 'Bitcoin Mainnet (SegWit)',
      label: 'Primary BTC Vault',
      address: '',
      splitPercent: 60,
      enabled: true,
    },
    {
      id: 'w-eth-primary',
      chain: 'ETH',
      network: 'Ethereum / Base ERC-20',
      label: 'ETH Creator Wallet',
      address: '',
      splitPercent: 25,
      enabled: true,
    },
    {
      id: 'w-sol-primary',
      chain: 'SOL',
      network: 'Solana Mainnet',
      label: 'SOL Fast Payout',
      address: '',
      splitPercent: 15,
      enabled: true,
    },
  ],
  updatedAt: new Date().toISOString(),
};

const DEFAULT_CAMPAIGNS: DailyCampaign[] = [
  {
    id: 'cmp-x-daily',
    title: 'Daily X / Twitter Launch Post',
    channel: 'x',
    headline: 'Install PulseUtility on Android',
    body: 'Download PulseUtility on Android directly in one tap. Fast offline crypto & sats utility with transparent creator support.',
    cadence: 'daily',
    active: true,
    postsCount: 0,
    lastPostedAt: null,
  },
  {
    id: 'cmp-tg-daily',
    title: 'Telegram Community Broadcast',
    channel: 'telegram',
    headline: 'PulseUtility Android Release',
    body: 'Try our lightweight Android utility app — scan or tap to install directly on Android without waiting for store delays.',
    cadence: 'daily',
    active: true,
    postsCount: 0,
    lastPostedAt: null,
  },
  {
    id: 'cmp-wa-daily',
    title: 'WhatsApp Status & Group Share',
    channel: 'whatsapp',
    headline: 'Get PulseUtility for Android',
    body: 'Install PulseUtility on your Android phone in seconds. Includes live multi-chain converter and offline support.',
    cadence: 'daily',
    active: true,
    postsCount: 0,
    lastPostedAt: null,
  },
  {
    id: 'cmp-rd-weekly',
    title: 'Reddit Android & Crypto Showcase',
    channel: 'reddit',
    headline: 'Built an installable Android app with transparent BTC/ETH/SOL creator payouts',
    body: 'Check out our Android PWA & Kotlin app — open the download link on Android to install or inspect the open payout split.',
    cadence: 'daily',
    active: true,
    postsCount: 0,
    lastPostedAt: null,
  },
];

interface PersistedData {
  config: AppConfig;
  events: LedgerEvent[];
  campaigns: DailyCampaign[];
  visitsByChannel: Record<string, number>;
  platformChecklist: Record<string, boolean>;
}

function ensureStore(): PersistedData {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_PATH)) {
    const initial: PersistedData = {
      config: DEFAULT_CONFIG,
      events: [],
      campaigns: DEFAULT_CAMPAIGNS,
      visitsByChannel: {},
      platformChecklist: {},
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<PersistedData>;
    return {
      config: parsed.config ?? DEFAULT_CONFIG,
      events: Array.isArray(parsed.events) ? parsed.events : [],
      campaigns: Array.isArray(parsed.campaigns) && parsed.campaigns.length > 0 ? parsed.campaigns : DEFAULT_CAMPAIGNS,
      visitsByChannel: parsed.visitsByChannel && typeof parsed.visitsByChannel === 'object' ? parsed.visitsByChannel : {},
      platformChecklist: parsed.platformChecklist && typeof parsed.platformChecklist === 'object' ? parsed.platformChecklist : {},
    };
  } catch {
    return {
      config: DEFAULT_CONFIG,
      events: [],
      campaigns: DEFAULT_CAMPAIGNS,
      visitsByChannel: {},
      platformChecklist: {},
    };
  }
}

function saveStore(data: PersistedData): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

function computeStats(events: LedgerEvent[]): AppStats {
  const chains: ChainId[] = ['BTC', 'LN', 'ETH', 'SOL', 'USDT', 'LTC'];
  const byChain = {} as Record<ChainId, ChainAggregate>;
  for (const chain of chains) {
    byChain[chain] = { shareUsd: 0, cryptoTotal: 0, count: 0 };
  }

  let totalDownloads = 0;
  let totalRuns = 0;
  let totalGrossUsd = 0;
  let totalCreatorShareUsd = 0;
  let pendingShareUsd = 0;
  let settledShareUsd = 0;

  for (const evt of events) {
    if (evt.type === 'download') totalDownloads += 1;
    else if (evt.type === 'run') totalRuns += 1;

    if (evt.type !== 'payout') {
      totalGrossUsd += evt.grossUsd;
      totalCreatorShareUsd += evt.creatorShareUsd;
      if (evt.status === 'pending') pendingShareUsd += evt.creatorShareUsd;
      else settledShareUsd += evt.creatorShareUsd;

      const bucket = byChain[evt.chain];
      if (bucket) {
        bucket.shareUsd += evt.creatorShareUsd;
        bucket.cryptoTotal += Number.parseFloat(evt.cryptoAmount) || 0;
        bucket.count += 1;
      }
    }
  }

  return {
    totalDownloads,
    totalRuns,
    totalGrossUsd: Number(totalGrossUsd.toFixed(2)),
    totalCreatorShareUsd: Number(totalCreatorShareUsd.toFixed(2)),
    pendingShareUsd: Number(pendingShareUsd.toFixed(2)),
    settledShareUsd: Number(settledShareUsd.toFixed(2)),
    byChain,
  };
}

function computeChannelMetrics(events: LedgerEvent[], visitsByChannel: Record<string, number>): ChannelMetric[] {
  const map = new Map<string, ChannelMetric>();
  const ensureChannel = (ch: string): ChannelMetric => {
    const key = ch.toLowerCase().trim() || 'direct';
    const existing = map.get(key);
    if (existing) return existing;
    const created: ChannelMetric = {
      channel: key,
      visits: visitsByChannel[key] || 0,
      downloads: 0,
      runs: 0,
      creatorShareUsd: 0,
    };
    map.set(key, created);
    return created;
  };

  for (const ch of Object.keys(visitsByChannel)) {
    ensureChannel(ch);
  }

  for (const evt of events) {
    if (evt.type === 'payout') continue;
    const m = ensureChannel(evt.utmSource || 'direct');
    if (evt.type === 'download') m.downloads += 1;
    if (evt.type === 'run') m.runs += 1;
    m.creatorShareUsd = Number((m.creatorShareUsd + evt.creatorShareUsd).toFixed(2));
  }

  return Array.from(map.values()).sort((a, b) => b.downloads + b.visits - (a.downloads + a.visits));
}

function formatCryptoAmount(usd: number, chain: ChainId): string {
  const rate = REFERENCE_USD_PRICES[chain] || 1;
  const amount = usd / rate;
  if (chain === 'BTC' || chain === 'LN') return amount.toFixed(8);
  if (chain === 'ETH') return amount.toFixed(6);
  if (chain === 'SOL' || chain === 'LTC') return amount.toFixed(4);
  return amount.toFixed(2);
}

function pickRecipientWallet(wallets: WalletAddressConfig[], preferredChain?: ChainId): WalletAddressConfig | null {
  const active = wallets.filter((w) => w.enabled && w.address.trim().length > 0);
  if (active.length === 0) return null;
  if (preferredChain) {
    const match = active.find((w) => w.chain === preferredChain);
    if (match) return match;
  }
  return active[0];
}

function buildStateResponse(data: PersistedData): StoreState {
  return {
    config: data.config,
    events: data.events,
    stats: computeStats(data.events),
    campaigns: data.campaigns,
    channelMetrics: computeChannelMetrics(data.events, data.visitsByChannel),
    platformChecklist: data.platformChecklist,
  };
}

function getBaseUrl(req: express.Request): string {
  if (process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL') {
    return process.env.APP_URL.replace(/\/$/, '');
  }
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Search Engine & Automation Feeds
  app.get('/robots.txt', (req, res) => {
    const base = getBaseUrl(req);
    res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
  });

  app.get('/sitemap.xml', (req, res) => {
    const base = getBaseUrl(req);
    const now = new Date().toISOString();
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${escapeXml(base)}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${escapeXml(base)}/?mode=app</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>`);
  });

  app.get('/feed.xml', (req, res) => {
    const base = getBaseUrl(req);
    const data = ensureStore();
    const activeCampaigns = data.campaigns.filter((c) => c.active);
    const today = new Date().toUTCString();
    const dateKey = new Date().toISOString().slice(0, 10);

    const itemsXml = activeCampaigns
      .map((c) => {
        const utmLink = `${base}/?mode=app&utm_source=${encodeURIComponent(c.channel)}&utm_campaign=daily_${dateKey}`;
        return `    <item>
      <title>${escapeXml(`${data.config.appName}: ${c.headline}`)}</title>
      <link>${escapeXml(utmLink)}</link>
      <guid isPermaLink="false">${escapeXml(`${c.id}-${dateKey}`)}</guid>
      <pubDate>${today}</pubDate>
      <description>${escapeXml(`${c.body} Download Android app: ${utmLink}`)}</description>
    </item>`;
      })
      .join('\n');

    res.type('application/rss+xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(data.config.appName)} — Daily Android Release &amp; Promotion Feed</title>
    <link>${escapeXml(base)}/?mode=app</link>
    <description>${escapeXml(data.config.description)}</description>
    <lastBuildDate>${today}</lastBuildDate>
${itemsXml}
  </channel>
</rss>`);
  });

  app.get('/api/campaigns/feed.json', (req, res) => {
    const base = getBaseUrl(req);
    const data = ensureStore();
    const dateKey = new Date().toISOString().slice(0, 10);
    res.json({
      appName: data.config.appName,
      version: data.config.version,
      appUrl: `${base}/?mode=app`,
      date: dateKey,
      items: data.campaigns
        .filter((c) => c.active)
        .map((c) => ({
          id: `${c.id}-${dateKey}`,
          channel: c.channel,
          cadence: c.cadence,
          headline: c.headline,
          body: c.body,
          shareUrl: `${base}/?mode=app&utm_source=${encodeURIComponent(c.channel)}&utm_campaign=daily_${dateKey}`,
        })),
    });
  });

  app.get('/api/state', (_req, res) => {
    const data = ensureStore();
    res.json(buildStateResponse(data));
  });

  app.put('/api/config', (req, res) => {
    const data = ensureStore();
    const incoming = req.body as Partial<AppConfig>;
    const updated: AppConfig = {
      ...data.config,
      ...incoming,
      appName: String(incoming.appName ?? data.config.appName).trim().slice(0, 60) || 'ShareDroid App',
      packageId: String(incoming.packageId ?? data.config.packageId).trim().slice(0, 80) || 'com.sharedroid.app',
      version: String(incoming.version ?? data.config.version).trim().slice(0, 20) || '1.0.0',
      tagline: String(incoming.tagline ?? data.config.tagline).trim().slice(0, 140),
      description: String(incoming.description ?? data.config.description).trim().slice(0, 500),
      downloadPriceUsd: Math.max(0, Number(incoming.downloadPriceUsd ?? data.config.downloadPriceUsd) || 0),
      runShareUsd: Math.max(0, Number(incoming.runShareUsd ?? data.config.runShareUsd) || 0),
      creatorSharePercent: Math.min(100, Math.max(10, Number(incoming.creatorSharePercent ?? data.config.creatorSharePercent) || 85)),
      wallets: Array.isArray(incoming.wallets) ? incoming.wallets : data.config.wallets,
      updatedAt: new Date().toISOString(),
    };
    data.config = updated;
    saveStore(data);
    res.json(buildStateResponse(data));
  });

  app.post('/api/events/visit', (req, res) => {
    const data = ensureStore();
    const body = req.body as { utmSource?: string };
    const channel = String(body.utmSource || 'direct')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 32) || 'direct';
    data.visitsByChannel[channel] = (data.visitsByChannel[channel] || 0) + 1;
    saveStore(data);
    res.json(buildStateResponse(data));
  });

  app.post('/api/events/download', (req, res) => {
    const data = ensureStore();
    const body = req.body as { chain?: ChainId; customUsd?: number; txRef?: string; deviceInfo?: string; utmSource?: string };
    const wallet = pickRecipientWallet(data.config.wallets, body.chain);
    if (!wallet) {
      res.status(400).json({ error: 'Please enter and enable at least one BTC or crypto payout address in Creator Setup first.' });
      return;
    }

    const grossUsd =
      typeof body.customUsd === 'number' && body.customUsd >= 0
        ? body.customUsd
        : data.config.downloadModel === 'free_run_share'
          ? 0
          : data.config.downloadPriceUsd;
    const creatorShareUsd = Number(((grossUsd * data.config.creatorSharePercent) / 100).toFixed(4));
    const event: LedgerEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'download',
      chain: wallet.chain,
      recipientAddress: wallet.address.trim(),
      grossUsd: Number(grossUsd.toFixed(2)),
      creatorShareUsd: Number(creatorShareUsd.toFixed(2)),
      cryptoAmount: formatCryptoAmount(creatorShareUsd, wallet.chain),
      txRef: (body.txRef && body.txRef.trim()) || `apk_${Math.random().toString(36).slice(2, 10)}`,
      deviceInfo: (body.deviceInfo && body.deviceInfo.trim()) || 'Android 15 · Pixel / ARM64',
      utmSource: body.utmSource ? String(body.utmSource).slice(0, 32) : 'direct',
      status: body.txRef ? 'confirmed' : 'pending',
      createdAt: new Date().toISOString(),
    };

    data.events = [event, ...data.events].slice(0, 250);
    saveStore(data);
    res.json({ event, state: buildStateResponse(data) });
  });

  app.post('/api/events/run', (req, res) => {
    const data = ensureStore();
    const body = req.body as { chain?: ChainId; amountUsd?: number; txRef?: string; deviceInfo?: string; isTip?: boolean; utmSource?: string };
    const wallet = pickRecipientWallet(data.config.wallets, body.chain);
    if (!wallet) {
      res.status(400).json({ error: 'Please enter and enable at least one BTC or crypto payout address in Creator Setup first.' });
      return;
    }

    const grossUsd = typeof body.amountUsd === 'number' && body.amountUsd > 0 ? body.amountUsd : data.config.runShareUsd;
    const creatorShareUsd = Number(((grossUsd * data.config.creatorSharePercent) / 100).toFixed(4));
    const event: LedgerEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: body.isTip ? 'tip' : 'run',
      chain: wallet.chain,
      recipientAddress: wallet.address.trim(),
      grossUsd: Number(grossUsd.toFixed(2)),
      creatorShareUsd: Number(creatorShareUsd.toFixed(2)),
      cryptoAmount: formatCryptoAmount(creatorShareUsd, wallet.chain),
      txRef: (body.txRef && body.txRef.trim()) || `run_${Math.random().toString(36).slice(2, 10)}`,
      deviceInfo: (body.deviceInfo && body.deviceInfo.trim()) || 'Android Runtime · Standalone',
      utmSource: body.utmSource ? String(body.utmSource).slice(0, 32) : 'direct',
      status: body.txRef ? 'confirmed' : 'pending',
      createdAt: new Date().toISOString(),
    };

    data.events = [event, ...data.events].slice(0, 250);
    saveStore(data);
    res.json({ event, state: buildStateResponse(data) });
  });

  app.post('/api/campaigns', (req, res) => {
    const data = ensureStore();
    const incoming = req.body as Partial<DailyCampaign>;
    if (!incoming.id) {
      const created: DailyCampaign = {
        id: `cmp-${Date.now()}`,
        title: String(incoming.title || 'New Daily Campaign').slice(0, 80),
        channel: incoming.channel || 'x',
        headline: String(incoming.headline || `${data.config.appName} for Android`).slice(0, 120),
        body: String(incoming.body || data.config.tagline).slice(0, 400),
        cadence: incoming.cadence || 'daily',
        active: incoming.active ?? true,
        postsCount: 0,
        lastPostedAt: null,
      };
      data.campaigns = [created, ...data.campaigns];
    } else {
      data.campaigns = data.campaigns.map((c) =>
        c.id === incoming.id
          ? {
              ...c,
              title: incoming.title !== undefined ? String(incoming.title).slice(0, 80) : c.title,
              headline: incoming.headline !== undefined ? String(incoming.headline).slice(0, 120) : c.headline,
              body: incoming.body !== undefined ? String(incoming.body).slice(0, 400) : c.body,
              cadence: incoming.cadence ?? c.cadence,
              active: incoming.active ?? c.active,
            }
          : c
      );
    }
    saveStore(data);
    res.json(buildStateResponse(data));
  });

  app.post('/api/campaigns/:id/log-post', (req, res) => {
    const data = ensureStore();
    const { id } = req.params;
    data.campaigns = data.campaigns.map((c) =>
      c.id === id
        ? { ...c, postsCount: c.postsCount + 1, lastPostedAt: new Date().toISOString() }
        : c
    );
    saveStore(data);
    res.json(buildStateResponse(data));
  });

  app.put('/api/platforms/checklist', (req, res) => {
    const data = ensureStore();
    const body = req.body as Record<string, boolean>;
    data.platformChecklist = { ...data.platformChecklist, ...body };
    saveStore(data);
    res.json(buildStateResponse(data));
  });

  app.post('/api/payouts/settle', (_req, res) => {
    const data = ensureStore();
    let settledTotal = 0;
    const updatedEvents: LedgerEvent[] = data.events.map((evt) => {
      if (evt.status === 'pending' && evt.type !== 'payout') {
        settledTotal += evt.creatorShareUsd;
        return { ...evt, status: 'confirmed' as const };
      }
      return evt;
    });

    if (settledTotal > 0) {
      const primaryWallet = pickRecipientWallet(data.config.wallets);
      if (primaryWallet) {
        const settlement: LedgerEvent = {
          id: `evt-${Date.now()}-settle`,
          type: 'payout',
          chain: primaryWallet.chain,
          recipientAddress: primaryWallet.address.trim(),
          grossUsd: Number(settledTotal.toFixed(2)),
          creatorShareUsd: Number(settledTotal.toFixed(2)),
          cryptoAmount: formatCryptoAmount(settledTotal, primaryWallet.chain),
          txRef: `batch_${Math.random().toString(36).slice(2, 10)}`,
          deviceInfo: 'Creator Batch Settlement',
          status: 'confirmed',
          createdAt: new Date().toISOString(),
        };
        updatedEvents.unshift(settlement);
      }
    }

    data.events = updatedEvents.slice(0, 250);
    saveStore(data);
    res.json(buildStateResponse(data));
  });

  app.delete('/api/events', (_req, res) => {
    const data = ensureStore();
    data.events = [];
    data.visitsByChannel = {};
    saveStore(data);
    res.json(buildStateResponse(data));
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ShareDroid server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
