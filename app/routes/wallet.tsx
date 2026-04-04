import { useState, type FormEvent } from "react"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useAccount } from "wagmi"
import { formatEther } from "viem"
import { Link } from "react-router"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { Alert, AlertDescription } from "~/components/ui/alert"
import {
  useStealthAddresses,
  type ScanStep,
} from "~/hooks/use-stealth-addresses"

const STEP_LABELS: Record<ScanStep, string> = {
  idle: "",
  "fetching-status": "Checking registration\u2026",
  signing: "Sign to derive your keys\u2026",
  deriving: "Computing stealth addresses\u2026",
  "fetching-balances": "Fetching balances\u2026",
  done: "",
  error: "",
}

export default function Wallet() {
  const { isConnected } = useAccount()
  const [nameInput, setNameInput] = useState("")
  const { scan, reset, step, entries, totalScanned, error } =
    useStealthAddresses()

  const isScanning =
    step !== "idle" && step !== "done" && step !== "error"

  const handleScan = (e?: FormEvent) => {
    e?.preventDefault()
    const raw = nameInput.trim()
    if (!raw || isScanning) return
    reset()
    scan(raw)
  }

  return (
    <div className="flex min-h-svh items-start justify-center p-6 pt-[12vh]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">My Wallet</CardTitle>
            <ConnectButton
              showBalance={false}
              chainStatus="icon"
              accountStatus="avatar"
            />
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {!isConnected ? (
            <p className="text-sm text-muted-foreground">
              Connect your wallet to scan your stealth addresses.
            </p>
          ) : (
            <>
              <form onSubmit={handleScan} className="flex gap-2">
                <Input
                  placeholder="name.eth"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={isScanning || !nameInput.trim()}
                >
                  {isScanning ? "Scanning\u2026" : "Scan"}
                </Button>
              </form>

              {isScanning && (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="text-sm">{STEP_LABELS[step]}</span>
                </div>
              )}

              {step === "error" && error && (
                <div className="flex flex-col gap-3">
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                  <Button variant="outline" size="sm" onClick={reset}>
                    Try again
                  </Button>
                </div>
              )}

              {step === "done" && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">
                    Found{" "}
                    <span className="font-medium text-foreground">
                      {entries.length}
                    </span>{" "}
                    funded address{entries.length !== 1 ? "es" : ""} out of{" "}
                    {totalScanned} scanned.
                  </p>

                  {entries.length === 0 && (
                    <Alert>
                      <AlertDescription>
                        No stealth addresses with ETH balance found on Base
                        Sepolia.
                      </AlertDescription>
                    </Alert>
                  )}

                  {entries.map((entry) => (
                    <div
                      key={entry.nonce}
                      className="flex flex-col gap-1 rounded-lg border p-3"
                    >
                      <div className="flex items-center justify-between">
                        <a
                          href={`https://sepolia.basescan.org/address/${entry.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs underline underline-offset-2 hover:text-foreground"
                        >
                          {entry.address.slice(0, 6)}&hellip;
                          {entry.address.slice(-4)}
                        </a>
                        <Badge variant="secondary">#{entry.nonce}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Balance</span>
                        <span className="font-mono font-medium text-foreground">
                          {formatEther(entry.balance)} ETH
                        </span>
                      </div>
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleScan()}
                  >
                    Rescan
                  </Button>
                </div>
              )}
            </>
          )}

          <Button variant="ghost" size="sm" asChild className="self-start">
            <Link to="/">&larr; Back home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
