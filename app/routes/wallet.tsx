import { useState, type FormEvent } from "react"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { Sun, Moon, Copy, Check } from "lucide-react"
import { useAccount } from "wagmi"
import { formatEther, formatUnits, parseUnits } from "viem"
import { Link } from "react-router"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Label } from "~/components/ui/label"
import {
  useStealthAddresses,
  type ScanStep,
} from "~/hooks/use-stealth-addresses"
import { useUnlink, type UnlinkStep } from "~/hooks/use-unlink"
import { useDarkMode } from "~/hooks/use-dark-mode"
import { UNLINK_TEST_TOKEN, WETH_BASE_SEPOLIA } from "~/utils/unlink"

const STEP_LABELS: Record<ScanStep, string> = {
  idle: "",
  "fetching-status": "Checking registration\u2026",
  signing: "Sign to derive your keys\u2026",
  deriving: "Computing stealth addresses\u2026",
  "fetching-balances": "Fetching balances\u2026",
  done: "",
  error: "",
}

const UNLINK_STEP_LABELS: Record<UnlinkStep, string> = {
  idle: "",
  connecting: "Connecting to Unlink\u2026",
  ready: "",
  sweeping: "Sweeping stealth addresses\u2026",
  wrapping: "Wrapping ETH to WETH\u2026",
  depositing: "Depositing into Unlink\u2026",
  transferring: "Sending private transfer\u2026",
  withdrawing: "Withdrawing from Unlink\u2026",
  error: "",
}

function tokenLabel(token: string): string {
  const lower = token.toLowerCase()
  if (lower === WETH_BASE_SEPOLIA.toLowerCase()) return "WETH"
  if (lower === UNLINK_TEST_TOKEN.toLowerCase()) return "TEST"
  return `${token.slice(0, 6)}\u2026${token.slice(-4)}`
}

export default function Wallet() {
  const { isConnected } = useAccount()
  const { isDark, toggle: toggleDark } = useDarkMode()
  const [nameInput, setNameInput] = useState("")
  const { scan, reset, step, entries, totalScanned, error } =
    useStealthAddresses()

  const {
    connect: connectUnlink,
    deposit: unlinkDeposit,
    depositWeth: unlinkDepositWeth,
    transfer: unlinkTransfer,
    withdraw: unlinkWithdraw,
    refreshBalance,
    reset: resetUnlink,
    step: unlinkStep,
    unlinkAddress,
    balances: unlinkBalances,
    error: unlinkError,
  } = useUnlink()

  const [transferRecipient, setTransferRecipient] = useState("")
  const [transferAmount, setTransferAmount] = useState("")
  const [transferToken, setTransferToken] = useState<string>(WETH_BASE_SEPOLIA)
  const [withdrawAddress, setWithdrawAddress] = useState("")
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [withdrawToken, setWithdrawToken] = useState<string>(WETH_BASE_SEPOLIA)
  const [depositAmount, setDepositAmount] = useState("")

  const [debug, setDebug] = useState(false)
  const [copied, setCopied] = useState(false)

  const isScanning =
    step !== "idle" && step !== "done" && step !== "error"

  const isUnlinkBusy =
    unlinkStep !== "idle" &&
    unlinkStep !== "ready" &&
    unlinkStep !== "error"

  const showUnlink = debug || step === "done"

  const handleScan = (e?: FormEvent) => {
    e?.preventDefault()
    const raw = nameInput.trim()
    if (!raw || isScanning) return
    reset()
    scan(raw)
  }

  return (
    <div className="flex min-h-svh items-start justify-center p-6 pt-[12vh]">
      <Card className="w-full max-w-lg bg-card/95 backdrop-blur-sm shadow-lg shadow-primary/5 border border-border/60 transition-shadow duration-300">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-2xl font-semibold tracking-tight">My Wallet</CardTitle>
              <button
                type="button"
                onClick={() => setDebug((d) => !d)}
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors ${
                  debug
                    ? "bg-accent-foreground text-accent"
                    : "bg-accent text-accent-foreground/60 hover:text-accent-foreground"
                }`}
              >
                DBG
              </button>
            </div>
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
                      className="flex flex-col gap-1 rounded-lg border p-3 transition-shadow duration-200 hover:shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <a
                          href={`https://sepolia.basescan.org/address/${entry.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs underline underline-offset-2 transition-colors duration-200 hover:text-primary"
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

              {/* Unlink Private Transactions */}
              {showUnlink && (
                <div className="flex flex-col gap-3 pt-4">
                  <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                  <h3 className="text-sm font-medium">
                    Private Transactions (Unlink)
                  </h3>

                  {unlinkStep === "idle" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={connectUnlink}
                    >
                      Connect to Unlink
                    </Button>
                  )}

                  {unlinkStep === "connecting" && (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <span className="text-sm">
                        {UNLINK_STEP_LABELS[unlinkStep]}
                      </span>
                    </div>
                  )}

                  {unlinkStep === "error" && unlinkError && (
                    <div className="flex flex-col gap-2">
                      <Alert variant="destructive">
                        <AlertDescription>{unlinkError}</AlertDescription>
                      </Alert>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetUnlink}
                      >
                        Try again
                      </Button>
                    </div>
                  )}

                  {(unlinkStep === "ready" || isUnlinkBusy) && (
                    <div className="flex flex-col gap-3">
                      {/* Address + Balances */}
                      <div className="flex flex-col gap-1 rounded-lg border p-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-muted-foreground">
                            Unlink Address
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs break-all">
                              {unlinkAddress}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (unlinkAddress) {
                                  navigator.clipboard.writeText(unlinkAddress)
                                  setCopied(true)
                                  setTimeout(() => setCopied(false), 2000)
                                }
                              }}
                              className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                            >
                              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                        {unlinkBalances.length > 0 ? (
                          unlinkBalances.map((b) => (
                            <div
                              key={b.token}
                              className="flex items-center justify-between text-xs"
                            >
                              <span className="text-muted-foreground">
                                {tokenLabel(b.token)}
                              </span>
                              <span className="font-mono font-medium">
                                {formatUnits(BigInt(b.amount), 18)}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            No private balances yet.
                          </p>
                        )}
                      </div>

                      {/* Progress indicator */}
                      {isUnlinkBusy && (
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          <span className="text-sm">
                            {UNLINK_STEP_LABELS[unlinkStep]}
                          </span>
                        </div>
                      )}

                      {/* Sweep & Deposit */}
                      {entries.length > 0 && unlinkStep === "ready" && (
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => unlinkDeposit(entries)}
                          >
                            Sweep &amp; Deposit to Unlink
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            Sweeps ETH from {entries.length} stealth address
                            {entries.length !== 1 ? "es" : ""}, wraps to WETH,
                            and deposits privately.
                          </p>
                        </div>
                      )}

                      {/* Deposit WETH */}
                      {unlinkStep === "ready" && (
                        <form
                          className="flex flex-col gap-2"
                          onSubmit={(e) => {
                            e.preventDefault()
                            if (!depositAmount) return
                            unlinkDepositWeth(
                              parseUnits(depositAmount, 18).toString(),
                            )
                          }}
                        >
                          <Label className="text-xs">Deposit WETH</Label>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Amount"
                              type="text"
                              value={depositAmount}
                              onChange={(e) =>
                                setDepositAmount(e.target.value)
                              }
                              className="flex-1"
                            />
                            <Button
                              type="submit"
                              size="sm"
                              disabled={!depositAmount}
                            >
                              Deposit
                            </Button>
                          </div>
                        </form>
                      )}

                      {/* Transfer */}
                      {unlinkStep === "ready" && (
                        <form
                          className="flex flex-col gap-2"
                          onSubmit={(e) => {
                            e.preventDefault()
                            if (!transferRecipient.trim() || !transferAmount)
                              return
                            unlinkTransfer(
                              transferRecipient.trim(),
                              transferToken,
                              parseUnits(transferAmount, 18).toString(),
                            )
                          }}
                        >
                          <Label className="text-xs">Private Transfer</Label>
                          <Input
                            placeholder="unlink1..."
                            value={transferRecipient}
                            onChange={(e) =>
                              setTransferRecipient(e.target.value)
                            }
                          />
                          <div className="flex gap-2">
                            <select
                              value={transferToken}
                              onChange={(e) => setTransferToken(e.target.value)}
                              className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                            >
                              <option value={WETH_BASE_SEPOLIA}>WETH</option>
                              <option value={UNLINK_TEST_TOKEN}>TEST</option>
                            </select>
                            <Input
                              placeholder="Amount"
                              type="text"
                              value={transferAmount}
                              onChange={(e) =>
                                setTransferAmount(e.target.value)
                              }
                              className="flex-1"
                            />
                            <Button
                              type="submit"
                              size="sm"
                              disabled={
                                !transferRecipient.trim() || !transferAmount
                              }
                            >
                              Send
                            </Button>
                          </div>
                        </form>
                      )}

                      {/* Withdraw */}
                      {unlinkStep === "ready" && (
                        <form
                          className="flex flex-col gap-2"
                          onSubmit={(e) => {
                            e.preventDefault()
                            if (!withdrawAddress.trim() || !withdrawAmount)
                              return
                            unlinkWithdraw(
                              withdrawAddress.trim(),
                              withdrawToken,
                              parseUnits(withdrawAmount, 18).toString(),
                            )
                          }}
                        >
                          <Label className="text-xs">Withdraw to Address</Label>
                          <Input
                            placeholder="0x..."
                            value={withdrawAddress}
                            onChange={(e) =>
                              setWithdrawAddress(e.target.value)
                            }
                          />
                          <div className="flex gap-2">
                            <select
                              value={withdrawToken}
                              onChange={(e) => setWithdrawToken(e.target.value)}
                              className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                            >
                              <option value={WETH_BASE_SEPOLIA}>WETH</option>
                              <option value={UNLINK_TEST_TOKEN}>TEST</option>
                            </select>
                            <Input
                              placeholder="Amount"
                              type="text"
                              value={withdrawAmount}
                              onChange={(e) =>
                                setWithdrawAmount(e.target.value)
                              }
                              className="flex-1"
                            />
                            <Button
                              type="submit"
                              size="sm"
                              disabled={
                                !withdrawAddress.trim() || !withdrawAmount
                              }
                            >
                              Withdraw
                            </Button>
                          </div>
                        </form>
                      )}

                      {/* Refresh */}
                      {unlinkStep === "ready" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={refreshBalance}
                        >
                          Refresh balance
                        </Button>
                      )}
                    </div>
                  )}
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
