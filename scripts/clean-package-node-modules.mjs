import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packagesDir = path.join(root, 'packages');
const removed = [];

function visit(dir) {
  if (!fs.existsSync(dir)) {
    return;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (!entry.isDirectory()) {
      continue;
    }

    if (entry.name === 'node_modules') {
      fs.rmSync(full, { recursive: true, force: true });
      removed.push(path.relative(root, full));
      continue;
    }

    visit(full);
  }
}

visit(packagesDir);

if (removed.length === 0) {
  console.log('No package node_modules directories found.');
} else {
  console.log(`Removed ${removed.length} package node_modules directories.`);
  for (const relPath of removed.sort()) {
    console.log(`- ${relPath}`);
  }
}
