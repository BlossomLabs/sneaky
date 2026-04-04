import { useCallback, useState } from "react"
import { useAccount, usePublicClient, useSignMessage, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from "wagmi"
import { mainnet } from "viem/chains"
import { normalize, namehash } from "viem/ens"
import { zeroAddress } from "viem"
import { postDeregister } from "~/utils/gateway"
import { ENS_REGISTRY, ENS_REGISTRY_ABI, buildSetResolverArgs } from "~/utils/ens"
import type { Address, Hex } from "viem"

export type DeregisterStep =
  | "idle"
  | "signing"
  | "deregistering"
  | "resetting-resolver"
  | "confirming-tx"
  | "done"

interface DeregisterState {
  step: DeregisterStep
  isLoading: boolean
  error: string | null
  txHash: Hex | null
}

export function useDeregister(ensName: string) {
  const { address, chainId } = useAccount()
  const mainnetClient = usePublicClient({ chainId: mainnet.id })
  const { signMessageAsync } = useSignMessage()
  const { writeContractAsync } = useWriteContract()
  const { switchChainAsync } = useSwitchChain()
  const [state, setState] = useState<DeregisterState>({
    step: "idle",
    isLoading: false,
    error: null,
    txHash: null,
  })
  const [txHash, setTxHash] = useState<Hex | undefined>()

  const { isLoading: isTxConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  const resolverAddress = import.meta.env.VITE_OFFCHAIN_RESOLVER_ADDRESS as
    | Address
    | undefined

  const deregister = useCallback(async () => {
    if (!address || !ensName) return

    setState({ step: "signing", isLoading: true, error: null, txHash: null })

    try {
      const normalizedName = normalize(ensName)

      const message = `Deregister ${normalizedName} on Sneaky`
      const signature = await signMessageAsync({ message })

      setState((s) => ({ ...s, step: "deregistering" }))
      const result = await postDeregister({
        name: normalizedName,
        address,
        signature,
      })
      if (!result.ok) {
        throw new Error(result.error ?? "Gateway deregistration failed")
      }

      setState((s) => ({ ...s, step: "resetting-resolver" }))

      if (!mainnetClient) throw new Error("Mainnet client not available")

      const node = namehash(normalizedName)
      const currentResolver = await mainnetClient.readContract({
        address: ENS_REGISTRY,
        abi: ENS_REGISTRY_ABI,
        functionName: "resolver",
        args: [node],
      })

      const targetResolver = result.previousResolver ?? zeroAddress
      let hash: Hex | undefined

      if (
        resolverAddress &&
        currentResolver.toLowerCase() === resolverAddress.toLowerCase() &&
        currentResolver.toLowerCase() !== targetResolver.toLowerCase()
      ) {
        if (chainId !== mainnet.id) {
          await switchChainAsync({ chainId: mainnet.id })
        }

        const setResolverArgs = buildSetResolverArgs(normalizedName, targetResolver as Address)
        hash = await writeContractAsync({
          ...setResolverArgs,
          chain: mainnet,
        })

        setState((s) => ({ ...s, step: "confirming-tx", txHash: hash! }))
        setTxHash(hash)
        await mainnetClient.waitForTransactionReceipt({ hash: hash! })
      }

      setState({ step: "done", isLoading: false, error: null, txHash: hash ?? null })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setState((s) => ({
        ...s,
        isLoading: false,
        error: message.includes("User rejected")
          ? "Transaction rejected"
          : message,
      }))
    }
  }, [
    address,
    resolverAddress,
    ensName,
    chainId,
    signMessageAsync,
    writeContractAsync,
    switchChainAsync,
  ])

  const reset = useCallback(() => {
    setState({ step: "idle", isLoading: false, error: null, txHash: null })
    setTxHash(undefined)
  }, [])

  return {
    deregister,
    reset,
    step: state.step,
    isLoading: state.isLoading || isTxConfirming,
    error: state.error,
    txHash: state.txHash,
  }
}
