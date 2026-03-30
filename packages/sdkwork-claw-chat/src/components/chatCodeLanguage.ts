import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism-light.js';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash.js';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css.js';
import diff from 'react-syntax-highlighter/dist/esm/languages/prism/diff.js';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go.js';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java.js';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript.js';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json.js';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx.js';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown.js';
import powershell from 'react-syntax-highlighter/dist/esm/languages/prism/powershell.js';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python.js';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust.js';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql.js';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx.js';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript.js';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml.js';

type RegisteredLanguage = {
  id: string;
  definition: unknown;
  aliases?: string[];
};

const REGISTERED_LANGUAGES: RegisteredLanguage[] = [
  { id: 'bash', definition: bash, aliases: ['shell', 'sh', 'zsh', 'console', 'terminal'] },
  { id: 'css', definition: css },
  { id: 'diff', definition: diff, aliases: ['patch'] },
  { id: 'go', definition: go, aliases: ['golang'] },
  { id: 'java', definition: java },
  { id: 'javascript', definition: javascript, aliases: ['js', 'mjs', 'cjs'] },
  { id: 'json', definition: json, aliases: ['json5'] },
  { id: 'jsx', definition: jsx },
  { id: 'markdown', definition: markdown, aliases: ['md'] },
  { id: 'powershell', definition: powershell, aliases: ['ps1', 'pwsh'] },
  { id: 'python', definition: python, aliases: ['py'] },
  { id: 'rust', definition: rust, aliases: ['rs'] },
  { id: 'sql', definition: sql },
  { id: 'tsx', definition: tsx },
  { id: 'typescript', definition: typescript, aliases: ['ts'] },
  { id: 'yaml', definition: yaml, aliases: ['yml'] },
];

const SUPPORTED_LANGUAGE_ALIASES = new Map<string, string>();

for (const language of REGISTERED_LANGUAGES) {
  SUPPORTED_LANGUAGE_ALIASES.set(language.id, language.id);
  for (const alias of language.aliases || []) {
    SUPPORTED_LANGUAGE_ALIASES.set(alias, language.id);
  }
}

let didRegisterLanguages = false;

function registerCodeLanguages() {
  if (didRegisterLanguages) {
    return;
  }

  for (const language of REGISTERED_LANGUAGES) {
    SyntaxHighlighter.registerLanguage(language.id, language.definition);
  }

  didRegisterLanguages = true;
}

registerCodeLanguages();

export function resolveCodeBlockLanguage(rawLanguage: string | undefined) {
  const normalizedLanguage = rawLanguage?.trim().toLowerCase();
  if (!normalizedLanguage) {
    return undefined;
  }

  return SUPPORTED_LANGUAGE_ALIASES.get(normalizedLanguage);
}

export function getCodeBlockLanguageLabel(rawLanguage: string | undefined) {
  const normalizedLanguage = rawLanguage?.trim();
  if (!normalizedLanguage) {
    return 'text';
  }

  return normalizedLanguage;
}

export { SyntaxHighlighter };
