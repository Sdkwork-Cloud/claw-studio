import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRootDir = path.resolve(__dirname, '..', '..');
const defaultReleaseDocsDir = path.resolve(workspaceRootDir, 'docs', 'release');

function printHelp() {
  console.log(`Usage: node scripts/release/render-release-notes.mjs --release-tag <tag> [--docs-dir <dir>] [--output <file>]

Render GitHub release notes from repository-owned documents under docs/release.

Options:
  --release-tag <tag>   Required release tag, for example release-2026-04-07-03
  --docs-dir <dir>      Override the release docs directory (default: docs/release)
  --output <file>       Write rendered notes to a file instead of stdout
  --help                Show this help message
`);
}

function parseArgs(argv) {
  const options = {
    releaseTag: '',
    docsDir: defaultReleaseDocsDir,
    output: '',
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }

    if (argument === '--release-tag' || argument === '--docs-dir' || argument === '--output') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for ${argument}.`);
      }

      if (argument === '--release-tag') {
        options.releaseTag = value.trim();
      } else if (argument === '--docs-dir') {
        options.docsDir = path.resolve(process.cwd(), value);
      } else {
        options.output = path.resolve(process.cwd(), value);
      }

      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

function readReleaseRegistry(docsDir) {
  const registryPath = path.join(docsDir, 'releases.json');
  if (!fs.existsSync(registryPath)) {
    throw new Error(`Missing release registry at ${registryPath}.`);
  }

  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  if (!Array.isArray(registry?.releases)) {
    throw new Error(`Invalid release registry at ${registryPath}: missing releases array.`);
  }

  return {
    registryPath,
    releases: registry.releases,
  };
}

function findReleaseEntry(releases, releaseTag) {
  const entry = releases.find((candidate) => candidate?.tag === releaseTag);
  if (!entry) {
    throw new Error(`No release document metadata found for ${releaseTag}.`);
  }

  if (typeof entry.notesFile !== 'string' || entry.notesFile.trim() === '') {
    throw new Error(`Release ${releaseTag} is missing notesFile metadata.`);
  }

  return entry;
}

function readReleaseNotesMarkdown(entry, docsDir) {
  const notesPath = path.join(docsDir, entry.notesFile);
  if (!fs.existsSync(notesPath)) {
    throw new Error(`Missing release notes file for ${entry.tag}: ${notesPath}.`);
  }

  return fs.readFileSync(notesPath, 'utf8').trim();
}

function renderReleaseNotes({ releaseTag, docsDir = defaultReleaseDocsDir }) {
  const { releases } = readReleaseRegistry(docsDir);
  const entry = findReleaseEntry(releases, releaseTag);
  const carriedForwardEntries = Array.isArray(entry.carryForward)
    ? entry.carryForward.map((tag) => findReleaseEntry(releases, tag))
    : [];

  const sections = [
    `# ${entry.title || entry.tag}`,
    '',
    `- Tag: \`${entry.tag}\``,
    `- Date: ${entry.date || 'Unknown'}`,
    `- Status: ${entry.status || 'pending'}`,
  ];

  if (typeof entry.summary === 'string' && entry.summary.trim().length > 0) {
    sections.push(`- Summary: ${entry.summary.trim()}`);
  }

  sections.push('', readReleaseNotesMarkdown(entry, docsDir));

  if (carriedForwardEntries.length > 0) {
    sections.push('', '## Carried Forward From Earlier Unpublished Tags');

    for (const carriedEntry of carriedForwardEntries) {
      sections.push(
        '',
        `### ${carriedEntry.tag}`,
        '',
        `Status: ${carriedEntry.status || 'pending'}`,
        '',
        readReleaseNotesMarkdown(carriedEntry, docsDir),
      );
    }
  }

  return `${sections.join('\n').trim()}\n`;
}

export { defaultReleaseDocsDir, parseArgs, readReleaseRegistry, renderReleaseNotes };

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  if (!options.releaseTag) {
    throw new Error('Missing required --release-tag argument.');
  }

  const renderedNotes = renderReleaseNotes({
    releaseTag: options.releaseTag,
    docsDir: options.docsDir,
  });

  if (options.output) {
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, renderedNotes, 'utf8');
    return;
  }

  process.stdout.write(renderedNotes);
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
