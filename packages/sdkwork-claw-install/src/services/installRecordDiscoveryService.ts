import type { LegacyInstallRecord, ProductId } from '../pages/install/installPageModel.ts';

type ProductInstallRecord = LegacyInstallRecord & {
  installedAt?: string | null;
  updatedAt?: string | null;
  status?: string | null;
};

function normalizeRecordValue(value?: string | null) {
  return value?.trim().toLowerCase() ?? '';
}

function matchesProductFamily(productId: ProductId, value?: string | null) {
  const normalized = normalizeRecordValue(value);
  return normalized === productId || normalized.startsWith(`${productId}-`);
}

function compareInstallRecords(left: ProductInstallRecord, right: ProductInstallRecord) {
  return (
    (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '') ||
    (right.installedAt ?? '').localeCompare(left.installedAt ?? '') ||
    normalizeRecordValue(left.softwareName).localeCompare(normalizeRecordValue(right.softwareName))
  );
}

export function shouldReadProductInstallRecordEntry(productId: ProductId, fileName: string) {
  const normalized = normalizeRecordValue(fileName);
  return normalized.endsWith('.json') && matchesProductFamily(productId, normalized.replace(/\.json$/, ''));
}

export function selectProductInstallRecord<T extends ProductInstallRecord>(
  productId: ProductId,
  records: Array<T | null | undefined>,
): T | null {
  const matches = records
    .filter((record): record is T => Boolean(record))
    .filter((record) => normalizeRecordValue(record.status) !== 'uninstalled')
    .filter(
      (record) =>
        matchesProductFamily(productId, record.softwareName) ||
        matchesProductFamily(productId, record.manifestName),
    )
    .sort(compareInstallRecords);

  return matches[0] ?? null;
}
