import type { AppCategory, AppInstallSurfaceSummary, AppItem } from '../../services';

export interface AppInstallSurfaceLookup {
  [appId: string]: AppInstallSurfaceSummary | undefined;
}

export interface AppStoreOverview {
  totalApps: number;
  totalCategories: number;
  installableApps: number;
  installedApps: number;
  readyApps: number;
  attentionApps: number;
}

export interface CatalogMetadataField {
  id: 'registry' | 'defaultSoftwareName' | 'selectedSoftwareName' | 'supportedHosts';
  value: string;
}

interface CatalogMetadataFieldInput {
  registryName?: string | null;
  defaultSoftwareName?: string | null;
  selectedSoftwareName?: string | null;
  supportedHostLabels?: string[];
}

function normalizeKeyword(keyword: string) {
  return keyword.trim().toLowerCase();
}

function matchesKeyword(value: string | undefined, keyword: string) {
  return value?.toLowerCase().includes(keyword) ?? false;
}

function matchesAppKeyword(app: AppItem, keyword: string) {
  if (!keyword) {
    return true;
  }

  return (
    matchesKeyword(app.name, keyword) ||
    matchesKeyword(app.developer, keyword) ||
    matchesKeyword(app.category, keyword) ||
    matchesKeyword(app.description, keyword) ||
    matchesKeyword(app.installSummary, keyword) ||
    app.installTags?.some((tag) => matchesKeyword(tag, keyword)) === true
  );
}

export function flattenCategoryApps(categories: AppCategory[]) {
  return categories.flatMap((category) => category.apps);
}

export function countAppsInCategories(categories: AppCategory[]) {
  return categories.reduce((total, category) => total + category.apps.length, 0);
}

export function filterCategoriesByKeyword(categories: AppCategory[], keyword: string) {
  const normalizedKeyword = normalizeKeyword(keyword);
  if (!normalizedKeyword) {
    return categories;
  }

  return categories
    .map((category) => ({
      ...category,
      apps: category.apps.filter((app) => matchesAppKeyword(app, normalizedKeyword)),
    }))
    .filter((category) => category.apps.length > 0);
}

export function collectInstallableAppIdsFromCategories(categories: AppCategory[]) {
  return [...new Set(flattenCategoryApps(categories).filter((app) => app.installable).map((app) => app.id))];
}

export function collectPriorityInstallableAppIds(categories: AppCategory[], limit = 6) {
  return collectInstallableAppIdsFromCategories(categories).slice(0, Math.max(limit, 0));
}

export function createStoreOverview(
  categories: AppCategory[],
  installSurfaceById: AppInstallSurfaceLookup = {},
): AppStoreOverview {
  const apps = flattenCategoryApps(categories);
  const installableApps = apps.filter((app) => app.installable);

  let installedApps = 0;
  let readyApps = 0;
  let attentionApps = 0;

  installableApps.forEach((app) => {
    const summary = installSurfaceById[app.id];
    if (!summary) {
      return;
    }

    if (summary.state === 'installed') {
      installedApps += 1;
      return;
    }

    if (summary.state === 'ready') {
      readyApps += 1;
      return;
    }

    attentionApps += 1;
  });

  return {
    totalApps: apps.length,
    totalCategories: categories.length,
    installableApps: installableApps.length,
    installedApps,
    readyApps,
    attentionApps,
  };
}

export function createCatalogMetadataFields({
  registryName,
  defaultSoftwareName,
  selectedSoftwareName,
  supportedHostLabels = [],
}: CatalogMetadataFieldInput): CatalogMetadataField[] {
  const fields: CatalogMetadataField[] = [];
  const normalizedSupportedHosts = [...new Set(supportedHostLabels.map((label) => label.trim()).filter(Boolean))];

  if (registryName?.trim()) {
    fields.push({
      id: 'registry',
      value: registryName.trim(),
    });
  }

  if (defaultSoftwareName?.trim()) {
    fields.push({
      id: 'defaultSoftwareName',
      value: defaultSoftwareName.trim(),
    });
  }

  if (selectedSoftwareName?.trim()) {
    fields.push({
      id: 'selectedSoftwareName',
      value: selectedSoftwareName.trim(),
    });
  }

  if (normalizedSupportedHosts.length > 0) {
    fields.push({
      id: 'supportedHosts',
      value: normalizedSupportedHosts.join(', '),
    });
  }

  return fields;
}
