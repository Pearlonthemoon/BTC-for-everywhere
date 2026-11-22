export type ChainId = 'BTC' | 'LN' | 'ETH' | 'SOL' | 'USDT' | 'LTC';

export interface WalletAddressConfig {
  id: string;
  chain: ChainId;
  network: string;
  label: string;
  address: string;
  splitPercent: number;
  enabled: boolean;
}

export type DownloadModel = 'paid_unlock' | 'supporter_pwyw' | 'free_run_share';
export type RevenueMode = 'download' | 'run' | 'hybrid';

export interface AppConfig {
  appName: string;
  packageId: string;
  version: string;
  tagline: string;
  description: string;
  downloadModel: DownloadModel;
  downloadPriceUsd: number;
  runShareUsd: number;
  creatorSharePercent: number;
  revenueMode: RevenueMode;
  wallets: WalletAddressConfig[];
  updatedAt: string;
}

export interface LedgerEvent {
  id: string;
  type: 'download' | 'run' | 'tip' | 'payout';
  chain: ChainId;
  recipientAddress: string;
  grossUsd: number;
  creatorShareUsd: number;
  cryptoAmount: string;
  txRef: string;
  deviceInfo: string;
  utmSource?: string;
  status: 'confirmed' | 'pending';
  createdAt: string;
}

export interface ChainAggregate {
  shareUsd: number;
  cryptoTotal: number;
  count: number;
}

export interface AppStats {
  totalDownloads: number;
  totalRuns: number;
  totalGrossUsd: number;
  totalCreatorShareUsd: number;
  pendingShareUsd: number;
  settledShareUsd: number;
  byChain: Record<ChainId, ChainAggregate>;
}

export type CampaignChannel = 'x' | 'telegram' | 'whatsapp' | 'reddit' | 'linkedin' | 'facebook';

export interface DailyCampaign {
  id: string;
  title: string;
  channel: CampaignChannel;
  headline: string;
  body: string;
  cadence: 'daily' | 'twice_daily' | 'weekly';
  active: boolean;
  postsCount: number;
  lastPostedAt: string | null;
}

export interface ChannelMetric {
  channel: string;
  visits: number;
  downloads: number;
  runs: number;
  creatorShareUsd: number;
}

export interface StoreState {
  config: AppConfig;
  events: LedgerEvent[];
  stats: AppStats;
  campaigns: DailyCampaign[];
  channelMetrics: ChannelMetric[];
  platformChecklist: Record<string, boolean>;
}
