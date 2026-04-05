import { useState, useCallback, type FormEvent } from "react"
import { Link } from "react-router"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { Sun, Moon } from "lucide-react"
import { useAccount, usePublicClient } from "wagmi"
import { mainnet } from "viem/chains"
import { normalize, namehash } from "viem/ens"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { fetchStatus, type StatusResponse } from "~/utils/gateway"
import { ENS_REGISTRY, ENS_REGISTRY_ABI } from "~/utils/ens"
import { useRegister, type RegisterStep } from "~/hooks/use-register"
import { useDeregister, type DeregisterStep } from "~/hooks/use-deregister"
import { useDarkMode } from "~/hooks/use-dark-mode"
import type { Address } from "viem"

const STEP_LABELS: Record<RegisterStep, string> = {
  idle: "",
  "deriving-keys": "Generating stealth keys...",
  signing: "Sign registration message...",
  "setting-resolver": "Setting ENS resolver...",
  "confirming-tx": "Waiting for confirmation...",
  registering: "Registering with gateway...",
  done: "Registration complete",
}

const DEREG_STEP_LABELS: Record<DeregisterStep, string> = {
  idle: "",
  signing: "Sign deregistration message...",
  deregistering: "Removing from gateway...",
  "resetting-resolver": "Resetting ENS resolver...",
  "confirming-tx": "Waiting for confirmation...",
  done: "Resolver reset complete",
}

export default function Home() {
  const { address, isConnected } = useAccount()
  const { isDark, toggle: toggleDark } = useDarkMode()
  const mainnetClient = usePublicClient({ chainId: mainnet.id })
  const [nameInput, setNameInput] = useState("")
  const [lookupName, setLookupName] = useState("")
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [ensOwner, setEnsOwner] = useState<Address | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)

  const { register, reset, step, isLoading, error, txHash } =
    useRegister(lookupName)
  const {
    deregister,
    reset: resetDeregister,
    step: deregStep,
    error: deregError,
    txHash: deregTxHash,
  } = useDeregister(lookupName)

  const handleLookup = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault()
      const raw = nameInput.trim()
      if (!raw) return

      setLookupError(null)
      setStatus(null)
      setEnsOwner(null)
      reset()
      resetDeregister()

      let normalized: string
      try {
        normalized = normalize(raw)
      } catch {
        setLookupError("Invalid ENS name")
        return
      }

      setLookupName(normalized)
      setLookupLoading(true)

      try {
        const [result, owner] = await Promise.all([
          fetchStatus(normalized),
          mainnetClient
            ? mainnetClient.readContract({
                address: ENS_REGISTRY,
                abi: ENS_REGISTRY_ABI,
                functionName: "owner",
                args: [namehash(normalized)],
              })
            : Promise.resolve(null),
        ])
        setStatus(result)
        setEnsOwner(owner as Address | null)
      } catch (err) {
        setLookupError(
          err instanceof Error ? err.message : "Failed to check status",
        )
      } finally {
        setLookupLoading(false)
      }
    },
    [nameInput, reset, resetDeregister, mainnetClient],
  )

  const isOwner =
    isConnected &&
    !!address &&
    !!ensOwner &&
    address.toLowerCase() === ensOwner.toLowerCase()

  const showSetup = status && !status.registered && isOwner
  const showNotOwner =
    status && !status.registered && isConnected && !isOwner && ensOwner
  const showStatus = status && status.registered

  return (
    <div className="flex min-h-svh items-start justify-center p-6 pt-[12vh]">
      <Card className="w-full max-w-lg bg-card/95 backdrop-blur-sm shadow-lg shadow-primary/5 border border-border/60 transition-shadow duration-300">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <img src="/logo.svg" alt="" className="h-7 w-7" />
              Sneaky
            </CardTitle>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleDark}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <ConnectButton
                showBalance={false}
                chainStatus="icon"
                accountStatus="avatar"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <form onSubmit={handleLookup} className="flex gap-2">
            <Input
              placeholder="name.eth"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={lookupLoading || !nameInput.trim()}
            >
              {lookupLoading ? "Checking..." : "Lookup"}
            </Button>
          </form>

          {lookupError && (
            <Alert variant="destructive">
              <AlertDescription>{lookupError}</AlertDescription>
            </Alert>
          )}

          {showStatus && (
            <div className="flex flex-col gap-3 rounded-lg border p-3 bg-accent/50">
              <div className="flex items-center justify-between">
                <span className="font-medium">{status.name}</span>
                <Badge className="bg-[#4A5A3A] text-white">Active</Badge>
              </div>
              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Owner</span>
                  <span className="font-mono">
                    {status.owner?.slice(0, 6)}...{status.owner?.slice(-4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Stealth addresses generated</span>
                  <span className="font-mono">{status.nonce}</span>
                </div>
              </div>

              {isOwner && deregStep === "idle" && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={deregister}
                >
                  Reset Resolver
                </Button>
              )}

              {deregStep !== "idle" && deregStep !== "done" && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span className="text-sm">{DEREG_STEP_LABELS[deregStep]}</span>
                  </div>
                  {deregError && (
                    <Alert variant="destructive">
                      <AlertDescription>{deregError}</AlertDescription>
                    </Alert>
                  )}
                  {deregError && (
                    <Button variant="outline" size="sm" onClick={resetDeregister}>
                      Try again
                    </Button>
                  )}
                </div>
              )}

              {deregStep === "done" && (
                <div className="flex flex-col gap-2">
                  <Alert>
                    <AlertDescription>
                      Resolver has been reset for{" "}
                      <span className="font-medium">{lookupName}</span>.
                    </AlertDescription>
                  </Alert>
                  {deregTxHash && (
                    <a
                      href={`https://etherscan.io/tx/${deregTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                      View transaction on Etherscan
                    </a>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      resetDeregister()
                      handleLookup()
                    }}
                  >
                    Refresh status
                  </Button>
                </div>
              )}
            </div>
          )}

          {showSetup && step === "idle" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">{lookupName}</span> is not set up
                yet. Connect your wallet and click below to configure stealth
                addresses.
              </p>
              {!import.meta.env.VITE_OFFCHAIN_RESOLVER_ADDRESS ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    Missing VITE_OFFCHAIN_RESOLVER_ADDRESS. Deploy the
                    OffchainResolver contract first.
                  </AlertDescription>
                </Alert>
              ) : (
                <Button onClick={register} size="lg">
                  Set Up Stealth Address
                </Button>
              )}
            </div>
          )}

          {step !== "idle" && step !== "done" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm">{STEP_LABELS[step]}</span>
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {error && (
                <Button variant="outline" size="sm" onClick={reset}>
                  Try again
                </Button>
              )}
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col gap-3">
              <Alert>
                <AlertDescription>
                  <span className="font-medium">{lookupName}</span> is now
                  configured for stealth addresses.
                </AlertDescription>
              </Alert>
              {txHash && (
                <a
                  href={`https://etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  View transaction on Etherscan
                </a>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  reset()
                  handleLookup()
                }}
              >
                Refresh status
              </Button>
            </div>
          )}

          {showNotOwner && (
            <p className="text-sm text-muted-foreground">
              Only the ENS name owner can set up stealth addresses for{" "}
              <span className="font-medium">{lookupName}</span>.
            </p>
          )}

          {!isConnected && status && !status.registered && (
            <p className="text-sm text-muted-foreground">
              Connect your wallet to set up stealth addresses for{" "}
              <span className="font-medium">{lookupName}</span>.
            </p>
          )}

          <Button variant="ghost" size="sm" asChild className="self-start">
            <Link to="/wallet">View my stealth wallet &rarr;</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
