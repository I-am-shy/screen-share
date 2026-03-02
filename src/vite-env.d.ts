/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ZEGO_APP_ID: string
  readonly VITE_ZEGO_SERVER_URL: string
  readonly VITE_TOKEN_SERVER_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
