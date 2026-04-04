import { http } from "viem"
import { baseSepolia } from "viem/chains"

export const chains = {
  [baseSepolia.id]: baseSepolia,
}

const chainId = baseSepolia.id

export const transports = import.meta.env.VITE_ALCHEMY_API_KEY
  ? {
      [chainId]: http(
        `https://base-sepolia.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`,
      ),
    }
  : import.meta.env.VITE_DRPC_API_KEY
    ? {
        [chainId]: http(
          `https://lb.drpc.live/base-sepolia/${import.meta.env.VITE_DRPC_API_KEY}`,
        ),
      }
    : {
        [chainId]: http(),
      }
