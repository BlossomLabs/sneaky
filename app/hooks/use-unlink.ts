import { useCallback, useRef, useState } from "react"
import { useAccount, useSignMessage, useWalletClient } from "wagmi"
import {
  createPublicClient,
  createWalletClient as createViemWalletClient,
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
  const mnemonicRef = useRef<string | null>(null)

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
      mnemonicRef.current = mnemonic

      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: transports[baseSepolia.id],
      })

      const unlink = createUnlink({
        engineUrl: UNLINK_ENGINE_URL,
        apiKey,
        account: unlinkAccount.fromMnemonic({ mnemonic }),
        evm: unlinkEvm.fromViem({ walletClient, publicClient }),
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

  const sweep = useCallback(
    async (entries: StealthEntry[], to: Address) => {
      setStep("sweeping")
      setError(null)
      try {
        const funded = entries.filter(
          (e) => e.stealthPrivateKey && e.balance > 0n,
        )
        if (funded.length === 0) {
          setStep("ready")
          return
        }

        const { privateKeyToAccount } = await import("viem/accounts")
        const publicClient = createPublicClient({
          chain: baseSepolia,
          transport: transports[baseSepolia.id],
        })

        for (const entry of funded) {
          const account = privateKeyToAccount(entry.stealthPrivateKey as Hex)
          const stealthWallet = createViemWalletClient({
            account,
            chain: baseSepolia,
            transport: transports[baseSepolia.id],
          })
          const currentBalance = await publicClient.getBalance({ address: account.address })
          const gasPrice = await publicClient.getGasPrice()
          const gasCost = 21000n * gasPrice * 2n
          if (currentBalance <= gasCost) continue

          const value = currentBalance - gasCost
          const hash = await stealthWallet.sendTransaction({ to, value })
          await publicClient.waitForTransactionReceipt({ hash })
        }

        setStep("ready")
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg.includes("User rejected") ? "Signature rejected" : msg)
        setStep("error")
      }
    },
    [],
  )

  const sweepToUnlink = useCallback(
    async (entries: StealthEntry[]) => {
      const mnemonic = mnemonicRef.current
      if (!mnemonic || !apiKey) return
      setError(null)
      try {
        const funded = entries.filter(
          (e) => e.stealthPrivateKey && e.balance > 0n,
        )
        if (funded.length === 0) {
          setStep("ready")
          return
        }

        const { privateKeyToAccount } = await import("viem/accounts")
        const publicClient = createPublicClient({
          chain: baseSepolia,
          transport: transports[baseSepolia.id],
        })

        for (const entry of funded) {
          const account = privateKeyToAccount(entry.stealthPrivateKey as Hex)
          const stealthWallet = createViemWalletClient({
            account,
            chain: baseSepolia,
            transport: transports[baseSepolia.id],
          })
          const currentBalance = await publicClient.getBalance({ address: account.address })
          const gasPrice = await publicClient.getGasPrice()
          // WETH deposit ~46k + ERC-20 approve ~46k + Unlink deposit ~200k
          const gasCost = 350_000n * gasPrice * 2n
          if (currentBalance <= gasCost) continue

          const value = currentBalance - gasCost

          setStep("wrapping")
          const wrapHash = await stealthWallet.writeContract({
            chain: baseSepolia,
            address: WETH_BASE_SEPOLIA,
            abi: WETH_ABI,
            functionName: "deposit",
            value,
          })
          await publicClient.waitForTransactionReceipt({ hash: wrapHash })

          setStep("depositing")
          const stealthUnlink = createUnlink({
            engineUrl: UNLINK_ENGINE_URL,
            apiKey,
            account: unlinkAccount.fromMnemonic({ mnemonic }),
            evm: unlinkEvm.fromViem({ walletClient: stealthWallet, publicClient }),
          })
          await stealthUnlink.ensureErc20Approval({
            token: WETH_BASE_SEPOLIA,
            amount: value.toString(),
          })
          const { txId } = await stealthUnlink.deposit({
            token: WETH_BASE_SEPOLIA,
            amount: value.toString(),
            deadline: Math.floor(Date.now() / 1000) + 3600,
          })
          await stealthUnlink.pollTransactionStatus(txId)
        }

        await refreshBalance()
        setStep("ready")
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg.includes("User rejected") ? "Signature rejected" : msg)
        setStep("error")
      }
    },
    [apiKey, refreshBalance],
  )

  const depositWeth = useCallback(
    async (amount: string) => {
      const client = clientRef.current
      if (!client) return
      setStep("depositing")
      setError(null)
      try {
        await client.ensureErc20Approval({
          token: WETH_BASE_SEPOLIA,
          amount,
        })
        const { txId } = await client.deposit({
          token: WETH_BASE_SEPOLIA,
          amount,
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
    [refreshBalance],
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
    mnemonicRef.current = null
  }, [])

  return {
    connect,
    sweep,
    sweepToUnlink,
    depositWeth,
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
