import {
  studioMockService,
  type MockChannel,
  type MockInstance,
  type MockTask,
} from '@sdkwork/claw-infrastructure';
import type { Agent, Skill } from '@sdkwork/claw-types';
import type {
  DashboardActivityFeed,
  DashboardAlertItem,
  DashboardAgentSummary,
  DashboardApiCallRecord,
  DashboardAnalyticsGranularity,
  DashboardAnalyticsQuery,
  DashboardAnalyticsRangeMode,
  DashboardBusinessSummary,
  DashboardInstanceSummary,
  DashboardProductPerformanceRow,
  DashboardRevenueAnalytics,
  DashboardRevenueProductBreakdown,
  DashboardRevenueRecord,
  DashboardRevenueTrendPoint,
  DashboardRecommendation,
  DashboardSnapshot,
  DashboardTokenAnalytics,
  DashboardTokenInstanceBreakdown,
  DashboardTokenSummary,
  DashboardTokenModelBreakdown,
  DashboardTokenTrendPoint,
} from '../types';

interface WorkspaceHealthScoreInput {
  instances: MockInstance[];
  tasks: MockTask[];
  channels: MockChannel[];
}

interface CapabilityCoverageScoreInput extends WorkspaceHealthScoreInput {
  agents: Agent[];
  installedSkills: Skill[];
}

interface TokenAnalyticsInput extends CapabilityCoverageScoreInput {
  analyticsQuery: ResolvedAnalyticsQuery;
  instanceSummaries: DashboardInstanceSummary[];
}

interface RevenueAnalyticsInput extends CapabilityCoverageScoreInput {
  analyticsQuery: ResolvedAnalyticsQuery;
  tokenAnalytics: DashboardTokenAnalytics;
}

interface ResolvedAnalyticsQuery {
  granularity: DashboardAnalyticsGranularity;
  rangeMode: DashboardAnalyticsRangeMode;
  selectedMonthKey?: string;
  customRange?: {
    start: string;
    end: string;
  };
  bucketCount: number;
  bucketDates: Date[];
}

interface ModelProfile {
  id: string;
  modelName: string;
  weight: number;
  avgTokensPerRequest: number;
  actualRate: number;
  standardRate: number;
}

interface ProductProfile {
  id: string;
  weight: number;
  averageOrderValue: number;
}

const REFERENCE_DATE = new Date(Date.UTC(2026, 2, 18, 12, 0, 0));
const DEFAULT_MONTH_KEY = '2026-03';
const MODEL_PROFILES: ModelProfile[] = [
  {
    id: 'gpt-5.4',
    modelName: 'GPT-5.4',
    weight: 0.28,
    avgTokensPerRequest: 3600,
    actualRate: 0.0000122,
    standardRate: 0.0000139,
  },
  {
    id: 'claude-sonnet-4.5',
    modelName: 'Claude Sonnet 4.5',
    weight: 0.24,
    avgTokensPerRequest: 3100,
    actualRate: 0.0000114,
    standardRate: 0.0000128,
  },
  {
    id: 'gemini-2.5-pro',
    modelName: 'Gemini 2.5 Pro',
    weight: 0.19,
    avgTokensPerRequest: 2950,
    actualRate: 0.0000101,
    standardRate: 0.0000119,
  },
  {
    id: 'qwen2.5-coder-32b',
    modelName: 'Qwen2.5 Coder 32B',
    weight: 0.16,
    avgTokensPerRequest: 2450,
    actualRate: 0.0000068,
    standardRate: 0.0000077,
  },
  {
    id: 'deepseek-r1',
    modelName: 'DeepSeek R1',
    weight: 0.13,
    avgTokensPerRequest: 4000,
    actualRate: 0.0000086,
    standardRate: 0.0000098,
  },
];
const PRODUCT_PROFILES: ProductProfile[] = [
  {
    id: 'memberships',
    weight: 0.27,
    averageOrderValue: 188,
  },
  {
    id: 'apiPackages',
    weight: 0.24,
    averageOrderValue: 132,
  },
  {
    id: 'extensionMarket',
    weight: 0.18,
    averageOrderValue: 96,
  },
  {
    id: 'enterpriseServices',
    weight: 0.19,
    averageOrderValue: 356,
  },
  {
    id: 'digitalGoods',
    weight: 0.12,
    averageOrderValue: 74,
  },
];

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

function roundPercentage(value: number) {
  return Number(value.toFixed(1));
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function createUtcDate(year: number, monthIndex: number, day: number, hour = 0) {
  return new Date(Date.UTC(year, monthIndex, day, hour, 0, 0));
}

function formatMonthKey(date: Date) {
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}`;
}

function formatDayKey(date: Date) {
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

function parseMonthKey(monthKey: string) {
  const [yearText, monthText] = monthKey.split('-');
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return parseMonthKey(DEFAULT_MONTH_KEY);
  }

  return { year, monthIndex: month - 1 };
}

function parseCustomDate(value: string | undefined, fallback: Date) {
  if (!value) {
    return fallback;
  }

  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return fallback;
  }

  return createUtcDate(year, month - 1, day);
}

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addHours(date: Date, hours: number) {
  const next = new Date(date.getTime());
  next.setUTCHours(next.getUTCHours() + hours);
  return next;
}

function buildDateRange(
  start: Date,
  bucketCount: number,
  granularity: DashboardAnalyticsGranularity,
) {
  return Array.from({ length: bucketCount }, (_, index) =>
    granularity === 'day' ? addDays(start, index) : addHours(start, index),
  );
}

function resolveAnalyticsQuery(
  query: DashboardAnalyticsQuery = {},
): ResolvedAnalyticsQuery {
  const granularity = query.granularity ?? 'day';
  const rangeMode = query.rangeMode ?? 'seven_days';

  if (rangeMode === 'month') {
    const selectedMonthKey = query.monthKey ?? DEFAULT_MONTH_KEY;
    const { year, monthIndex } = parseMonthKey(selectedMonthKey);
    const start = createUtcDate(year, monthIndex, 1);
    const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    const bucketCount = granularity === 'day' ? lastDay : lastDay * 24;

    return {
      granularity,
      rangeMode,
      selectedMonthKey,
      bucketCount,
      bucketDates: buildDateRange(start, bucketCount, granularity),
    };
  }

  if (rangeMode === 'custom') {
    const fallbackStart = createUtcDate(2026, 2, 1);
    const fallbackEnd = createUtcDate(2026, 2, 18);
    const rawStart = parseCustomDate(query.customStart, fallbackStart);
    const rawEnd = parseCustomDate(query.customEnd, fallbackEnd);
    const start = rawStart <= rawEnd ? rawStart : rawEnd;
    const end = rawStart <= rawEnd ? rawEnd : rawStart;
    const bucketCount =
      granularity === 'day'
        ? Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1)
        : Math.max(1, Math.round((end.getTime() - start.getTime()) / (60 * 60 * 1000)) + 24);

    return {
      granularity,
      rangeMode,
      customRange: {
        start: formatDayKey(start),
        end: formatDayKey(end),
      },
      bucketCount,
      bucketDates: buildDateRange(start, bucketCount, granularity),
    };
  }

  const dayCount = 7;
  const bucketCount = granularity === 'day' ? dayCount : dayCount * 24;
  const start =
    granularity === 'day'
      ? addDays(createUtcDate(2026, 2, 18), -(dayCount - 1))
      : addHours(createUtcDate(2026, 2, 12), 0);

  return {
    granularity,
    rangeMode: 'seven_days',
    bucketCount,
    bucketDates: buildDateRange(start, bucketCount, granularity),
  };
}

function scoreTaskStatus(task: MockTask) {
  switch (task.status) {
    case 'active':
      return 1;
    case 'paused':
      return 0.65;
    case 'failed':
      return 0.2;
    default:
      return 0.5;
  }
}

function scoreChannelStatus(channel: MockChannel) {
  if (channel.status === 'connected' && channel.enabled) {
    return 1;
  }
  if (channel.status === 'disconnected') {
    return 0.45;
  }
  return 0.15;
}

function calculateResourceEfficiency(instances: MockInstance[]) {
  const onlineInstances = instances.filter((instance) => instance.status === 'online');
  if (onlineInstances.length === 0) {
    return 45;
  }

  const averagePressure =
    onlineInstances.reduce((total, instance) => {
      return total + (instance.cpu + instance.memory) / 2;
    }, 0) / onlineInstances.length;

  return clampScore(100 - averagePressure);
}

function calculateAmount(tokens: number, rate: number) {
  return roundCurrency(tokens * rate);
}

function distributeTotal(total: number, weights: number[]) {
  const values: number[] = [];
  let allocated = 0;
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);

  weights.forEach((weight, index) => {
    if (index === weights.length - 1) {
      values.push(total - allocated);
      return;
    }

    const value = Math.round((total * weight) / weightTotal);
    values.push(value);
    allocated += value;
  });

  return values;
}

function calculateEstimatedRuns(tasks: MockTask[], activeInstanceCount: number, bucketCount: number) {
  const taskRuns = tasks.reduce((total, task) => {
    if (task.status === 'active') {
      return total + (task.actionType === 'skill' ? 12 : 8);
    }
    if (task.status === 'paused') {
      return total + 3;
    }
    return total + 1;
  }, 0);

  return Math.max(1, taskRuns + activeInstanceCount * 6 + Math.round(bucketCount / 12));
}

function calculateDeltaPercentage(usageTrend: DashboardTokenTrendPoint[]) {
  return calculateValueDeltaPercentage(usageTrend.map((point) => point.totalTokens));
}

function calculateValueDeltaPercentage(values: number[]) {
  const windowSize = Math.max(1, Math.floor(values.length / 3));
  const firstWindow = values.slice(0, windowSize).reduce((total, value) => total + value, 0);
  const lastWindow = values.slice(-windowSize).reduce((total, value) => total + value, 0);

  if (firstWindow <= 0) {
    return 0;
  }

  return roundPercentage(((lastWindow - firstWindow) / firstWindow) * 100);
}

function calculateWindowDayCount(analyticsQuery: ResolvedAnalyticsQuery) {
  if (analyticsQuery.granularity === 'day') {
    return Math.max(1, analyticsQuery.bucketCount);
  }

  return Math.max(1, Math.ceil(analyticsQuery.bucketCount / 24));
}

function toDisplayProductName(productId: string) {
  switch (productId) {
    case 'memberships':
      return 'Memberships';
    case 'apiPackages':
      return 'API Packages';
    case 'extensionMarket':
      return 'Extension Market';
    case 'enterpriseServices':
      return 'Enterprise Services';
    case 'digitalGoods':
      return 'Digital Goods';
    default:
      return productId;
  }
}

function toProviderName(modelName: string) {
  if (modelName.toLowerCase().includes('gpt')) {
    return 'OpenAI';
  }
  if (modelName.toLowerCase().includes('claude')) {
    return 'Anthropic';
  }
  if (modelName.toLowerCase().includes('gemini')) {
    return 'Google';
  }
  if (modelName.toLowerCase().includes('qwen')) {
    return 'Alibaba Cloud';
  }
  if (modelName.toLowerCase().includes('deepseek')) {
    return 'DeepSeek';
  }

  return 'Model Provider';
}

function buildRecentTimestamp(offsetMinutes: number) {
  return new Date(REFERENCE_DATE.getTime() - offsetMinutes * 60 * 1000).toISOString();
}

function calculateInstanceBaseWeight(summary: DashboardInstanceSummary, agents: Agent[]) {
  const { instance } = summary;
  const statusMultiplier =
    instance.status === 'online'
      ? 1
      : instance.status === 'starting'
        ? 0.72
        : instance.status === 'error'
          ? 0.42
          : 0.24;
  const pressureScore = (instance.cpu + instance.memory) / 2;

  return Math.max(
    1,
    (
      45 +
      summary.readinessScore * 2.2 +
      summary.activeTaskCount * 12 +
      summary.failedTaskCount * 4 +
      summary.connectedChannelCount * 7 +
      summary.installedSkillCount * 5 +
      agents.length * 1.4 +
      pressureScore * 0.65
    ) * statusMultiplier,
  );
}

export function calculateWorkspaceHealthScore({
  instances,
  tasks,
  channels,
}: WorkspaceHealthScoreInput) {
  const instanceAvailabilityScore =
    instances.length === 0
      ? 0
      : (instances.filter((instance) => instance.status === 'online').length / instances.length) *
        100;
  const automationReliabilityScore =
    tasks.length === 0
      ? 80
      : (tasks.reduce((total, task) => total + scoreTaskStatus(task), 0) / tasks.length) * 100;
  const channelReadinessScore =
    channels.length === 0
      ? 55
      : (channels.reduce((total, channel) => total + scoreChannelStatus(channel), 0) /
          channels.length) *
        100;
  const resourceEfficiencyScore = calculateResourceEfficiency(instances);

  return clampScore(
    instanceAvailabilityScore * 0.4 +
      automationReliabilityScore * 0.25 +
      channelReadinessScore * 0.2 +
      resourceEfficiencyScore * 0.15,
  );
}

export function calculateCapabilityCoverageScore({
  instances,
  tasks,
  channels,
  agents,
  installedSkills,
}: CapabilityCoverageScoreInput) {
  const skillBreadthScore = Math.min(100, installedSkills.length * 18);
  const agentBreadthScore = Math.min(100, agents.length * 22);
  const channelDeliveryScore =
    channels.length === 0
      ? 40
      : (channels.filter((channel) => channel.status === 'connected' && channel.enabled).length /
          channels.length) *
        100;
  const automationActivationScore =
    tasks.length === 0
      ? 50
      : (tasks.filter((task) => task.status === 'active').length / tasks.length) * 100;
  const instanceCoverageScore =
    instances.length === 0
      ? 0
      : Math.min(100, (installedSkills.length / Math.max(instances.length, 1)) * 30);

  return clampScore(
    skillBreadthScore * 0.3 +
      agentBreadthScore * 0.25 +
      channelDeliveryScore * 0.2 +
      automationActivationScore * 0.15 +
      instanceCoverageScore * 0.1,
  );
}

function calculateInstanceReadinessScore(
  instance: MockInstance,
  tasks: MockTask[],
  channels: MockChannel[],
  installedSkills: Skill[],
) {
  const statusBaseline =
    instance.status === 'online'
      ? 86
      : instance.status === 'starting'
        ? 72
        : instance.status === 'error'
          ? 28
          : 18;
  const resourcePenalty = ((instance.cpu + instance.memory) / 2) * 0.32;
  const stabilityBonus = instance.status === 'online' && instance.uptime !== '-' ? 8 : 0;
  const automationBonus = Math.min(8, tasks.filter((task) => task.status === 'active').length * 2);
  const deliveryBonus = Math.min(
    6,
    channels.filter((channel) => channel.status === 'connected' && channel.enabled).length * 2,
  );
  const skillBonus = Math.min(10, installedSkills.length * 3);

  return clampScore(
    statusBaseline - resourcePenalty + stabilityBonus + automationBonus + deliveryBonus + skillBonus,
  );
}

function deriveAgentFocusAreas(agent: Agent, installedSkills: Skill[]) {
  const description = `${agent.name} ${agent.description} ${agent.systemPrompt}`.toLowerCase();
  const skillCategories = [...new Set(installedSkills.map((skill) => skill.category))];
  const focusAreas = new Set<string>();

  if (description.includes('code') || description.includes('software')) {
    focusAreas.add('Code');
    focusAreas.add('Architecture');
  }
  if (description.includes('data') || description.includes('analysis')) {
    focusAreas.add('Analytics');
  }
  if (description.includes('operat') || description.includes('workflow')) {
    focusAreas.add('Automation');
    focusAreas.add('Reliability');
  }
  if (description.includes('creative') || description.includes('content')) {
    focusAreas.add('Content');
  }

  skillCategories.slice(0, 2).forEach((category) => focusAreas.add(category));

  if (focusAreas.size === 0) {
    focusAreas.add('Generalist');
  }

  return [...focusAreas].slice(0, 4);
}

function buildAgentSummary(
  agent: Agent,
  tasks: MockTask[],
  channels: MockChannel[],
  installedSkills: Skill[],
): DashboardAgentSummary {
  const focusAreas = deriveAgentFocusAreas(agent, installedSkills);
  const automationFit = clampScore(
    tasks.filter((task) => task.actionType === 'skill' && task.status === 'active').length * 20 +
      focusAreas.length * 12,
  );
  const coverageScore = clampScore(
    automationFit * 0.45 +
      Math.min(100, installedSkills.length * 15) * 0.35 +
      Math.min(100, channels.filter((channel) => channel.enabled).length * 25) * 0.2,
  );

  return {
    agent,
    focusAreas,
    coverageScore,
    automationFit,
  };
}

function buildModelBreakdown(
  totalTokens: number,
  tasks: MockTask[],
  installedSkills: Skill[],
  channels: MockChannel[],
): DashboardTokenModelBreakdown[] {
  const activeSkillTasks = tasks.filter(
    (task) => task.status === 'active' && task.actionType === 'skill',
  ).length;
  const enabledChannels = channels.filter((channel) => channel.enabled).length;
  const weightAdjustments = [
    1 + activeSkillTasks * 0.04,
    1 + installedSkills.length * 0.02,
    1 + enabledChannels * 0.03,
    1 + Math.max(0, installedSkills.length - 4) * 0.02,
    1 + Math.max(0, tasks.length - 3) * 0.015,
  ];
  const weights = MODEL_PROFILES.map((profile, index) => profile.weight * weightAdjustments[index]);
  const tokenDistribution = distributeTotal(totalTokens, weights);

  return MODEL_PROFILES.map((profile, index) => {
    const tokens = tokenDistribution[index];

    return {
      id: profile.id,
      modelName: profile.modelName,
      requestCount: Math.max(1, Math.round(tokens / profile.avgTokensPerRequest)),
      tokens,
      actualAmount: calculateAmount(tokens, profile.actualRate),
      standardAmount: calculateAmount(tokens, profile.standardRate),
      share: totalTokens === 0 ? 0 : roundPercentage((tokens / totalTokens) * 100),
    };
  }).sort((left, right) => right.tokens - left.tokens);
}

function buildTokenAnalytics({
  instances,
  tasks,
  channels,
  agents,
  installedSkills,
  analyticsQuery,
  instanceSummaries,
}: TokenAnalyticsInput): DashboardTokenAnalytics {
  const activeSkillTasks = tasks.filter(
    (task) => task.status === 'active' && task.actionType === 'skill',
  ).length;
  const activeInstanceCount = instances.filter((instance) => instance.status === 'online').length;
  const enabledChannels = channels.filter((channel) => channel.enabled).length;
  const basePerBucket =
    analyticsQuery.granularity === 'hour'
      ? 340 + activeInstanceCount * 120 + activeSkillTasks * 68 + installedSkills.length * 18 + agents.length * 12 + enabledChannels * 26
      : 9800 + activeInstanceCount * 2600 + activeSkillTasks * 1200 + installedSkills.length * 240 + agents.length * 180 + enabledChannels * 410;

  const modelBreakdownSeed = buildModelBreakdown(
    Math.max(basePerBucket * analyticsQuery.bucketCount, 1),
    tasks,
    installedSkills,
    channels,
  );
  const totalModelWeight = modelBreakdownSeed.reduce((sum, row) => sum + row.tokens, 0);
  const weightedActualRate = modelBreakdownSeed.reduce((sum, row) => {
    const profile = MODEL_PROFILES.find((item) => item.id === row.id);
    return sum + (profile ? profile.actualRate * (row.tokens / totalModelWeight) : 0);
  }, 0);
  const weightedStandardRate = modelBreakdownSeed.reduce((sum, row) => {
    const profile = MODEL_PROFILES.find((item) => item.id === row.id);
    return sum + (profile ? profile.standardRate * (row.tokens / totalModelWeight) : 0);
  }, 0);

  const usageTrend = analyticsQuery.bucketDates.map((bucketDate, index) => {
    const hour = bucketDate.getUTCHours();
    const dayOfWeek = bucketDate.getUTCDay();
    const dayFactor = [0.84, 0.92, 1.01, 1.08, 1.15, 0.96, 0.78][dayOfWeek];
    const hourFactor =
      analyticsQuery.granularity === 'hour'
        ? 0.72 +
          (hour >= 9 && hour <= 18 ? 0.28 : 0.08) +
          Math.sin((index + 2) / 6) * 0.08
        : 1;
    const totalTokens = Math.max(
      analyticsQuery.granularity === 'hour' ? 240 : 5400,
      Math.round(basePerBucket * dayFactor * hourFactor),
    );
    const rawRatios = [
      0.44 + Math.sin((index + 1) / 5) * 0.025 + activeSkillTasks * 0.004,
      0.24 + Math.cos((index + 2) / 6) * 0.018 + enabledChannels * 0.003,
      0.12 + Math.sin((index + 3) / 8) * 0.01,
      0.2 + Math.cos((index + 4) / 7) * 0.015 + Math.max(0, installedSkills.length - 3) * 0.002,
    ];
    const ratioTotal = rawRatios.reduce((sum, value) => sum + value, 0);
    const [inputRatio, outputRatio, cacheCreationRatio, cacheReadRatio] = rawRatios.map((value) => {
      return value / ratioTotal;
    });
    const inputTokens = Math.round(totalTokens * inputRatio);
    const outputTokens = Math.round(totalTokens * outputRatio);
    const cacheCreationTokens = Math.round(totalTokens * cacheCreationRatio);
    const cacheReadTokens =
      totalTokens - inputTokens - outputTokens - cacheCreationTokens;

    return {
      label:
        analyticsQuery.granularity === 'day'
          ? `${`${bucketDate.getUTCMonth() + 1}`.padStart(2, '0')}-${`${bucketDate.getUTCDate()}`.padStart(2, '0')}`
          : `${`${bucketDate.getUTCMonth() + 1}`.padStart(2, '0')}-${`${bucketDate.getUTCDate()}`.padStart(2, '0')} ${`${bucketDate.getUTCHours()}`.padStart(2, '0')}:00`,
      bucketKey:
        analyticsQuery.granularity === 'day'
          ? formatDayKey(bucketDate)
          : `${formatDayKey(bucketDate)}T${`${bucketDate.getUTCHours()}`.padStart(2, '0')}:00`,
      totalTokens,
      inputTokens,
      outputTokens,
      cacheCreationTokens,
      cacheReadTokens,
      actualAmount: calculateAmount(totalTokens, weightedActualRate),
      standardAmount: calculateAmount(totalTokens, weightedStandardRate),
    } satisfies DashboardTokenTrendPoint;
  });

  const totalTokens = usageTrend.reduce((sum, point) => sum + point.totalTokens, 0);
  const inputTokens = usageTrend.reduce((sum, point) => sum + point.inputTokens, 0);
  const outputTokens = usageTrend.reduce((sum, point) => sum + point.outputTokens, 0);
  const cacheCreationTokens = usageTrend.reduce((sum, point) => sum + point.cacheCreationTokens, 0);
  const cacheReadTokens = usageTrend.reduce((sum, point) => sum + point.cacheReadTokens, 0);
  const actualAmount = roundCurrency(usageTrend.reduce((sum, point) => sum + point.actualAmount, 0));
  const standardAmount = roundCurrency(
    usageTrend.reduce((sum, point) => sum + point.standardAmount, 0),
  );
  const projectedFactor =
    analyticsQuery.rangeMode === 'month'
      ? 1
      : analyticsQuery.granularity === 'day'
        ? 30 / analyticsQuery.bucketCount
        : (30 * 24) / analyticsQuery.bucketCount;
  const estimatedRunCount = calculateEstimatedRuns(tasks, activeInstanceCount, analyticsQuery.bucketCount);
  const peakPoint = usageTrend.reduce((currentPeak, point) => {
    return point.totalTokens > currentPeak.totalTokens ? point : currentPeak;
  }, usageTrend[0]);
  const refreshedModelBreakdown = buildModelBreakdown(totalTokens, tasks, installedSkills, channels);
  const instanceWeights = instanceSummaries.map((summary) =>
    calculateInstanceBaseWeight(summary, agents),
  );
  const instanceTokenDistribution = distributeTotal(totalTokens, instanceWeights);
  const instanceBreakdown = instanceSummaries
    .map((summary, index) => {
      const tokens = instanceTokenDistribution[index];

      return {
        instanceId: summary.instance.id,
        name: summary.instance.name,
        status: summary.instance.status,
        tokens,
        estimatedSpend: calculateAmount(tokens, weightedActualRate),
        share: totalTokens === 0 ? 0 : roundPercentage((tokens / totalTokens) * 100),
        readinessScore: summary.readinessScore,
      } satisfies DashboardTokenInstanceBreakdown;
    })
    .sort((left, right) => right.tokens - left.tokens);

  return {
    granularity: analyticsQuery.granularity,
    rangeMode: analyticsQuery.rangeMode,
    selectedMonthKey: analyticsQuery.selectedMonthKey,
    customRange: analyticsQuery.customRange,
    totalTokens,
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    inputShare: roundPercentage((inputTokens / totalTokens) * 100),
    outputShare: roundPercentage((outputTokens / totalTokens) * 100),
    cacheCreationShare: roundPercentage((cacheCreationTokens / totalTokens) * 100),
    cacheReadShare: roundPercentage((cacheReadTokens / totalTokens) * 100),
    actualAmount,
    standardAmount,
    projectedMonthlyActualAmount: roundCurrency(actualAmount * projectedFactor),
    projectedMonthlyStandardAmount: roundCurrency(standardAmount * projectedFactor),
    averageTokensPerRun: Math.round(totalTokens / estimatedRunCount),
    projectedMonthlyTokens: Math.round(totalTokens * projectedFactor),
    estimatedRunCount,
    totalRequestCount: refreshedModelBreakdown.reduce((sum, row) => sum + row.requestCount, 0),
    peakUsageLabel: peakPoint.label,
    peakUsageValue: peakPoint.totalTokens,
    deltaPercentage: calculateDeltaPercentage(usageTrend),
    usageTrend,
    modelBreakdown: refreshedModelBreakdown,
    instanceBreakdown,
  };
}

function buildRevenueAnalytics({
  instances,
  tasks,
  channels,
  agents,
  installedSkills,
  analyticsQuery,
  tokenAnalytics,
}: RevenueAnalyticsInput): DashboardRevenueAnalytics {
  const activeSkillTasks = tasks.filter(
    (task) => task.status === 'active' && task.actionType === 'skill',
  ).length;
  const activeInstanceCount = instances.filter((instance) => instance.status === 'online').length;
  const enabledChannels = channels.filter((channel) => channel.enabled).length;
  const averageRequestsPerBucket = Math.max(
    1,
    Math.round(tokenAnalytics.totalRequestCount / Math.max(analyticsQuery.bucketCount, 1)),
  );
  const baseRevenuePerBucket =
    analyticsQuery.granularity === 'hour'
      ? 180 +
        activeInstanceCount * 68 +
        enabledChannels * 54 +
        activeSkillTasks * 28 +
        installedSkills.length * 11 +
        agents.length * 17 +
        averageRequestsPerBucket * 2
      : 4100 +
        activeInstanceCount * 1450 +
        enabledChannels * 980 +
        activeSkillTasks * 560 +
        installedSkills.length * 140 +
        agents.length * 210 +
        averageRequestsPerBucket * 15;

  const revenueTrend = analyticsQuery.bucketDates.map((bucketDate, index) => {
    const hour = bucketDate.getUTCHours();
    const dayOfWeek = bucketDate.getUTCDay();
    const weekdayFactor = [0.78, 0.94, 1.03, 1.11, 1.19, 1.07, 0.85][dayOfWeek];
    const hourFactor =
      analyticsQuery.granularity === 'hour'
        ? 0.7 +
          (hour >= 9 && hour <= 21 ? 0.28 : 0.06) +
          Math.sin((index + 3) / 6) * 0.07
        : 1;
    const campaignFactor =
      1 +
      Math.max(0, enabledChannels - 1) * 0.035 +
      Math.max(0, activeSkillTasks - 1) * 0.02;
    const revenue = Math.max(
      analyticsQuery.granularity === 'hour' ? 92 : 1500,
      Math.round(baseRevenuePerBucket * weekdayFactor * hourFactor * campaignFactor),
    );
    const averageOrderBaseline =
      98 +
      enabledChannels * 4 +
      activeInstanceCount * 6 +
      Math.max(0, installedSkills.length - 2) * 3 +
      (dayOfWeek === 4 || dayOfWeek === 5 ? 12 : 0);
    const orders = Math.max(1, Math.round(revenue / averageOrderBaseline));

    return {
      label:
        analyticsQuery.granularity === 'day'
          ? `${`${bucketDate.getUTCMonth() + 1}`.padStart(2, '0')}-${`${bucketDate.getUTCDate()}`.padStart(2, '0')}`
          : `${`${bucketDate.getUTCMonth() + 1}`.padStart(2, '0')}-${`${bucketDate.getUTCDate()}`.padStart(2, '0')} ${`${bucketDate.getUTCHours()}`.padStart(2, '0')}:00`,
      bucketKey:
        analyticsQuery.granularity === 'day'
          ? formatDayKey(bucketDate)
          : `${formatDayKey(bucketDate)}T${`${bucketDate.getUTCHours()}`.padStart(2, '0')}:00`,
      revenue,
      orders,
      averageOrderValue: roundCurrency(revenue / orders),
    } satisfies DashboardRevenueTrendPoint;
  });

  const totalRevenue = revenueTrend.reduce((sum, point) => sum + point.revenue, 0);
  const totalOrders = revenueTrend.reduce((sum, point) => sum + point.orders, 0);
  const windowDayCount = calculateWindowDayCount(analyticsQuery);
  const projectedFactor =
    analyticsQuery.rangeMode === 'month' ? 1 : 30 / Math.max(windowDayCount, 1);
  const productWeights = PRODUCT_PROFILES.map((profile, index) => {
    if (profile.id === 'memberships') {
      return profile.weight * (1 + Math.max(0, activeSkillTasks - 1) * 0.05);
    }
    if (profile.id === 'apiPackages') {
      return profile.weight * (1 + enabledChannels * 0.04);
    }
    if (profile.id === 'extensionMarket') {
      return profile.weight * (1 + Math.max(0, installedSkills.length - 3) * 0.03);
    }
    if (profile.id === 'enterpriseServices') {
      return profile.weight * (1 + Math.max(0, activeInstanceCount - 1) * 0.06);
    }

    return profile.weight * (1 + index * 0.015);
  });
  const revenueDistribution = distributeTotal(totalRevenue, productWeights);
  const orderWeights = PRODUCT_PROFILES.map((profile, index) => {
    return profile.weight * (profile.id === 'digitalGoods' ? 1.2 : 1 + index * 0.03);
  });
  const orderDistribution = distributeTotal(totalOrders, orderWeights);
  const productBreakdown = PRODUCT_PROFILES.map((profile, index) => {
    const revenue = revenueDistribution[index];
    const orders = Math.max(1, orderDistribution[index]);

    return {
      id: profile.id,
      orders,
      revenue,
      share: totalRevenue === 0 ? 0 : roundPercentage((revenue / totalRevenue) * 100),
      dailyRevenue: roundCurrency(revenue / windowDayCount),
    } satisfies DashboardRevenueProductBreakdown;
  }).sort((left, right) => right.revenue - left.revenue);
  const peakPoint = revenueTrend.reduce((currentPeak, point) => {
    return point.revenue > currentPeak.revenue ? point : currentPeak;
  }, revenueTrend[0]);

  return {
    granularity: analyticsQuery.granularity,
    rangeMode: analyticsQuery.rangeMode,
    selectedMonthKey: analyticsQuery.selectedMonthKey,
    customRange: analyticsQuery.customRange,
    totalRevenue,
    dailyRevenue: roundCurrency(totalRevenue / windowDayCount),
    projectedMonthlyRevenue: roundCurrency(totalRevenue * projectedFactor),
    totalOrders,
    averageOrderValue: roundCurrency(totalRevenue / Math.max(totalOrders, 1)),
    peakRevenueLabel: peakPoint.label,
    peakRevenueValue: peakPoint.revenue,
    deltaPercentage: calculateValueDeltaPercentage(
      revenueTrend.map((point) => point.revenue),
    ),
    revenueTrend,
    productBreakdown,
  };
}

function buildTokenSummary(
  tokenAnalytics: DashboardTokenAnalytics,
  analyticsQuery: ResolvedAnalyticsQuery,
): DashboardTokenSummary {
  const windowDayCount = calculateWindowDayCount(analyticsQuery);
  const dailyRequestCount = Math.max(
    1,
    Math.round(tokenAnalytics.totalRequestCount / Math.max(windowDayCount, 1)),
  );
  const dailyTokenCount = Math.max(
    1,
    Math.round(tokenAnalytics.totalTokens / Math.max(windowDayCount, 1)),
  );
  const dailySpend = roundCurrency(
    tokenAnalytics.actualAmount / Math.max(windowDayCount, 1),
  );

  return {
    dailyRequestCount,
    dailyTokenCount,
    dailySpend,
    weeklyRequestCount: Math.round(dailyRequestCount * 7),
    weeklyTokenCount: Math.round(dailyTokenCount * 7),
    weeklySpend: roundCurrency(dailySpend * 7),
    monthlyRequestCount: Math.max(1, Math.round(tokenAnalytics.projectedMonthlyTokens / Math.max(tokenAnalytics.averageTokensPerRun, 1))),
    monthlyTokenCount: tokenAnalytics.projectedMonthlyTokens,
    monthlySpend: tokenAnalytics.projectedMonthlyActualAmount,
    yearlyRequestCount: Math.max(
      1,
      Math.round(
        (tokenAnalytics.projectedMonthlyTokens * 12) /
          Math.max(tokenAnalytics.averageTokensPerRun, 1),
      ),
    ),
    yearlyTokenCount: Math.round(tokenAnalytics.projectedMonthlyTokens * 12),
    yearlySpend: roundCurrency(tokenAnalytics.projectedMonthlyActualAmount * 12),
    usageDelta: tokenAnalytics.deltaPercentage,
  };
}

function buildBusinessSummary(
  revenueAnalytics: DashboardRevenueAnalytics,
  tokenSummary: DashboardTokenSummary,
): DashboardBusinessSummary {
  const todayRevenue = revenueAnalytics.dailyRevenue;
  const weekRevenue = roundCurrency(todayRevenue * 7);
  const monthRevenue = revenueAnalytics.projectedMonthlyRevenue;
  const yearRevenue = roundCurrency(monthRevenue * 12);
  const todayOrders = Math.max(
    1,
    Math.round(todayRevenue / Math.max(revenueAnalytics.averageOrderValue, 1)),
  );
  const weekOrders = Math.max(1, Math.round(weekRevenue / Math.max(revenueAnalytics.averageOrderValue, 1)));
  const monthOrders = Math.max(
    1,
    Math.round(monthRevenue / Math.max(revenueAnalytics.averageOrderValue, 1)),
  );
  const yearOrders = Math.max(1, Math.round(yearRevenue / Math.max(revenueAnalytics.averageOrderValue, 1)));
  const conversionRate = roundPercentage(
    Math.min(100, (todayOrders / Math.max(tokenSummary.dailyRequestCount, 1)) * 100),
  );

  return {
    todayRevenue,
    weekRevenue,
    monthRevenue,
    yearRevenue,
    todayOrders,
    weekOrders,
    monthOrders,
    yearOrders,
    averageOrderValue: revenueAnalytics.averageOrderValue,
    conversionRate,
    revenueDelta: revenueAnalytics.deltaPercentage,
  };
}

function buildRecentApiCalls(
  tokenAnalytics: DashboardTokenAnalytics,
): DashboardApiCallRecord[] {
  const endpoints = ['/v1/chat/completions', '/v1/responses', '/v1/messages'];

  return tokenAnalytics.modelBreakdown.flatMap((row, rowIndex) => {
    return Array.from({ length: 2 }, (_, recordIndex) => {
      const requestCount = Math.max(
        1,
        Math.round(row.requestCount / (recordIndex === 0 ? 6 : 9)),
      );
      const tokenCount = Math.max(1, Math.round(row.tokens / (recordIndex === 0 ? 14 : 19)));
      const costAmount = roundCurrency(row.actualAmount / (recordIndex === 0 ? 5 : 7));
      const offsetMinutes = rowIndex * 95 + recordIndex * 37;
      const status = rowIndex % 4 === 3 && recordIndex === 1 ? 'failed' : 'success';

      return {
        id: `${row.id}-${recordIndex}`,
        timestamp: buildRecentTimestamp(offsetMinutes),
        modelName: row.modelName,
        providerName: toProviderName(row.modelName),
        endpoint: endpoints[(rowIndex + recordIndex) % endpoints.length]!,
        requestCount,
        tokenCount,
        costAmount,
        latencyMs: 420 + rowIndex * 68 + recordIndex * 34,
        status,
      } satisfies DashboardApiCallRecord;
    });
  }).sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}

function buildRecentRevenueRecords(
  revenueAnalytics: DashboardRevenueAnalytics,
): DashboardRevenueRecord[] {
  const channels = ['web', 'partner', 'direct'];

  return revenueAnalytics.productBreakdown.flatMap((row, rowIndex) => {
    return Array.from({ length: 2 }, (_, recordIndex) => {
      const revenueAmount = roundCurrency(row.revenue / (recordIndex === 0 ? 5 : 8));
      const status: DashboardRevenueRecord['status'] =
        rowIndex === 2 && recordIndex === 1
          ? 'pending'
          : rowIndex === 4 && recordIndex === 1
            ? 'refunded'
            : 'paid';

      return {
        id: `${row.id}-${recordIndex}`,
        timestamp: buildRecentTimestamp(rowIndex * 126 + recordIndex * 58),
        productName: toDisplayProductName(row.id),
        orderNo: `ORD-20260319-${`${rowIndex * 2 + recordIndex + 1012}`.padStart(4, '0')}`,
        revenueAmount,
        channel: channels[(rowIndex + recordIndex) % channels.length]!,
        status,
      } satisfies DashboardRevenueRecord;
    });
  }).sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}

function buildProductPerformance(
  revenueAnalytics: DashboardRevenueAnalytics,
): DashboardProductPerformanceRow[] {
  return revenueAnalytics.productBreakdown.map((row, index) => ({
    id: row.id,
    productName: toDisplayProductName(row.id),
    revenue: row.revenue,
    orders: row.orders,
    share: row.share,
    trendDelta: roundPercentage(revenueAnalytics.deltaPercentage - index * 1.8 + 3.2),
  }));
}

function buildAlerts(
  tokenSummary: DashboardTokenSummary,
  businessSummary: DashboardBusinessSummary,
  tokenAnalytics: DashboardTokenAnalytics,
  revenueAnalytics: DashboardRevenueAnalytics,
): DashboardAlertItem[] {
  const alerts: DashboardAlertItem[] = [];
  const topModel = tokenAnalytics.modelBreakdown[0];
  const topProduct = revenueAnalytics.productBreakdown[0];

  if (topModel) {
    alerts.push({
      id: 'model-cost-spike',
      severity: tokenSummary.usageDelta > 12 ? 'warning' : 'info',
      title: `${topModel.modelName} cost share is leading`,
      description: `${topModel.modelName} carries the largest current model cost share. Watch the mix before spend concentration grows.`,
      value: `${topModel.share}%`,
    });
  }

  if (topProduct) {
    alerts.push({
      id: 'revenue-concentration',
      severity: topProduct.share >= 36 ? 'warning' : 'info',
      title: `${toDisplayProductName(topProduct.id)} drives the largest revenue share`,
      description: `Revenue is currently concentrated in ${toDisplayProductName(topProduct.id)}. Keep diversification visible as volume scales.`,
      value: `${topProduct.share}%`,
    });
  }

  alerts.push({
    id: 'daily-spend',
    severity: tokenSummary.dailySpend >= 180 ? 'critical' : 'warning',
    title: 'Daily spend is elevated',
    description: 'Daily model spend is climbing with request volume. Keep an eye on high-cost model routing during peak windows.',
    value: `$${tokenSummary.dailySpend.toFixed(2)}`,
  });

  alerts.push({
    id: 'conversion',
    severity: businessSummary.conversionRate >= 12 ? 'info' : 'warning',
    title: 'Conversion efficiency is the next lever',
    description: 'Revenue is healthy, but call-to-order conversion is still the clearest path to higher business yield.',
    value: `${businessSummary.conversionRate}%`,
  });

  return alerts;
}

function buildActivityFeed(
  tokenAnalytics: DashboardTokenAnalytics,
  revenueAnalytics: DashboardRevenueAnalytics,
  tokenSummary: DashboardTokenSummary,
  businessSummary: DashboardBusinessSummary,
): DashboardActivityFeed {
  return {
    recentApiCalls: buildRecentApiCalls(tokenAnalytics).slice(0, 10),
    recentRevenueRecords: buildRecentRevenueRecords(revenueAnalytics).slice(0, 10),
    productPerformance: buildProductPerformance(revenueAnalytics),
    alerts: buildAlerts(tokenSummary, businessSummary, tokenAnalytics, revenueAnalytics),
  };
}

function buildRecommendations({
  instances,
  tasks,
  channels,
  installedSkills,
  healthScore,
  capabilityCoverageScore,
}: CapabilityCoverageScoreInput & { healthScore: number; capabilityCoverageScore: number }) {
  const recommendations: DashboardRecommendation[] = [];

  if (instances.some((instance) => instance.status !== 'online')) {
    recommendations.push({
      id: 'stabilize-instances',
      severity: 'critical',
      titleKey: 'dashboard.recommendations.items.stabilizeInstances.title',
      descriptionKey: 'dashboard.recommendations.items.stabilizeInstances.description',
      actionLabelKey: 'dashboard.recommendations.items.stabilizeInstances.action',
      actionPath: '/instances',
    });
  }

  if (channels.filter((channel) => channel.status === 'connected' && channel.enabled).length === 0) {
    recommendations.push({
      id: 'connect-delivery',
      severity: 'warning',
      titleKey: 'dashboard.recommendations.items.connectDelivery.title',
      descriptionKey: 'dashboard.recommendations.items.connectDelivery.description',
      actionLabelKey: 'dashboard.recommendations.items.connectDelivery.action',
      actionPath: '/channels',
    });
  }

  if (installedSkills.length < 3) {
    recommendations.push({
      id: 'expand-capabilities',
      severity: 'info',
      titleKey: 'dashboard.recommendations.items.expandCapabilities.title',
      descriptionKey: 'dashboard.recommendations.items.expandCapabilities.description',
      actionLabelKey: 'dashboard.recommendations.items.expandCapabilities.action',
      actionPath: '/market',
    });
  }

  if (tasks.some((task) => task.status === 'failed')) {
    recommendations.push({
      id: 'repair-automations',
      severity: 'warning',
      titleKey: 'dashboard.recommendations.items.repairAutomations.title',
      descriptionKey: 'dashboard.recommendations.items.repairAutomations.description',
      actionLabelKey: 'dashboard.recommendations.items.repairAutomations.action',
      actionPath: '/tasks',
    });
  }

  if (healthScore >= 80 && capabilityCoverageScore >= 75) {
    recommendations.push({
      id: 'scale-operators',
      severity: 'info',
      titleKey: 'dashboard.recommendations.items.scaleOperators.title',
      descriptionKey: 'dashboard.recommendations.items.scaleOperators.description',
      actionLabelKey: 'dashboard.recommendations.items.scaleOperators.action',
      actionPath: '/chat',
    });
  }

  return recommendations.slice(0, 4);
}

class DashboardService {
  async getSnapshot(analyticsQuery: DashboardAnalyticsQuery = {}): Promise<DashboardSnapshot> {
    const resolvedAnalyticsQuery = resolveAnalyticsQuery(analyticsQuery);
    const instances = await studioMockService.listInstances();
    const agents = await studioMockService.listAgents();

    const instanceSummaries = await Promise.all(
      instances.map(async (instance) => {
        const instanceTasks = uniqueById(await studioMockService.listTasks(instance.id));
        const instanceChannels = uniqueById(await studioMockService.listChannels(instance.id));
        const installedSkills = uniqueById(await studioMockService.listInstalledSkills(instance.id));

        return {
          instance,
          readinessScore: calculateInstanceReadinessScore(
            instance,
            instanceTasks,
            instanceChannels,
            installedSkills,
          ),
          activeTaskCount: instanceTasks.filter((task) => task.status === 'active').length,
          failedTaskCount: instanceTasks.filter((task) => task.status === 'failed').length,
          connectedChannelCount: instanceChannels.filter(
            (channel) => channel.status === 'connected' && channel.enabled,
          ).length,
          installedSkillCount: installedSkills.length,
        } satisfies DashboardInstanceSummary;
      }),
    );

    const tasks = uniqueById(
      (
        await Promise.all(instances.map((instance) => studioMockService.listTasks(instance.id)))
      ).flat(),
    );
    const channels = uniqueById(
      (
        await Promise.all(instances.map((instance) => studioMockService.listChannels(instance.id)))
      ).flat(),
    );
    const installedSkills = uniqueById(
      (
        await Promise.all(
          instances.map((instance) => studioMockService.listInstalledSkills(instance.id)),
        )
      ).flat(),
    );

    const healthScore = calculateWorkspaceHealthScore({ instances, tasks, channels });
    const capabilityCoverageScore = calculateCapabilityCoverageScore({
      instances,
      tasks,
      channels,
      agents,
      installedSkills,
    });
    const tokenAnalytics = buildTokenAnalytics({
      instances,
      tasks,
      channels,
      agents,
      installedSkills,
      analyticsQuery: resolvedAnalyticsQuery,
      instanceSummaries,
    });
    const revenueAnalytics = buildRevenueAnalytics({
      instances,
      tasks,
      channels,
      agents,
      installedSkills,
      analyticsQuery: resolvedAnalyticsQuery,
      tokenAnalytics,
    });
    const tokenSummary = buildTokenSummary(tokenAnalytics, resolvedAnalyticsQuery);
    const businessSummary = buildBusinessSummary(revenueAnalytics, tokenSummary);
    const activityFeed = buildActivityFeed(
      tokenAnalytics,
      revenueAnalytics,
      tokenSummary,
      businessSummary,
    );
    const recommendations = buildRecommendations({
      instances,
      tasks,
      channels,
      agents,
      installedSkills,
      healthScore,
      capabilityCoverageScore,
    });

    return {
      healthScore,
      capabilityCoverageScore,
      activeInstanceCount: instances.filter((instance) => instance.status === 'online').length,
      totalInstanceCount: instances.length,
      activeAutomationCount: tasks.filter((task) => task.status === 'active').length,
      pausedAutomationCount: tasks.filter((task) => task.status === 'paused').length,
      failedAutomationCount: tasks.filter((task) => task.status === 'failed').length,
      connectedChannelCount: channels.filter(
        (channel) => channel.status === 'connected' && channel.enabled,
      ).length,
      totalChannelCount: channels.length,
      installedSkillCount: installedSkills.length,
      businessSummary,
      tokenSummary,
      tokenAnalytics,
      revenueAnalytics,
      activityFeed,
      instances: instanceSummaries.sort((left, right) => right.readinessScore - left.readinessScore),
      agents: agents
        .map((agent) => buildAgentSummary(agent, tasks, channels, installedSkills))
        .sort((left, right) => right.coverageScore - left.coverageScore),
      tasks: tasks.sort((left, right) => left.name.localeCompare(right.name)),
      channels: channels.sort((left, right) => left.name.localeCompare(right.name)),
      installedSkills: installedSkills.sort((left, right) => left.name.localeCompare(right.name)),
      recommendations,
    };
  }
}

export const dashboardService = new DashboardService();
