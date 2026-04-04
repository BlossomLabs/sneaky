import {
  darkTheme,
  lightTheme,
  RainbowKitProvider,
} from "@rainbow-me/rainbowkit"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { type PropsWithChildren, useEffect, useState } from "react"
import colors from "tailwindcss/colors"
import { type State, WagmiProvider } from "wagmi"
import { WALLETCONNECT_CONFIG } from "~/utils/wallet"

type Props = PropsWithChildren<{
  initialState?: State
}>

function RainbowKitThemeWrapper({ children }: PropsWithChildren) {
  const [mounted, setMounted] = useState(false)
  const [prefersDark, setPrefersDark] = useState(false)

  useEffect(() => {
    setMounted(true)
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    setPrefersDark(mq.matches)
    const onChange = () => setPrefersDark(mq.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  const themeToUse = !mounted ? "light" : prefersDark ? "dark" : "light"

  const theme =
    themeToUse === "dark"
      ? darkTheme({
          accentColor: colors.pink[500],
          accentColorForeground: colors.white,
          borderRadius: "small",
          fontStack: "system",
          overlayBlur: "small",
        })
      : lightTheme({
          accentColor: colors.pink[500],
          accentColorForeground: colors.white,
          borderRadius: "small",
          fontStack: "system",
          overlayBlur: "small",
        })
  theme.fonts.body = "var(--font-sans)"

  return (
    <RainbowKitProvider modalSize="compact" theme={theme}>
      {children}
    </RainbowKitProvider>
  )
}

export function WalletProvider({ children, initialState }: Props) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={WALLETCONNECT_CONFIG} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitThemeWrapper>{children}</RainbowKitThemeWrapper>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
