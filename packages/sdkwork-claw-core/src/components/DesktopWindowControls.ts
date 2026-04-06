import { Suspense, createElement, lazy } from 'react';

export interface DesktopWindowControlsProps {
  variant?: 'header' | 'floating';
  className?: string;
}

const LazyDesktopWindowControls = lazy(async () => {
  const module = await import('./DesktopWindowControls.tsx');
  return { default: module.DesktopWindowControls };
});

export function DesktopWindowControls(props: DesktopWindowControlsProps) {
  // Keep the package-root export Node-compatible while preserving the browser component.
  return createElement(
    Suspense,
    { fallback: null },
    createElement(LazyDesktopWindowControls, props),
  );
}
