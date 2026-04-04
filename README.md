# React Router + shadcn/ui + wagmi + RainbowKit

React Router 7, TypeScript, shadcn/ui, **RainbowKit**, and wagmi on **Base Sepolia** only. Use **Bun** for installs and scripts.

## Setup

```bash
bun install
cp .env.example .env
# set VITE_WALLETCONNECT_PROJECT_ID (see https://cloud.reown.com/)
bun run dev
```

## Environment

| Variable | Required | Notes |
|----------|----------|--------|
| `VITE_WALLETCONNECT_PROJECT_ID` | Recommended | WalletConnect / Reown project id |
| `VITE_ALCHEMY_API_KEY` | Optional | Alchemy Base Sepolia RPC |
| `VITE_DRPC_API_KEY` | Optional | dRPC Base Sepolia if Alchemy is not set |

If neither is set, viem uses the chain default (`https://sepolia.base.org`).

## Adding components

```bash
bunx --bun shadcn@latest add button
```

Components live under `app/components/ui/`.

## Using components

```tsx
import { Button } from "~/components/ui/button"
```
