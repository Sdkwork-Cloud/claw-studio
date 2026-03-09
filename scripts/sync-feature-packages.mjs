import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packagesDir = path.join(root, 'packages');

const allPackageDirs = fs
  .readdirSync(packagesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name.startsWith('claw-studio-'))
  .map((d) => d.name);

const shared = new Set([
  'claw-studio-web',
  'claw-studio-business',
  'claw-studio-domain',
  'claw-studio-infrastructure',
  'claw-studio-shared-ui',
]);

const featureDirs = allPackageDirs.filter((d) => !shared.has(d));
const knownVersions = {};
for (const dir of allPackageDirs) {
  const pkgPath = path.join(packagesDir, dir, 'package.json');
  if (!fs.existsSync(pkgPath)) continue;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const entries = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
    ...pkg.optionalDependencies,
  };

  for (const [name, version] of Object.entries(entries)) {
    if (typeof version !== 'string') continue;
    if (version.startsWith('workspace:')) continue;
    if (!knownVersions[name]) knownVersions[name] = version;
  }
}
const fallbackVersions = {
  '@types/react': '^19.2.2',
  '@types/react-dom': '^19.2.2',
};

function listSourceFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) out.push(...listSourceFiles(full));
    else if (/\.(ts|tsx)$/.test(item.name)) out.push(full);
  }
  return out;
}

function parseImports(file) {
  const text = fs.readFileSync(file, 'utf8');
  const out = [];
  const re = /from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(text))) {
    out.push(m[1] || m[2]);
  }
  return out;
}

function normalize(dep) {
  if (dep.startsWith('.') || dep.startsWith('/')) return null;
  if (dep.startsWith('@sdkwork/')) {
    const parts = dep.split('/');
    return `${parts[0]}/${parts[1]}`;
  }
  if (dep.startsWith('@tauri-apps/api/')) return '@tauri-apps/api';
  if (dep.startsWith('motion/')) return 'motion';
  if (dep.startsWith('react-syntax-highlighter/')) return 'react-syntax-highlighter';
  if (dep.startsWith('@tiptap/')) {
    const parts = dep.split('/');
    return `${parts[0]}/${parts[1]}`;
  }
  if (dep.startsWith('@tanstack/')) {
    const parts = dep.split('/');
    return `${parts[0]}/${parts[1]}`;
  }
  if (dep.startsWith('@types/')) {
    const parts = dep.split('/');
    return `${parts[0]}/${parts[1]}`;
  }
  return dep.split('/')[0];
}

function writeIndex(file, exportsList) {
  if (exportsList.length === 0) {
    fs.writeFileSync(file, 'export {};\n');
    return;
  }
  const unique = [...new Set(exportsList)].sort();
  fs.writeFileSync(file, unique.map((e) => `export * from '${e}';`).join('\n') + '\n');
}

for (const dir of featureDirs) {
  const pkgPath = path.join(packagesDir, dir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const srcDir = path.join(packagesDir, dir, 'src');
  const files = listSourceFiles(srcDir);

  const deps = new Set();
  for (const file of files) {
    for (const imp of parseImports(file)) {
      const n = normalize(imp);
      if (n) deps.add(n);
    }
  }

  deps.add('@types/react');
  deps.add('@types/react-dom');

  const depObj = {};
  for (const d of [...deps].sort()) {
    if (d.startsWith('@sdkwork/')) depObj[d] = 'workspace:*';
    else if (knownVersions[d]) depObj[d] = knownVersions[d];
    else if (fallbackVersions[d]) depObj[d] = fallbackVersions[d];
  }
  pkg.dependencies = depObj;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  const moduleName = dir.replace('claw-studio-', '');
  const pagesDir = path.join(srcDir, 'pages', moduleName);
  const pageExports = fs.existsSync(pagesDir)
    ? fs
        .readdirSync(pagesDir)
        .filter((f) => f.endsWith('.tsx'))
        .map((f) => `./pages/${moduleName}/${f.replace(/\.tsx$/, '')}`)
    : [];

  const componentsDir = path.join(srcDir, 'components');
  const componentExports = [];
  if (fs.existsSync(componentsDir)) {
    for (const file of listSourceFiles(componentsDir)) {
      if (file.endsWith('index.ts') || file.endsWith('index.tsx')) continue;
      const rel = path
        .relative(componentsDir, file)
        .replace(/\\/g, '/')
        .replace(/\.(ts|tsx)$/, '');
      componentExports.push(`./${rel}`);
    }
  }

  const servicesDir = path.join(srcDir, 'services');
  const serviceExports = [];
  if (fs.existsSync(servicesDir)) {
    for (const f of fs.readdirSync(servicesDir)) {
      if (f === 'index.ts' || !f.endsWith('.ts')) continue;
      serviceExports.push(`./${f.replace(/\.ts$/, '')}`);
    }
  }

  writeIndex(path.join(srcDir, 'components', 'index.ts'), componentExports);
  writeIndex(path.join(srcDir, 'services', 'index.ts'), serviceExports);
  writeIndex(path.join(srcDir, 'index.ts'), pageExports);
}

console.log('Feature package dependencies and index exports synchronized.');
