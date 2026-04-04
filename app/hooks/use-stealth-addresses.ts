import { useCallback, useState } from "react"
import { useAccount, useSignMessage } from "wagmi"
import { createPublicClient, formatEther } from "viem"
import { baseSepolia } from "viem/chains"
import type { Address, Hex } from "viem"
import {
  generateFluidkeyMessage,
  generateKeysFromSignature,
  extractViewingPrivateKeyNode,
  generateEphemeralPrivateKey,
  generateStealthAddresses,
  generateStealthPrivateKey,
} from "@fluidkey/stealth-account-kit"
import { fetchStatus } from "~/utils/gateway"
import { transports } from "~/data/supported-chains"
import { normalize } from "viem/ens"

export type ScanStep =
  | "idle"
  | "fetching-status"
  | "signing"
  | "deriving"
  | "fetching-balances"
  | "done"
  | "error"

export interface StealthEntry {
  address: Address
  nonce: number
  balance: bigint
  stealthPrivateKey?: Hex
}

const BATCH_SIZE = 20
const BASE_SEPOLIA_CHAIN_ID = 84532

export function useStealthAddresses() {
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [step, setStep] = useState<ScanStep>("idle")
  const [entries, setEntries] = useState<StealthEntry[]>([])
  const [totalScanned, setTotalScanned] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const scan = useCallback(
    async (ensName: string) => {
      if (!address) return

      setStep("fetching-status")
      setError(null)
      setEntries([])
      setTotalScanned(0)

      try {
        const normalized = normalize(ensName)

        // 1. Check registration status and get nonce
        const status = await fetchStatus(normalized)
        if (!status.registered) {
          throw new Error(
            "This ENS name is not registered with Sneaky",
          )
        }
        if (!status.nonce || status.nonce === 0) {
          throw new Error("No stealth addresses have been generated yet")
        }
        const totalNonces = status.nonce

        // 2. Sign fluidkey message to derive keys
        setStep("signing")
        const { message } = generateFluidkeyMessage({
          pin: "0000",
          address,
        })
        const sig = await signMessageAsync({ message })

        // 3. Derive keys (same pattern as use-register.ts)
        setStep("deriving")
        const { spendingPrivateKey, viewingPrivateKey } =
          generateKeysFromSignature(sig)

        const { privateKeyToAccount } = await import("viem/accounts")
        const spendingPublicKey = privateKeyToAccount(
          spendingPrivateKey,
        ).publicKey as Hex

        const viewingKeyNode = extractViewingPrivateKeyNode(viewingPrivateKey)

        // 4. Compute all stealth addresses (mirrors deno/main.ts generateStealth)
        const allAddresses: {
          address: Address
          nonce: number
          ephemeralPublicKey: Hex
        }[] = []
        for (let i = 0; i < totalNonces; i++) {
          const { ephemeralPrivateKey } = generateEphemeralPrivateKey({
            viewingPrivateKeyNode: viewingKeyNode,
            nonce: BigInt(i),
            chainId: BASE_SEPOLIA_CHAIN_ID,
          })
          const ephemeralPublicKey = privateKeyToAccount(
            ephemeralPrivateKey,
          ).publicKey as Hex
          const { stealthAddresses } = generateStealthAddresses({
            spendingPublicKeys: [spendingPublicKey],
            ephemeralPrivateKey,
          })
          allAddresses.push({
            address: stealthAddresses[0] as Address,
            nonce: i,
            ephemeralPublicKey,
          })
        }
        setTotalScanned(totalNonces)

        // 5. Batch-fetch ETH balances on Base Sepolia
        setStep("fetching-balances")
        const client = createPublicClient({
          chain: baseSepolia,
          transport: transports[baseSepolia.id],
        })

        const funded: StealthEntry[] = []
        for (let i = 0; i < allAddresses.length; i += BATCH_SIZE) {
          const chunk = allAddresses.slice(i, i + BATCH_SIZE)
          const balances = await Promise.all(
            chunk.map((a) => client.getBalance({ address: a.address })),
          )
          chunk.forEach((a, j) => {
            if (balances[j] > 0n) {
              const { stealthPrivateKey } = generateStealthPrivateKey({
                spendingPrivateKey,
                ephemeralPublicKey: a.ephemeralPublicKey,
              })
              funded.push({
                address: a.address,
                nonce: a.nonce,
                balance: balances[j],
                stealthPrivateKey,
              })
            }
          })
        }

        setEntries(funded)
        setStep("done")
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg.includes("User rejected") ? "Signature rejected" : msg)
        setStep("error")
      }
    },
    [address, signMessageAsync],
  )

  const reset = useCallback(() => {
    setStep("idle")
    setEntries([])
    setTotalScanned(0)
    setError(null)
  }, [])

  return { scan, reset, step, entries, totalScanned, error }
}
