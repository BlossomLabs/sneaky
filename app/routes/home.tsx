import { ConnectButton } from "@rainbow-me/rainbowkit"
import { Link } from "react-router"
import { Button } from "~/components/ui/button"

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col gap-6 p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="font-medium">Secret Handshake</h1>
          <p>
            <span className="font-medium">Base Sepolia</span> only. Optional{" "}
            <span className="font-mono text-xs">VITE_ALCHEMY_API_KEY</span> or{" "}
            <span className="font-mono text-xs">VITE_DRPC_API_KEY</span> for RPC;{" "}
            <span className="font-mono text-xs">VITE_WALLETCONNECT_PROJECT_ID</span>{" "}
            for WalletConnect.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            <ConnectButton />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" asChild>
                <Link to="/about">About (React Router)</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
