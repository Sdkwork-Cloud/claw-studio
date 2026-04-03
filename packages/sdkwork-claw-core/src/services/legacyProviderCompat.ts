const LEGACY_PROVIDER_KEY_PREFIX = 'api-router-';

export { LEGACY_PROVIDER_KEY_PREFIX };

export function normalizeLegacyProviderId(providerId: string | undefined | null) {
  const normalized = (providerId || '').trim();
  if (!normalized) {
    return '';
  }

  return normalized.startsWith(LEGACY_PROVIDER_KEY_PREFIX)
    ? normalized.slice(LEGACY_PROVIDER_KEY_PREFIX.length)
    : normalized;
}

export function normalizeLegacyProviderModelRef(value: string | undefined | null) {
  const normalized = (value || '').trim();
  if (!normalized) {
    return '';
  }

  const slashIndex = normalized.indexOf('/');
  if (slashIndex <= 0 || slashIndex === normalized.length - 1) {
    return normalized;
  }

  return `${normalizeLegacyProviderId(normalized.slice(0, slashIndex))}/${normalized.slice(slashIndex + 1)}`;
}
