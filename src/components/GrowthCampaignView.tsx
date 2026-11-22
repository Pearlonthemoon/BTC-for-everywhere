import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  Megaphone,
  Plus,
  Rss,
  Share2,
  Store,
} from 'lucide-react';
import type { AppConfig, CampaignChannel, ChannelMetric, DailyCampaign } from '../types/app';

interface GrowthCampaignViewProps {
  config: AppConfig;
  campaigns: DailyCampaign[];
  channelMetrics: ChannelMetric[];
  platformChecklist: Record<string, boolean>;
  onSaveCampaign: (campaign: Partial<DailyCampaign>) => Promise<void>;
  onLogCampaignPost: (campaignId: string) => Promise<void>;
  onTogglePlatform: (platformId: string, checked: boolean) => Promise<void>;
  onGoToDownload: () => void;
}

interface PlatformTarget {
  id: string;
  name: string;
  category: string;
  requirements: string;
  submitUrl: string;
}

const PLATFORM_TARGETS: PlatformTarget[] = [
  {
    id: 'google-play',
    name: 'Google Play Store',
    category: 'Android Store',
    requirements: 'Export Android Studio ZIP, build signed AAB, upload with your store listing copy.',
    submitUrl: 'https://play.google.com/console',
  },
  {
    id: 'github-fdroid',
    name: 'GitHub Releases & F-Droid',
    category: 'Open Android Distribution',
    requirements: 'Push Android Studio project and attach signed APK release tag for direct APK installs.',
    submitUrl: 'https://f-droid.org/docs/Submitting_to_F-Droid_Quick_Start_Guide/',
  },
  {
    id: 'samsung-galaxy',
    name: 'Samsung Galaxy Store',
    category: 'OEM Android Store',
    requirements: 'Submit signed Android APK targeting Samsung Galaxy & Android 7+ devices.',
    submitUrl: 'https://seller.samsungapps.com/',
  },
  {
    id: 'amazon-appstore',
    name: 'Amazon Appstore',
    category: 'Android & Fire OS',
    requirements: 'Upload APK build for Fire tablets, Android phones, and Windows Subsystem.',
    submitUrl: 'https://developer.amazon.com/apps-and-games',
  },
  {
    id: 'google-search',
    name: 'Google Search & Bing Indexing',
    category: 'Web & PWA Discovery',
    requirements: 'robots.txt, sitemap.xml, and Schema.org MobileApplication JSON-LD are already live.',
    submitUrl: 'https://search.google.com/search-console',
  },
  {
    id: 'product-hunt',
    name: 'Product Hunt Launch',
    category: 'Product Directory',
    requirements: 'Share public PWA & Android link with OpenGraph card and creator split breakdown.',
    submitUrl: 'https://www.producthunt.com/posts/new',
  },
];

function buildShareIntentUrl(channel: CampaignChannel, text: string, url: string): string {
  const full = `${text} ${url}`;
  switch (channel) {
    case 'x':
      return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    case 'telegram':
      return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    case 'whatsapp':
      return `https://wa.me/?text=${encodeURIComponent(full)}`;
    case 'reddit':
      return `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`;
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  }
}

export const GrowthCampaignView: React.FC<GrowthCampaignViewProps> = ({
  config,
  campaigns,
  channelMetrics,
  platformChecklist,
  onSaveCampaign,
  onLogCampaignPost,
  onTogglePlatform,
  onGoToDownload,
}) => {
  const [copiedId, setCopiedId] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftHeadline, setDraftHeadline] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [newChannel, setNewChannel] = useState<CampaignChannel>('linkedin');
  const [newHeadline, setNewHeadline] = useState('');
  const [newBody, setNewBody] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://example.com';
  const publicAppUrl = `${origin}/?mode=app`;
  const rssFeedUrl = `${origin}/feed.xml`;
  const jsonFeedUrl = `${origin}/api/campaigns/feed.json`;
  const sitemapUrl = `${origin}/sitemap.xml`;

  const completedPlatforms = useMemo(
    () => PLATFORM_TARGETS.filter((p) => platformChecklist[p.id]).length,
    [platformChecklist]
  );

  const copyText = async (id: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 1800);
  };

  const handleNativeShare = async (campaign: DailyCampaign, utmUrl: string) => {
    const shareText = `${campaign.headline} — ${campaign.body}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: campaign.headline,
          text: shareText,
          url: utmUrl,
        });
        await onLogCampaignPost(campaign.id);
        return;
      } catch {
        // User canceled native share or browser blocked inside iframe; fallback to intent URL
      }
    }
    const intentUrl = buildShareIntentUrl(campaign.channel, shareText, utmUrl);
    const popup = window.open(intentUrl, '_blank', 'noopener,noreferrer');
    if (!popup) {
      await copyText(`copy-${campaign.id}`, `${shareText} ${utmUrl}`);
    }
    await onLogCampaignPost(campaign.id);
  };

  const startEdit = (c: DailyCampaign) => {
    setEditingId(c.id);
    setDraftHeadline(c.headline);
    setDraftBody(c.body);
  };

  const saveEdit = async (c: DailyCampaign) => {
    await onSaveCampaign({
      id: c.id,
      headline: draftHeadline,
      body: draftBody,
    });
    setEditingId(null);
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHeadline.trim() || !newBody.trim()) return;
    await onSaveCampaign({
      title: `Daily ${newChannel.toUpperCase()} Campaign`,
      channel: newChannel,
      headline: newHeadline.trim(),
      body: newBody.trim(),
      cadence: 'daily',
      active: true,
    });
    setNewHeadline('');
    setNewBody('');
    setShowNewForm(false);
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Multi-Platform Publishing &amp; Daily Growth Hub
        </h1>
        <p className="mt-1.5 max-w-3xl text-sm text-slate-600">
          Your web app, Android PWA, SEO Schema.org tags, sitemap, and daily RSS campaign feed are live. Connect your developer store accounts and social schedulers below to publish across app stores and broadcast daily UTM-tracked download links.
        </p>
      </div>

      {/* Section 01: Live Public Discovery & OpenGraph Preview */}
      <section aria-labelledby="discovery-heading" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-amber-600" />
              <h2 id="discovery-heading" className="text-base font-semibold text-slate-900">
                01. Live Public Endpoints &amp; Daily Automation Feeds
              </h2>
            </div>
            <span className="text-xs text-slate-500">Ready for crawlers &amp; schedulers</span>
          </div>

          <p className="text-xs leading-relaxed text-slate-600">
            Search engines and social platforms read your live <code className="font-mono text-slate-800">MobileApplication</code> JSON-LD, OpenGraph card, and <code className="font-mono text-slate-800">sitemap.xml</code>. Connect the RSS feed below to Buffer, Zapier, Make, or IFTTT to auto-post daily on X, Telegram, Facebook, Reddit, and LinkedIn.
          </p>

          <div className="space-y-2.5">
            {[
              { id: 'public-url', label: 'Public Android Download URL', value: publicAppUrl },
              { id: 'rss-url', label: 'Daily Auto-Post RSS Feed (Zapier / Buffer / IFTTT)', value: rssFeedUrl },
              { id: 'json-url', label: 'Webhook / Make JSON Campaign Feed', value: jsonFeedUrl },
              { id: 'sitemap-url', label: 'Search Engine Sitemap (Google / Bing)', value: sitemapUrl },
            ].map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium text-slate-500">{item.label}</div>
                  <div className="truncate font-mono text-xs text-slate-900">{item.value}</div>
                </div>
                <button
                  type="button"
                  onClick={() => void copyText(item.id, item.value)}
                  className="inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 hover:bg-slate-100"
                >
                  {copiedId === item.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedId === item.id ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Social Share Card Preview */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="aspect-video w-full bg-slate-900 overflow-hidden">
            <img
              src="/src/assets/images/og_share_card_1795368163481.jpg"
              alt={`${config.appName} social share preview`}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="p-4">
            <div className="text-[11px] font-medium text-slate-500">Social Link Preview · OpenGraph / X Card</div>
            <h3 className="mt-1 truncate text-sm font-semibold text-slate-900">
              {config.appName} — Android App &amp; Creator Payouts
            </h3>
            <p className="mt-1 line-clamp-2 text-xs text-slate-600">{config.tagline}</p>
          </div>
        </div>
      </section>

      {/* Section 02: Multi-Platform App Store & Directory Checklist */}
      <section aria-labelledby="platforms-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="platforms-heading" className="text-lg font-semibold text-slate-900">
              02. Multi-Platform Store &amp; Directory Publishing
            </h2>
            <p className="text-xs text-slate-500">
              {completedPlatforms} of {PLATFORM_TARGETS.length} distribution channels marked published · External stores require your developer account &amp; signed APK/AAB.
            </p>
          </div>
          <button
            type="button"
            onClick={onGoToDownload}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-900 hover:bg-slate-50"
          >
            <Store className="h-3.5 w-3.5" />
            <span>Export Android Studio ZIP</span>
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {PLATFORM_TARGETS.map((platform) => {
            const done = !!platformChecklist[platform.id];
            return (
              <div key={platform.id} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{platform.name}</h3>
                      <p className="text-[11px] text-slate-500">{platform.category}</p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={(e) => void onTogglePlatform(platform.id, e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      <span>{done ? 'Live' : 'Mark'}</span>
                    </label>
                  </div>
                  <p className="mt-2.5 text-xs leading-relaxed text-slate-600">{platform.requirements}</p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium">
                    {done ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Submitted</span>
                      </>
                    ) : (
                      <span className="text-slate-500">Pending submission</span>
                    )}
                  </span>
                  <a
                    href={platform.submitUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-900 hover:underline"
                  >
                    <span>Open Console</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 03: Daily Promotion & Share Launcher */}
      <section aria-labelledby="daily-ads-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="daily-ads-heading" className="text-lg font-semibold text-slate-900">
              03. Daily Promotion Posts &amp; UTM Share Links
            </h2>
            <p className="text-xs text-slate-500">
              Every share link embeds <code className="font-mono">?mode=app&amp;utm_source=...</code> so you can track which channel drives the most downloads.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowNewForm((s) => !s)}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Daily Post</span>
          </button>
        </div>

        {showNewForm && (
          <form onSubmit={handleCreateCampaign} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="new-cmp-channel" className="block text-xs font-medium text-slate-600">
                  Target Channel
                </label>
                <select
                  id="new-cmp-channel"
                  value={newChannel}
                  onChange={(e) => setNewChannel(e.target.value as CampaignChannel)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="x">X / Twitter</option>
                  <option value="telegram">Telegram</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="reddit">Reddit</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="facebook">Facebook</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="new-cmp-headline" className="block text-xs font-medium text-slate-600">
                  Campaign Headline
                </label>
                <input
                  id="new-cmp-headline"
                  type="text"
                  required
                  value={newHeadline}
                  onChange={(e) => setNewHeadline(e.target.value)}
                  placeholder={`Download ${config.appName} on Android today`}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>
            </div>
            <div>
              <label htmlFor="new-cmp-body" className="block text-xs font-medium text-slate-600">
                Daily Ad / Post Copy
              </label>
              <textarea
                id="new-cmp-body"
                rows={2}
                required
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="Install in 1 tap on Android — offline-ready utility with transparent creator support."
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="min-h-[38px] rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[38px] rounded-lg bg-slate-900 px-4 text-xs font-medium text-white"
              >
                Save Daily Post
              </button>
            </div>
          </form>
        )}

        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {campaigns.map((c) => {
            const utmUrl = `${origin}/?mode=app&utm_source=${c.channel}&utm_campaign=daily`;
            const fullCopy = `${c.headline}\n\n${c.body}\n\nDownload Android App: ${utmUrl}`;
            const isEditing = editingId === c.id;

            return (
              <div key={c.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold uppercase text-slate-900">{c.channel}</span>
                      <span aria-hidden="true">·</span>
                      <span>{c.cadence} cadence</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{c.postsCount} posts logged</span>
                      {c.lastPostedAt && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Last: {new Date(c.lastPostedAt).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                    {!isEditing && (
                      <>
                        <h3 className="mt-1 text-sm font-semibold text-slate-900">{c.headline}</h3>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">{c.body}</p>
                      </>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Edit Copy
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyText(`cmp-${c.id}`, fullCopy)}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        {copiedId === `cmp-${c.id}` ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedId === `cmp-${c.id}` ? 'Copied' : 'Copy Post'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleNativeShare(c, utmUrl)}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-xs font-medium text-white hover:bg-slate-800"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        <span>Post Now</span>
                      </button>
                    </div>
                  )}
                </div>

                {isEditing && (
                  <div className="mt-3 space-y-2.5">
                    <input
                      type="text"
                      value={draftHeadline}
                      onChange={(e) => setDraftHeadline(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900"
                    />
                    <textarea
                      rows={2}
                      value={draftBody}
                      onChange={(e) => setDraftBody(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="min-h-[36px] rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void saveEdit(c)}
                        className="min-h-[36px] rounded-lg bg-slate-900 px-3.5 text-xs font-medium text-white"
                      >
                        Save Copy
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-2.5 flex items-center gap-2 font-mono text-[11px] text-slate-500">
                  <Rss className="h-3 w-3 shrink-0" />
                  <span className="truncate">{utmUrl}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 04: Channel Attribution Table */}
      <section aria-labelledby="attribution-heading" className="space-y-3">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-slate-700" />
          <h2 id="attribution-heading" className="text-base font-semibold text-slate-900">
            04. Tracked Channel Attribution (UTM Visits &amp; Conversions)
          </h2>
        </div>

        {channelMetrics.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-center text-xs text-slate-600">
            No referral visits or downloads logged yet. Share any UTM link above to start tracking platform conversions.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="px-4 py-3 font-medium">Channel (utm_source)</th>
                  <th className="px-4 py-3 font-medium text-right">Clicks / Visits</th>
                  <th className="px-4 py-3 font-medium text-right">Downloads</th>
                  <th className="px-4 py-3 font-medium text-right">Active Runs</th>
                  <th className="px-4 py-3 font-medium text-right">Creator Share Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {channelMetrics.map((m) => (
                  <tr key={m.channel} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono font-medium text-slate-900">{m.channel}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">{m.visits}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900">{m.downloads}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">{m.runs}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-amber-700">
                      ${m.creatorShareUsd.toFixed(2)}
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
