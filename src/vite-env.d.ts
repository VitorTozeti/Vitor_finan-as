/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BRAPI_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
