import { http } from "viem"
import { baseSepolia, mainnet } from "viem/chains"

export const chains = {
  [mainnet.id]: mainnet,
  [baseSepolia.id]: baseSepolia,
}

export const transports = {
  [mainnet.id]: import.meta.env.VITE_ALCHEMY_API_KEY
    ? http(
        `https://eth-mainnet.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`,
      )
    : import.meta.env.VITE_DRPC_API_KEY
      ? http(
          `https://lb.drpc.org/ogrpc?network=ethereum&dkey=${import.meta.env.VITE_DRPC_API_KEY}`,
        )
      : http(),
  [baseSepolia.id]: import.meta.env.VITE_ALCHEMY_API_KEY
    ? http(
        `https://base-sepolia.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`,
      )
    : import.meta.env.VITE_DRPC_API_KEY
      ? http(
          `https://lb.drpc.org/ogrpc?network=base-sepolia&dkey=${import.meta.env.VITE_DRPC_API_KEY}`,
        )
      : http(),
}
