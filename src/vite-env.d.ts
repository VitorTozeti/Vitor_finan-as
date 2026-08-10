/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BRAPI_TOKEN?: string
  readonly VITE_BANK_PROXY_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
