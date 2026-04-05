import { useCallback, useState } from "react"
import { useAccount, usePublicClient, useSignMessage, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from "wagmi"
import { mainnet } from "viem/chains"
import { normalize } from "viem/ens"
import {
  generateKeysFromSignature,
  extractViewingPrivateKeyNode,
} from "@fluidkey/stealth-account-kit"
import { postRegister } from "~/utils/gateway"
import { ENS_REGISTRY, ENS_REGISTRY_ABI, buildSetResolverArgs } from "~/utils/ens"
import type { Address, Hex } from "viem"
import { generateSneakyMessage } from "~/utils/stealth"

export type RegisterStep =
  | "idle"
  | "deriving-keys"
  | "signing"
  | "setting-resolver"
  | "confirming-tx"
  | "registering"
  | "done"

interface RegisterState {
  step: RegisterStep
  isLoading: boolean
  error: string | null
  txHash: Hex | null
}

export function useRegister(ensName: string) {
  const { address, chainId } = useAccount()
  const mainnetClient = usePublicClient({ chainId: mainnet.id })
  const { signMessageAsync } = useSignMessage()
  const { writeContractAsync } = useWriteContract()
  const { switchChainAsync } = useSwitchChain()
  const [state, setState] = useState<RegisterState>({
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

  const register = useCallback(async () => {
    if (!address || !resolverAddress || !ensName) return

    setState({ step: "deriving-keys", isLoading: true, error: null, txHash: null })

    try {
      const normalizedName = normalize(ensName)

      // Step 1: Derive stealth keys
      const { message } = generateSneakyMessage({
        pin: "0000",
        address,
      })
      const fluidkeySig = await signMessageAsync({ message })
      const { spendingPrivateKey: _spk, viewingPrivateKey } =
        generateKeysFromSignature(fluidkeySig)

      const spendingKeys = generateKeysFromSignature(fluidkeySig)
      const spendingPublicKey = (await import("viem/accounts")).privateKeyToAccount(
        spendingKeys.spendingPrivateKey,
      ).publicKey as Hex

      const viewingKeyNode = extractViewingPrivateKeyNode(viewingPrivateKey)
      const viewingKeyNodeXprv = viewingKeyNode.privateExtendedKey

      // Step 2: Sign registration message
      setState((s) => ({ ...s, step: "signing" }))
      const registrationMessage = `Register ${normalizedName} on Sneaky`
      const registrationSig = await signMessageAsync({
        message: registrationMessage,
      })

      // Step 3: Set resolver on-chain (mainnet) — skip if already correct
      setState((s) => ({ ...s, step: "setting-resolver" }))

      if (!mainnetClient) throw new Error("Mainnet client not available")

      const { namehash } = await import("viem/ens")
      const node = namehash(normalizedName)
      const currentResolver = await mainnetClient.readContract({
        address: ENS_REGISTRY,
        abi: ENS_REGISTRY_ABI,
        functionName: "resolver",
        args: [node],
      })

      let hash: Hex | undefined
      if (currentResolver.toLowerCase() !== resolverAddress.toLowerCase()) {
        if (chainId !== mainnet.id) {
          await switchChainAsync({ chainId: mainnet.id })
        }

        const setResolverArgs = buildSetResolverArgs(normalizedName, resolverAddress)
        hash = await writeContractAsync({
          ...setResolverArgs,
          chain: mainnet,
        })

        const confirmedHash = hash
        setState((s) => ({ ...s, step: "confirming-tx", txHash: confirmedHash }))
        setTxHash(confirmedHash)
        await mainnetClient.waitForTransactionReceipt({ hash: confirmedHash })
      }

      // Step 4: Register on gateway
      setState((s) => ({ ...s, step: "registering" }))
      const regResult = await postRegister({
        name: normalizedName,
        address,
        signature: registrationSig,
        spendingPublicKey,
        viewingKeyNode: viewingKeyNodeXprv,
        previousResolver: currentResolver as Address,
      })
      if (!regResult.ok) {
        throw new Error(regResult.error ?? "Gateway registration failed")
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
    register,
    reset,
    step: state.step,
    isLoading: state.isLoading || isTxConfirming,
    error: state.error,
    txHash: state.txHash,
  }
}
