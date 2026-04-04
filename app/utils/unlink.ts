import { keccak256, toBytes } from "viem"
import { entropyToMnemonic } from "@scure/bip39"
import { wordlist } from "@scure/bip39/wordlists/english.js"

export const UNLINK_ENGINE_URL = "https://staging-api.unlink.xyz"
export const UNLINK_TEST_TOKEN =
  "0x7501de8ea37a21e20e6e65947d2ecab0e9f061a7" as const
export const WETH_BASE_SEPOLIA =
  "0x4200000000000000000000000000000000000006" as const

export const WETH_ABI = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
] as const

/**
 * Derive a deterministic BIP-39 mnemonic from a wallet signature.
 * Same wallet always produces the same mnemonic.
 */
export async function deriveMnemonic(
  signMessageAsync: (args: { message: string }) => Promise<`0x${string}`>,
): Promise<string> {
  const sig = await signMessageAsync({
    message: "Unlink private account for Secret Handshake",
  })
  const hash = keccak256(sig)
  const entropy = toBytes(hash).slice(0, 16) // 128 bits -> 12-word mnemonic
  return entropyToMnemonic(entropy, wordlist)
}
