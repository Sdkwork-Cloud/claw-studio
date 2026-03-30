export type PointsPageView = 'membership' | 'wallet';

export function resolvePointsPageView(view: string | null | undefined): PointsPageView {
  const normalized = (view || '').trim().toLowerCase();
  if (normalized === 'membership') {
    return 'membership';
  }
  return 'wallet';
}
