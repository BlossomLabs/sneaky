import type { Address } from "viem"
import { namehash } from "viem/ens"

export const ENS_REGISTRY: Address =
  "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"

export const ENS_REGISTRY_ABI = [
  {
    name: "resolver",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "setResolver",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "resolver", type: "address" },
    ],
    outputs: [],
  },
] as const

export function buildSetResolverArgs(ensName: string, resolverAddress: Address) {
  const node = namehash(ensName)
  return {
    address: ENS_REGISTRY,
    abi: ENS_REGISTRY_ABI,
    functionName: "setResolver" as const,
    args: [node, resolverAddress] as const,
  }
}
