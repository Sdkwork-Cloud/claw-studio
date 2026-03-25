import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const shellRoutesPath = path.join(
  root,
  'packages',
  'sdkwork-claw-shell',
  'src',
  'application',
  'router',
  'AppRoutes.tsx',
);
const v5RoutesPath = path.join(root, 'upgrade', 'claw-studio-v5', 'src', 'App.tsx');

function read(relPath) {
  if (!fs.existsSync(relPath)) {
    console.error(`Missing route source: ${path.relative(root, relPath)}`);
    process.exit(1);
  }

  return fs.readFileSync(relPath, 'utf8');
}

function extractRoutes(source) {
  const routeMatches = source.matchAll(/path="([^"]+)"/g);
  return [...new Set([...routeMatches].map((match) => match[1]).filter(Boolean))].sort();
}

const shellRoutes = extractRoutes(read(shellRoutesPath));
const v5Routes = extractRoutes(read(v5RoutesPath));
const approvedTemplateExtensions = new Set([
  '/dashboard',
  '/model-purchase',
  '/points',
  '/agents',
  '/mall',
  '/mall/:id',
]);
const missingRoutes = v5Routes.filter((route) => !shellRoutes.includes(route));
const extraRoutes = shellRoutes.filter(
  (route) => !v5Routes.includes(route) && !approvedTemplateExtensions.has(route),
);

if (missingRoutes.length > 0 || extraRoutes.length > 0) {
  console.error('SDKWork Claw route surface check failed:');
  for (const route of missingRoutes) {
    console.error(`- Missing V5 route ${route} in ${path.relative(root, shellRoutesPath)}`);
  }
  for (const route of extraRoutes) {
    console.error(`- Extra non-V5 route ${route} in ${path.relative(root, shellRoutesPath)}`);
  }
  process.exit(1);
}

console.log(
  `SDKWork Claw route surface check passed. Approved template extensions: ${[
    ...approvedTemplateExtensions,
  ].join(', ')}`,
);
