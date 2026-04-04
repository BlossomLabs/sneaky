import { useCallback, useEffect, useState } from "react"

const STORAGE_KEY = "sneaky-dark-mode"

export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) return stored === "true"
    return window.matchMedia("(prefers-color-scheme: dark)").matches
  })

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark)
    localStorage.setItem(STORAGE_KEY, String(isDark))
  }, [isDark])

  const toggle = useCallback(() => setIsDark((d) => !d), [])

  return { isDark, toggle }
}
