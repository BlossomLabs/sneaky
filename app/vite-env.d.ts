/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string
  readonly VITE_ALCHEMY_API_KEY?: string
  readonly VITE_DRPC_API_KEY?: string
  readonly VITE_GATEWAY_URL?: string
  readonly VITE_OFFCHAIN_RESOLVER_ADDRESS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
