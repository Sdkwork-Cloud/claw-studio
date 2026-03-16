interface ImportMetaEnv {
  readonly VITE_ACCESS_TOKEN?: string;
  readonly VITE_DISTRIBUTION_ID?: string;
  readonly VITE_GEMINI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
