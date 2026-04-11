import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = process.cwd();
const packagesRoot = path.join(workspaceRoot, 'packages');
const skipDirectoryNames = new Set(['node_modules', 'dist', 'target', '.git', '.turbo', 'coverage']);
const sourceFilePattern = /\.(?:[cm]?ts|tsx)$/i;
const testFilePattern = /\.(?:test|spec)\.(?:[cm]?ts|tsx)$/i;
const testExportLinePattern = /^\s*export\s+\*\s+from\s+['"]\.\/[^'"]*\.test(?:\.[^'"]+)?['"]\s*;?\s*$/;

/**
 * @param {string} directory
 * @param {string[]} files
 */
function collectSourceFiles(directory, files) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (skipDirectoryNames.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(absolutePath, files);
      continue;
    }

    if (!sourceFilePattern.test(entry.name)) {
      continue;
    }

    if (testFilePattern.test(entry.name)) {
      continue;
    }

    files.push(absolutePath);
  }
}

/** @type {Array<{file: string; line: number; text: string}>} */
const violations = [];
/** @type {string[]} */
const sourceFiles = [];

collectSourceFiles(packagesRoot, sourceFiles);

for (const sourceFile of sourceFiles) {
  const relativePath = path.relative(workspaceRoot, sourceFile).replace(/\\/g, '/');
  const lines = fs.readFileSync(sourceFile, 'utf8').split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!testExportLinePattern.test(line)) {
      continue;
    }

    violations.push({
      file: relativePath,
      line: index + 1,
      text: line.trim(),
    });
  }
}

if (violations.length > 0) {
  console.error('not ok - runtime source files export test modules');
  for (const violation of violations) {
    console.error(`  ${violation.file}:${violation.line} ${violation.text}`);
  }
  process.exit(1);
}

console.log('ok - runtime source files do not export test modules');
