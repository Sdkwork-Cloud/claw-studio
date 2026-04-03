interface ImportMetaEnv {
  readonly VITE_ACCESS_TOKEN?: string;
  readonly VITE_DISTRIBUTION_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
