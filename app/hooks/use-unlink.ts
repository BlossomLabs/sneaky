import { useCallback, useRef, useState } from "react"
import { useAccount, useSignMessage, useWalletClient } from "wagmi"
import {
  createPublicClient,
  createWalletClient as createViemWalletClient,
  http,
  parseEther,
} from "viem"
import type { Address, Hex } from "viem"
import { baseSepolia } from "viem/chains"
import {
  createUnlink,
  unlinkAccount,
  unlinkEvm,
  type UnlinkClient,
} from "@unlink-xyz/sdk"
import { transports } from "~/data/supported-chains"
import {
  deriveMnemonic,
  UNLINK_ENGINE_URL,
  UNLINK_TEST_TOKEN,
  WETH_BASE_SEPOLIA,
  WETH_ABI,
} from "~/utils/unlink"
import type { StealthEntry } from "~/hooks/use-stealth-addresses"

export type UnlinkStep =
  | "idle"
  | "connecting"
  | "ready"
  | "sweeping"
  | "wrapping"
  | "depositing"
  | "transferring"
  | "withdrawing"
  | "error"

export interface UnlinkBalance {
  token: Address
  amount: string
}

export function useUnlink() {
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { data: walletClient } = useWalletClient()
  const clientRef = useRef<UnlinkClient | null>(null)

  const [step, setStep] = useState<UnlinkStep>("idle")
  const [unlinkAddress, setUnlinkAddress] = useState<string | null>(null)
  const [balances, setBalances] = useState<UnlinkBalance[]>([])
  const [error, setError] = useState<string | null>(null)

  const apiKey = import.meta.env.VITE_UNLINK_API_KEY

  const refreshBalance = useCallback(async () => {
    const client = clientRef.current
    if (!client) return
    const { balances: bal } = await client.getBalances()
    setBalances(
      bal.map((b) => ({ token: b.token as Address, amount: b.amount })),
    )
  }, [])

  const connect = useCallback(async () => {
    if (!address || !walletClient || !apiKey) return
    setStep("connecting")
    setError(null)
    try {
      const mnemonic = await deriveMnemonic(signMessageAsync)

      const unlink = createUnlink({
        engineUrl: UNLINK_ENGINE_URL,
        apiKey,
        account: unlinkAccount.fromMnemonic({ mnemonic }),
        evm: unlinkEvm.fromViem({ walletClient }),
      })
      clientRef.current = unlink

      await unlink.ensureRegistered()
      const addr = await unlink.getAddress()
      setUnlinkAddress(addr)
      await refreshBalance()
      setStep("ready")
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg.includes("User rejected") ? "Signature rejected" : msg)
      setStep("error")
    }
  }, [address, walletClient, apiKey, signMessageAsync, refreshBalance])

  const deposit = useCallback(
    async (entries: StealthEntry[]) => {
      const client = clientRef.current
      if (!client || !address || !walletClient) return
      setError(null)

      try {
        const funded = entries.filter(
          (e) => e.stealthPrivateKey && e.balance > 0n,
        )
        if (funded.length === 0) return

        // 1. Sweep ETH from stealth addresses to connected wallet
        setStep("sweeping")
        const { privateKeyToAccount } = await import("viem/accounts")
        const publicClient = createPublicClient({
          chain: baseSepolia,
          transport: transports[baseSepolia.id],
        })

        let totalSwept = 0n
        for (const entry of funded) {
          const account = privateKeyToAccount(entry.stealthPrivateKey as Hex)
          const stealthWallet = createViemWalletClient({
            account,
            chain: baseSepolia,
            transport: transports[baseSepolia.id],
          })
          const gasPrice = await publicClient.getGasPrice()
          const gasCost = 21000n * gasPrice * 2n // 2x buffer
          if (entry.balance <= gasCost) continue

          const value = entry.balance - gasCost
          const hash = await stealthWallet.sendTransaction({
            to: address,
            value,
          })
          await publicClient.waitForTransactionReceipt({ hash })
          totalSwept += value
        }

        if (totalSwept === 0n) {
          setStep("ready")
          return
        }

        // 2. Wrap ETH to WETH
        setStep("wrapping")
        const wrapHash = await walletClient.writeContract({
          address: WETH_BASE_SEPOLIA,
          abi: WETH_ABI,
          functionName: "deposit",
          value: totalSwept,
        })
        await publicClient.waitForTransactionReceipt({ hash: wrapHash })

        // 3. Approve + deposit into Unlink
        setStep("depositing")
        await client.ensureErc20Approval({
          token: WETH_BASE_SEPOLIA,
          amount: totalSwept.toString(),
        })
        const { txId } = await client.deposit({
          token: WETH_BASE_SEPOLIA,
          amount: totalSwept.toString(),
          deadline: Math.floor(Date.now() / 1000) + 3600,
        })
        await client.pollTransactionStatus(txId)

        await refreshBalance()
        setStep("ready")
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg.includes("User rejected") ? "Signature rejected" : msg)
        setStep("error")
      }
    },
    [address, walletClient, refreshBalance],
  )

  const transfer = useCallback(
    async (recipient: string, token: string, amount: string) => {
      const client = clientRef.current
      if (!client) return
      setStep("transferring")
      setError(null)
      try {
        const { txId } = await client.transfer({
          recipientAddress: recipient,
          token,
          amount,
        })
        await client.pollTransactionStatus(txId)
        await refreshBalance()
        setStep("ready")
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
        setStep("error")
      }
    },
    [refreshBalance],
  )

  const withdraw = useCallback(
    async (evmAddress: string, token: string, amount: string) => {
      const client = clientRef.current
      if (!client) return
      setStep("withdrawing")
      setError(null)
      try {
        const { txId } = await client.withdraw({
          recipientEvmAddress: evmAddress,
          token,
          amount,
        })
        await client.pollTransactionStatus(txId)
        await refreshBalance()
        setStep("ready")
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
        setStep("error")
      }
    },
    [refreshBalance],
  )

  const reset = useCallback(() => {
    setStep("idle")
    setUnlinkAddress(null)
    setBalances([])
    setError(null)
    clientRef.current = null
  }, [])

  return {
    connect,
    deposit,
    transfer,
    withdraw,
    refreshBalance,
    reset,
    step,
    unlinkAddress,
    balances,
    error,
  }
}
