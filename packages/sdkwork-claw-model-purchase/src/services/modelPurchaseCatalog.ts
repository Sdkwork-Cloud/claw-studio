import { i18n, normalizeLanguage } from '@sdkwork/claw-i18n';
import { studioMockService } from '@sdkwork/claw-infrastructure';
import type { ApiRouterChannel } from '@sdkwork/claw-types';

export type ModelPurchaseVendorGroup = 'default' | 'us-top10' | 'china-top10';
export type ModelPurchaseRegion = 'global' | 'us' | 'china';
export type ModelPurchaseBillingCycleId = 'monthly' | 'quarterly' | 'yearly';
export type ModelPurchaseTone =
  | 'zinc'
  | 'emerald'
  | 'sky'
  | 'blue'
  | 'cyan'
  | 'violet'
  | 'amber'
  | 'orange'
  | 'rose'
  | 'fuchsia'
  | 'teal'
  | 'indigo';

export interface ModelPurchasePlan {
  id: string;
  name: string;
  tagline: string;
  badge: 'recommended' | 'best-value' | 'enterprise' | null;
  priceCny: number;
  originalPriceCny: number | null;
  savingsLabel: string | null;
  tokenAllowance: string;
  seats: string;
  concurrency: string;
  support: string;
  includedModels: string[];
  benefits: string[];
}

export interface ModelPurchaseBillingCycle {
  id: ModelPurchaseBillingCycleId;
  label: string;
  description: string;
  savingsHint: string;
  plans: ModelPurchasePlan[];
}

export interface ModelPurchaseVendorMetric {
  id: string;
  label: string;
  value: string;
}

export interface ModelPurchaseVendor {
  id: string;
  name: string;
  shortName: string;
  group: ModelPurchaseVendorGroup;
  region: ModelPurchaseRegion;
  channelId: string | null;
  tone: ModelPurchaseTone;
  tagline: string;
  heroDescription: string;
  audience: string;
  modelHighlights: string[];
  metrics: ModelPurchaseVendorMetric[];
  billingCycles: ModelPurchaseBillingCycle[];
}

type TierNameSet = [string, string, string];

interface VendorProfile {
  id: string;
  name: string;
  shortName: string;
  group: ModelPurchaseVendorGroup;
  region: ModelPurchaseRegion;
  channelId: string | null;
  tone: ModelPurchaseTone;
  tagline: string;
  heroDescription: string;
  audience: string;
  modelHighlights: string[];
  basePricesCny: [number, number, number];
  baseTokensMillions: [number, number, number];
  monthlyNames?: TierNameSet;
  quarterlyNames?: TierNameSet;
  yearlyNames?: TierNameSet;
}

const vendorProfiles: VendorProfile[] = [
  {
    id: 'default',
    name: 'Default',
    shortName: 'Blend',
    group: 'default',
    region: 'global',
    channelId: null,
    tone: 'zinc',
    tagline: 'Balanced routing for teams that want one commercial lane.',
    heroDescription: 'Blend US and China routes into one shared quota pool.',
    audience: 'Cross-border product teams',
    modelHighlights: ['Smart routing', 'Unified quota', 'Fallback ready'],
    basePricesCny: [69, 169, 399],
    baseTokensMillions: [40, 140, 420],
    monthlyNames: ['Starter Router', 'Growth Router', 'Scale Router'],
    quarterlyNames: ['Team Router', 'Business Router', 'Alliance Router'],
    yearlyNames: ['Annual Router', 'Flagship Router', 'Enterprise Router'],
  },
  {
    id: 'openai',
    name: 'ChatGPT',
    shortName: 'GPT',
    group: 'us-top10',
    region: 'us',
    channelId: 'openai',
    tone: 'emerald',
    tagline: 'Premium GPT packages for agents, chat, and reasoning.',
    heroDescription: 'Ideal for premium assistants and operator copilots.',
    audience: 'Product + agent teams',
    modelHighlights: ['GPT-4.1', 'o4-mini', 'Realtime'],
    basePricesCny: [99, 239, 559],
    baseTokensMillions: [55, 180, 520],
    monthlyNames: ['ChatGPT Launch', 'ChatGPT Pro', 'ChatGPT Max'],
    quarterlyNames: ['ChatGPT Team', 'ChatGPT Business', 'ChatGPT Scale'],
    yearlyNames: ['ChatGPT Annual', 'ChatGPT Flagship', 'ChatGPT Enterprise'],
  },
  {
    id: 'anthropic',
    name: 'Claude',
    shortName: 'Claude',
    group: 'us-top10',
    region: 'us',
    channelId: 'anthropic',
    tone: 'amber',
    tagline: 'Long-context procurement for writing and knowledge work.',
    heroDescription: 'Designed for review, policy, and document-heavy use cases.',
    audience: 'Research and writing workflows',
    modelHighlights: ['Claude Sonnet', 'Claude Opus', 'Long context'],
    basePricesCny: [89, 219, 519],
    baseTokensMillions: [50, 160, 460],
  },
  {
    id: 'google',
    name: 'Gemini',
    shortName: 'Gemini',
    group: 'us-top10',
    region: 'us',
    channelId: 'google',
    tone: 'sky',
    tagline: 'Multimodal packages for search, docs, and workspace AI.',
    heroDescription: 'Great for image, document, and multimodal product flows.',
    audience: 'Multimodal product teams',
    modelHighlights: ['Gemini 2.5 Pro', 'Gemini Flash', 'Workspace'],
    basePricesCny: [85, 209, 499],
    baseTokensMillions: [48, 155, 450],
  },
  {
    id: 'xai',
    name: 'Grok',
    shortName: 'Grok',
    group: 'us-top10',
    region: 'us',
    channelId: 'xai',
    tone: 'fuchsia',
    tagline: 'Fresh-response packages for trend-sensitive products.',
    heroDescription: 'For media, social, and real-time assistant experiences.',
    audience: 'Media and social apps',
    modelHighlights: ['Grok reasoning', 'Freshness bias', 'Fast iteration'],
    basePricesCny: [79, 199, 469],
    baseTokensMillions: [46, 150, 430],
  },
  {
    id: 'meta',
    name: 'Meta Llama',
    shortName: 'Llama',
    group: 'us-top10',
    region: 'us',
    channelId: 'meta',
    tone: 'blue',
    tagline: 'Open-weight aligned packages with routed governance.',
    heroDescription: 'Good for builders mixing open-weight flexibility with managed routing.',
    audience: 'Open model platform teams',
    modelHighlights: ['Llama', 'Fine-tune ready', 'Self-host fit'],
    basePricesCny: [72, 189, 449],
    baseTokensMillions: [44, 145, 420],
  },
  {
    id: 'mistral',
    name: 'Mistral',
    shortName: 'Mistral',
    group: 'us-top10',
    region: 'us',
    channelId: 'mistral',
    tone: 'orange',
    tagline: 'Efficient European packages for cost-aware copilots.',
    heroDescription: 'Strong for automation and productivity without premium spend.',
    audience: 'Automation teams',
    modelHighlights: ['Mistral Large', 'Low latency', 'Cost efficient'],
    basePricesCny: [68, 178, 428],
    baseTokensMillions: [42, 138, 410],
  },
  {
    id: 'cohere',
    name: 'Cohere',
    shortName: 'Cohere',
    group: 'us-top10',
    region: 'us',
    channelId: 'cohere',
    tone: 'violet',
    tagline: 'Search and RAG procurement with enterprise posture.',
    heroDescription: 'Built for retrieval, embeddings, and business copilots.',
    audience: 'Search and RAG platforms',
    modelHighlights: ['Command', 'RAG', 'Search quality'],
    basePricesCny: [64, 168, 408],
    baseTokensMillions: [40, 132, 390],
  },
  {
    id: 'microsoft',
    name: 'Microsoft Copilot',
    shortName: 'Copilot',
    group: 'us-top10',
    region: 'us',
    channelId: 'microsoft',
    tone: 'cyan',
    tagline: 'Enterprise-oriented packages for Microsoft-heavy stacks.',
    heroDescription: 'Best for workflow automation and corporate procurement.',
    audience: 'Enterprise IT teams',
    modelHighlights: ['Copilot', 'Workflow AI', 'Governance'],
    basePricesCny: [91, 229, 539],
    baseTokensMillions: [52, 170, 490],
  },
  {
    id: 'amazon-nova',
    name: 'Amazon Nova',
    shortName: 'Nova',
    group: 'us-top10',
    region: 'us',
    channelId: 'amazon-nova',
    tone: 'indigo',
    tagline: 'AWS-centered packages for scalable routed procurement.',
    heroDescription: 'A clean buying lane for AWS-native product teams.',
    audience: 'AWS-native application teams',
    modelHighlights: ['Nova', 'AWS alignment', 'Scalable throughput'],
    basePricesCny: [77, 196, 468],
    baseTokensMillions: [45, 148, 435],
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    shortName: 'NVIDIA',
    group: 'us-top10',
    region: 'us',
    channelId: 'nvidia',
    tone: 'teal',
    tagline: 'Inference-heavy packages for GPU-first platform teams.',
    heroDescription: 'Optimized for teams that care about throughput and hybrid deployment.',
    audience: 'Inference platform teams',
    modelHighlights: ['NIM', 'GPU throughput', 'Hybrid deploy'],
    basePricesCny: [84, 214, 518],
    baseTokensMillions: [49, 158, 470],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    shortName: 'DeepSeek',
    group: 'china-top10',
    region: 'china',
    channelId: 'deepseek',
    tone: 'teal',
    tagline: 'High value reasoning and coding packages.',
    heroDescription: 'Excellent for engineering, analysis, and price-performance routing.',
    audience: 'Engineering and reasoning workloads',
    modelHighlights: ['DeepSeek reasoning', 'Coding', 'Value per token'],
    basePricesCny: [59, 149, 359],
    baseTokensMillions: [52, 175, 510],
  },
  {
    id: 'qwen',
    name: 'Qwen',
    shortName: 'Qwen',
    group: 'china-top10',
    region: 'china',
    channelId: 'qwen',
    tone: 'cyan',
    tagline: 'Balanced domestic packages for multilingual enterprise AI.',
    heroDescription: 'A versatile lane for general domestic business applications.',
    audience: 'General enterprise applications',
    modelHighlights: ['Qwen reasoning', 'Multilingual', 'Enterprise ready'],
    basePricesCny: [61, 154, 372],
    baseTokensMillions: [50, 168, 490],
  },
  {
    id: 'zhipu',
    name: 'Zhipu GLM',
    shortName: 'GLM',
    group: 'china-top10',
    region: 'china',
    channelId: 'zhipu',
    tone: 'rose',
    tagline: 'Domestic GLM packages with clean procurement structure.',
    heroDescription: 'Well suited for enterprise deployments and regulated buyers.',
    audience: 'Domestic enterprise teams',
    modelHighlights: ['GLM', 'Domestic compliance', 'Developer flows'],
    basePricesCny: [58, 146, 348],
    baseTokensMillions: [48, 160, 470],
  },
  {
    id: 'baidu',
    name: 'ERNIE',
    shortName: 'ERNIE',
    group: 'china-top10',
    region: 'china',
    channelId: 'baidu',
    tone: 'rose',
    tagline: 'Enterprise-friendly packages for search and knowledge systems.',
    heroDescription: 'A practical buy for assistants, search, and knowledge workflows.',
    audience: 'Search and knowledge teams',
    modelHighlights: ['ERNIE', 'Search native', 'Enterprise support'],
    basePricesCny: [57, 144, 342],
    baseTokensMillions: [47, 158, 460],
  },
  {
    id: 'tencent-hunyuan',
    name: 'Tencent Hunyuan',
    shortName: 'Hunyuan',
    group: 'china-top10',
    region: 'china',
    channelId: 'tencent-hunyuan',
    tone: 'sky',
    tagline: 'Tencent ecosystem packages for consumer-scale AI products.',
    heroDescription: 'Best for broad service platforms and high-volume assistants.',
    audience: 'Consumer and service platforms',
    modelHighlights: ['Hunyuan', 'Tencent ecosystem', 'Large traffic'],
    basePricesCny: [60, 152, 366],
    baseTokensMillions: [49, 166, 485],
  },
  {
    id: 'doubao',
    name: 'Doubao',
    shortName: 'Doubao',
    group: 'china-top10',
    region: 'china',
    channelId: 'doubao',
    tone: 'orange',
    tagline: 'Fast-growing consumer packages for creator-scale AI.',
    heroDescription: 'Suited for high-volume user products and creator tooling.',
    audience: 'Consumer AI teams',
    modelHighlights: ['Doubao', 'Consumer scale', 'Creator workflows'],
    basePricesCny: [63, 159, 379],
    baseTokensMillions: [51, 170, 495],
  },
  {
    id: 'moonshot',
    name: 'Kimi',
    shortName: 'Kimi',
    group: 'china-top10',
    region: 'china',
    channelId: 'moonshot',
    tone: 'indigo',
    tagline: 'Long-context packages for research and document copilots.',
    heroDescription: 'Excellent when long documents are central to the user journey.',
    audience: 'Research and document-heavy teams',
    modelHighlights: ['Long context', 'Research', 'Document copilots'],
    basePricesCny: [66, 166, 396],
    baseTokensMillions: [53, 174, 505],
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    shortName: 'MiniMax',
    group: 'china-top10',
    region: 'china',
    channelId: 'minimax',
    tone: 'fuchsia',
    tagline: 'Multimodal packages for expressive AI product experiences.',
    heroDescription: 'Great for long sessions, multimodal apps, and media-rich use cases.',
    audience: 'Multimodal product teams',
    modelHighlights: ['Multimodal', 'Long context', 'Media generation'],
    basePricesCny: [79, 198, 458],
    baseTokensMillions: [54, 176, 515],
    monthlyNames: ['MiniMax Sprint', 'MiniMax Studio', 'MiniMax Infinite'],
    quarterlyNames: ['MiniMax Growth', 'MiniMax Business', 'MiniMax Scale'],
    yearlyNames: ['MiniMax Annual', 'MiniMax Prime', 'MiniMax Enterprise'],
  },
];

const cycleConfigs = {
  monthly: {
    totalMultiplier: 1,
    tokenMultiplier: 1,
  },
  quarterly: {
    totalMultiplier: 2.76,
    tokenMultiplier: 3.4,
  },
  yearly: {
    totalMultiplier: 9.24,
    tokenMultiplier: 13.2,
  },
} as const satisfies Record<
  ModelPurchaseBillingCycleId,
  {
    totalMultiplier: number;
    tokenMultiplier: number;
  }
>;

function resolveCatalogLanguage(language?: string) {
  return normalizeLanguage(language ?? i18n.resolvedLanguage ?? i18n.language);
}

function translate(
  language: string | undefined,
  key: string,
  options: Record<string, unknown> = {},
) {
  return i18n.t(key, {
    lng: resolveCatalogLanguage(language),
    ...options,
  });
}

function getPlanNames(profile: VendorProfile, cycleId: ModelPurchaseBillingCycleId): TierNameSet {
  if (cycleId === 'monthly') {
    return profile.monthlyNames ?? [
      `${profile.shortName} Launch`,
      `${profile.shortName} Pro`,
      `${profile.shortName} Max`,
    ];
  }

  if (cycleId === 'quarterly') {
    return profile.quarterlyNames ?? [
      `${profile.shortName} Team`,
      `${profile.shortName} Business`,
      `${profile.shortName} Scale`,
    ];
  }

  return profile.yearlyNames ?? [
    `${profile.shortName} Annual`,
    `${profile.shortName} Flagship`,
    `${profile.shortName} Enterprise`,
  ];
}

function roundPrice(value: number) {
  return Math.round(value / 10) * 10;
}

function formatLocaleNumber(language: string | undefined, value: number) {
  return new Intl.NumberFormat(resolveCatalogLanguage(language)).format(value);
}

function formatTokenAllowance(language: string | undefined, tokensInMillions: number) {
  return translate(language, 'modelPurchase.plans.tokens', {
    value: formatLocaleNumber(language, tokensInMillions),
  });
}

function buildVendorMetrics(
  language: string | undefined,
  profile: VendorProfile,
  channel: ApiRouterChannel | null,
): ModelPurchaseVendorMetric[] {
  if (!channel) {
    return [
      {
        id: 'coverage',
        label: translate(language, 'modelPurchase.metrics.curatedRoutes.label'),
        value: translate(language, 'modelPurchase.metrics.curatedRoutes.value'),
      },
      {
        id: 'family',
        label: translate(language, 'modelPurchase.metrics.packagingMode.label'),
        value: translate(language, 'modelPurchase.metrics.packagingMode.value'),
      },
      {
        id: 'audience',
        label: translate(language, 'modelPurchase.metrics.bestFor.label'),
        value: translate(language, `modelPurchase.vendors.${profile.id}.audience`, {
          defaultValue: profile.audience,
        }),
      },
    ];
  }

  return [
    {
      id: 'coverage',
      label: translate(language, 'modelPurchase.metrics.routedProviders.label'),
      value: translate(language, 'modelPurchase.metrics.routedProviders.value', {
        active: channel.activeProviderCount,
        total: channel.providerCount,
      }),
    },
    {
      id: 'family',
      label: translate(language, 'modelPurchase.metrics.modelFamily.label'),
      value: channel.modelFamily,
    },
    {
      id: 'audience',
      label: translate(language, 'modelPurchase.metrics.bestFor.label'),
      value: translate(language, `modelPurchase.vendors.${profile.id}.audience`, {
        defaultValue: profile.audience,
      }),
    },
  ];
}

function buildBenefits(
  language: string | undefined,
  profile: VendorProfile,
  tierIndex: number,
  channel: ApiRouterChannel | null,
) {
  const modelLine =
    tierIndex === 0
      ? profile.modelHighlights[0]!
      : tierIndex === 1
        ? profile.modelHighlights.slice(0, 2).join(' + ')
        : profile.modelHighlights.join(' + ');

  const sharedBenefits = [
    [
      translate(language, 'modelPurchase.plans.benefits.usageOverview'),
      translate(language, 'modelPurchase.plans.benefits.keyRotationReminders'),
      translate(language, 'modelPurchase.plans.benefits.includesModels', { models: modelLine }),
    ],
    [
      translate(language, 'modelPurchase.plans.benefits.priorityProcurement'),
      translate(language, 'modelPurchase.plans.benefits.routeHealthDigest'),
      translate(language, 'modelPurchase.plans.benefits.includesModels', { models: modelLine }),
    ],
    [
      translate(language, 'modelPurchase.plans.benefits.dedicatedOnboarding'),
      translate(language, 'modelPurchase.plans.benefits.privateRoutingAdvisory'),
      translate(language, 'modelPurchase.plans.benefits.includesModels', { models: modelLine }),
    ],
  ] as const;

  return [
    ...sharedBenefits[tierIndex],
    channel
      ? translate(language, 'modelPurchase.plans.benefits.channelNamed', { name: channel.name })
      : translate(language, 'modelPurchase.plans.benefits.channelDefault'),
  ];
}

function buildCycle(
  language: string | undefined,
  profile: VendorProfile,
  channel: ApiRouterChannel | null,
  cycleId: ModelPurchaseBillingCycleId,
): ModelPurchaseBillingCycle {
  const config = cycleConfigs[cycleId];
  const planNames = getPlanNames(profile, cycleId);
  const originalMultiplier = cycleId === 'monthly' ? 1 : cycleId === 'quarterly' ? 3 : 12;

  return {
    id: cycleId,
    label: translate(language, `modelPurchase.cycles.${cycleId}.label`),
    description: translate(language, `modelPurchase.cycles.${cycleId}.description`),
    savingsHint: translate(language, `modelPurchase.cycles.${cycleId}.savingsHint`),
    plans: profile.basePricesCny.map((basePrice, tierIndex) => {
      const originalPrice = roundPrice(basePrice * originalMultiplier);
      const totalPrice = roundPrice(basePrice * config.totalMultiplier);
      const tierKey = tierIndex === 0 ? 'starter' : tierIndex === 1 ? 'growth' : 'enterprise';
      const taglineKey = tierIndex === 0 ? 'launch' : tierIndex === 1 ? 'pro' : 'enterprise';

      return {
        id: `${profile.id}-${cycleId}-${tierIndex}`,
        name: planNames[tierIndex]!,
        tagline: translate(language, `modelPurchase.plans.taglines.${taglineKey}`, {
          vendor: profile.shortName,
        }),
        badge: tierIndex === 1 ? 'recommended' : tierIndex === 2 ? 'enterprise' : cycleId === 'yearly' ? 'best-value' : null,
        priceCny: totalPrice,
        originalPriceCny: cycleId === 'monthly' ? null : originalPrice,
        savingsLabel:
          cycleId === 'monthly' ? null : translate(language, `modelPurchase.cycles.${cycleId}.savingsHint`),
        tokenAllowance: formatTokenAllowance(
          language,
          Math.round(profile.baseTokensMillions[tierIndex]! * config.tokenMultiplier),
        ),
        seats: translate(language, `modelPurchase.plans.seats.${tierKey}`),
        concurrency: translate(language, `modelPurchase.plans.concurrency.${tierKey}`),
        support: translate(language, `modelPurchase.plans.support.${tierKey}`),
        includedModels:
          tierIndex === 0
            ? [profile.modelHighlights[0]!]
            : tierIndex === 1
              ? profile.modelHighlights.slice(0, 2)
              : profile.modelHighlights,
        benefits: buildBenefits(language, profile, tierIndex, channel),
      } satisfies ModelPurchasePlan;
    }),
  };
}

function buildVendor(
  language: string | undefined,
  profile: VendorProfile,
  channels: ApiRouterChannel[],
): ModelPurchaseVendor {
  const channel = profile.channelId
    ? channels.find((item) => item.id === profile.channelId) ?? null
    : null;

  return {
    id: profile.id,
    name: profile.name,
    shortName: profile.shortName,
    group: profile.group,
    region: profile.region,
    channelId: profile.channelId,
    tone: profile.tone,
    tagline: translate(language, `modelPurchase.vendors.${profile.id}.tagline`, {
      defaultValue: profile.tagline,
    }),
    heroDescription: translate(language, `modelPurchase.vendors.${profile.id}.heroDescription`, {
      defaultValue: profile.heroDescription,
    }),
    audience: translate(language, `modelPurchase.vendors.${profile.id}.audience`, {
      defaultValue: profile.audience,
    }),
    modelHighlights: profile.modelHighlights.map((highlight, index) =>
      translate(language, `modelPurchase.vendors.${profile.id}.modelHighlights.${index}`, {
        defaultValue: highlight,
      }),
    ),
    metrics: buildVendorMetrics(language, profile, channel),
    billingCycles: [
      buildCycle(language, profile, channel, 'monthly'),
      buildCycle(language, profile, channel, 'quarterly'),
      buildCycle(language, profile, channel, 'yearly'),
    ],
  };
}

export const modelPurchaseCatalogService = {
  async listVendors(language?: string): Promise<ModelPurchaseVendor[]> {
    const channels = await studioMockService.listApiRouterChannels();
    return vendorProfiles.map((profile) => buildVendor(language, profile, channels));
  },
};
