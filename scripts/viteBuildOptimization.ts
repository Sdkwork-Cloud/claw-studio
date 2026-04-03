function normalizePath(filePath: string) {
  return filePath.replace(/\\/g, '/');
}

function resolveDirectory(filePath: string) {
  return normalizePath(filePath).replace(/\/[^/]+$/, '');
}

function isWithinDirectory(filePath: string, directoryPath: string) {
  return filePath === directoryPath || filePath.startsWith(`${directoryPath}/`);
}

const reactVendorPattern = /\/node_modules\/(?:react(?:\/|$)|react-dom(?:\/|$)|scheduler(?:\/|$))/;
const appRouterPattern = /\/node_modules\/(?:react-router-dom(?:\/|$)|react-router(?:\/|$))/;
const appStatePattern = /\/node_modules\/(?:@tanstack\/react-query(?:\/|$)|@tanstack\/query-core(?:\/|$)|zustand(?:\/|$))/;
const appUiPattern = /\/node_modules\/(?:i18next(?:\/|$)|react-i18next(?:\/|$)|sonner(?:\/|$)|motion(?:\/|$)|@radix-ui\/react-[^/]+(?:\/|$))/;
const communityEditorPattern = /\/node_modules\/(?:@tiptap|prosemirror-|prosemirror\/)/;
const markdownRuntimePattern = /\/node_modules\/(?:react-markdown|remark-gfm|remark-parse|remark-rehype|rehype-raw|unified|mdast-util-|micromark|hast-util-|parse5|property-information|space-separated-tokens|comma-separated-tokens|web-namespaces|react-syntax-highlighter|refractor|prismjs)/;

export const CLAW_VITE_DEDUPE_PACKAGES = [
  'react',
  'react-dom',
  '@sdkwork/claw-infrastructure',
  '@sdkwork/claw-i18n',
  '@sdkwork/sdk-common',
] as const;

export function createClawManualChunks(sharedAppSdkEntry: string) {
  const normalizedSharedAppSdkEntry = normalizePath(sharedAppSdkEntry);
  const normalizedSharedAppSdkRoot = resolveDirectory(normalizedSharedAppSdkEntry);

  return function manualChunks(id: string) {
    const normalizedId = normalizePath(id);

    if (normalizedId.includes('/packages/sdkwork-claw-infrastructure/src/')) {
      return 'claw-infrastructure';
    }

    if (isWithinDirectory(normalizedId, normalizedSharedAppSdkRoot)) {
      return 'sdkwork-app-sdk';
    }

    if (reactVendorPattern.test(normalizedId)) {
      return 'react-vendor';
    }

    if (appRouterPattern.test(normalizedId)) {
      return 'app-router';
    }

    if (appStatePattern.test(normalizedId)) {
      return 'app-state';
    }

    if (appUiPattern.test(normalizedId)) {
      return 'app-ui';
    }

    if (communityEditorPattern.test(normalizedId)) {
      return 'community-editor';
    }

    if (markdownRuntimePattern.test(normalizedId)) {
      return 'markdown-runtime';
    }

    return undefined;
  };
}

export function resolveClawModulePreloadDependencies(
  deps: string[],
  context: { hostType: string },
) {
  if (context.hostType !== 'html') {
    return deps;
  }

  return deps.filter((dependency) => (
    !dependency.includes('community-editor') &&
    !dependency.includes('markdown-runtime')
  ));
}
