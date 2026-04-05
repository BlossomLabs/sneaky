import { Link } from "react-router"
import { Sun, Moon } from "lucide-react"
import { Button } from "~/components/ui/button"
import { useDarkMode } from "~/hooks/use-dark-mode"

export default function Landing() {
  const { isDark, toggle: toggleDark } = useDarkMode()

  return (
    <div className="min-h-svh">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full backdrop-blur-md bg-background/70 border-b border-border/40">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <span className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <img src="/logo.svg" alt="" className="h-6 w-6" />
            Sneaky
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleDark}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Button asChild size="sm">
              <Link to="/app">Launch App</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative w-full overflow-hidden">
        <img
          src="/hero.png"
          alt="Sneaky — Stealth addresses for ENS"
          className="w-full h-[60vh] object-cover object-bottom"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/30" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <div className="rounded-2xl border border-white/15 bg-background/20 backdrop-blur-[2px] p-8 sm:p-10 shadow-2xl max-w-2xl dark:bg-background/15">
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight leading-tight">
              Your ENS name is public. Your transactions shouldn't be.
            </h1>
            <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
              Sneaky gives every sender a unique, one-time address that only you can spend from -- so your
              financial activity stays private even though your identity is public.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-center mb-14">
            How it works
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            <Step
              number="1"
              title="Register"
              description="Point your ENS name at the Sneaky offchain resolver. Your stealth key material is stored on the gateway -- no seed phrase to manage."
            />
            <Step
              number="2"
              title="Receive"
              description="When someone resolves your name, the resolver generates a fresh stealth address via EIP-3668 CCIP-Read. Every resolution is unique."
            />
            <Step
              number="3"
              title="Sweep"
              description="Scan your stealth addresses, find funded ones, and sweep the ETH -- directly to your wallet or through Unlink for full privacy."
            />
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section className="mx-auto max-w-4xl px-6 py-20">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-center mb-14">
          Three components, one flow
        </h2>
        <div className="grid gap-8 sm:grid-cols-3">
          <ArchCard
            label="On-chain"
            title="OffchainResolver"
            detail="Solidity contract on Ethereum mainnet implementing EIP-3668. Reverts with a gateway URL on resolve() and verifies signed stealth addresses in resolveWithProof()."
          />
          <ArchCard
            label="Gateway"
            title="Deno Deploy"
            detail="CCIP-Read gateway that generates stealth addresses using @fluidkey/stealth-account-kit, stores nonces in Deno KV, and signs responses for on-chain verification."
          />
          <ArchCard
            label="Frontend"
            title="React SPA"
            detail="React Router 7 app with RainbowKit. Register your ENS, scan for funded stealth addresses on Base Sepolia, and sweep through Unlink."
          />
        </div>
      </section>

      {/* Unlink */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-6">
          <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-lg p-10 shadow-xl dark:border-white/10 dark:bg-white/5 text-center">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-6">
              Break the on-chain link
            </h2>
            <p className="text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Stealth addresses hide <em>who is receiving</em>, but consolidating funds can expose the connection.{" "}
              <a href="https://unlink.xyz" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground transition-colors">Unlink</a>{" "}
              breaks that link by routing funds through a privacy pool. Each stealth address independently wraps ETH to WETH and deposits
              into Unlink -- your wallet is never involved on-chain.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-sm font-medium">
              <span className="rounded-lg border border-white/20 bg-white/10 backdrop-blur px-4 py-2 dark:border-white/10">Stealth 1</span>
              <Arrow />
              <span className="rounded-lg border border-primary/40 bg-primary/10 backdrop-blur px-4 py-2 text-primary">Privacy Pool</span>
              <Arrow />
              <span className="rounded-lg border border-white/20 bg-white/10 backdrop-blur px-4 py-2 dark:border-white/10">Any 0x address</span>
            </div>
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-10">
          Built with
        </h2>
        <div className="flex flex-wrap justify-center gap-3">
          {[
            "React 19",
            "React Router 7",
            "Vite",
            "Tailwind CSS 4",
            "wagmi 3",
            "RainbowKit",
            "viem",
            "@fluidkey/stealth-account-kit",
            "@unlink-xyz/sdk",
            "Solidity 0.8",
            "Hardhat 3",
            "Deno Deploy",
          ].map((t) => (
            <span
              key={t}
              className="rounded-full border border-white/20 bg-white/10 backdrop-blur px-3 py-1 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/5"
            >
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-6 pb-20 text-center">
        <Button asChild size="lg" className="text-base px-10">
          <Link to="/app">Launch App</Link>
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-card/40 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6 text-sm text-muted-foreground">
          <span>Sneaky &mdash; ETHGlobal Prague 2025</span>
          <a
            href="https://github.com/BlossomLabs/sneaky"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  )
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center text-center gap-4 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-lg p-6 shadow-lg dark:border-white/10 dark:bg-white/5">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-lg shadow-md">
        {number}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  )
}

function ArchCard({ label, title, detail }: { label: string; title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-lg p-6 shadow-lg dark:border-white/10 dark:bg-white/5">
      <span className="text-xs font-medium uppercase tracking-wider text-primary">{label}</span>
      <h3 className="mt-2 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{detail}</p>
    </div>
  )
}

function Arrow() {
  return (
    <svg className="h-4 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 16" stroke="currentColor" strokeWidth={2}>
      <path d="M0 8h20m-6-6 6 6-6 6" />
    </svg>
  )
}
