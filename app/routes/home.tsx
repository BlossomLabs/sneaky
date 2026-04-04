import { useState, useCallback, type FormEvent } from "react"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useAccount } from "wagmi"
import { normalize } from "viem/ens"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { fetchStatus, type StatusResponse } from "~/utils/gateway"
import { useRegister, type RegisterStep } from "~/hooks/use-register"

const STEP_LABELS: Record<RegisterStep, string> = {
  idle: "",
  "deriving-keys": "Generating stealth keys\u2026",
  signing: "Sign registration message\u2026",
  "setting-resolver": "Setting ENS resolver\u2026",
  "confirming-tx": "Waiting for confirmation\u2026",
  registering: "Registering with gateway\u2026",
  done: "Registration complete",
}

export default function Home() {
  const { address, isConnected } = useAccount()
  const [nameInput, setNameInput] = useState("")
  const [lookupName, setLookupName] = useState("")
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)

  const { register, reset, step, isLoading, error, txHash } =
    useRegister(lookupName)

  const handleLookup = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault()
      const raw = nameInput.trim()
      if (!raw) return

      setLookupError(null)
      setStatus(null)
      reset()

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
        const result = await fetchStatus(normalized)
        setStatus(result)
      } catch (err) {
        setLookupError(
          err instanceof Error ? err.message : "Failed to check status",
        )
      } finally {
        setLookupLoading(false)
      }
    },
    [nameInput, reset],
  )

  const showSetup = status && !status.registered && isConnected
  const showStatus = status && status.registered

  return (
    <div className="flex min-h-svh items-start justify-center p-6 pt-[12vh]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Secret Handshake</CardTitle>
            <ConnectButton
              showBalance={false}
              chainStatus="icon"
              accountStatus="avatar"
            />
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
              variant="outline"
              disabled={lookupLoading || !nameInput.trim()}
            >
              {lookupLoading ? "Checking\u2026" : "Lookup"}
            </Button>
          </form>

          {lookupError && (
            <Alert variant="destructive">
              <AlertDescription>{lookupError}</AlertDescription>
            </Alert>
          )}

          {showStatus && (
            <div className="flex flex-col gap-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{status.name}</span>
                <Badge className="bg-emerald-600 text-white">Active</Badge>
              </div>
              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Owner</span>
                  <span className="font-mono">
                    {status.owner?.slice(0, 6)}\u2026{status.owner?.slice(-4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Stealth addresses generated</span>
                  <span className="font-mono">{status.nonce}</span>
                </div>
              </div>
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

          {!isConnected && status && !status.registered && (
            <p className="text-sm text-muted-foreground">
              Connect your wallet to set up stealth addresses for{" "}
              <span className="font-medium">{lookupName}</span>.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
