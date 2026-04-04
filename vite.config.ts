import { createRequire } from "node:module"
import { reactRouter } from "@react-router/dev/vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import tsconfigPaths from "vite-tsconfig-paths"

function resolveBlake2b() {
  const require = createRequire(import.meta.url)
  try {
    return require
      .resolve("@zk-kit/eddsa-poseidon/blake-2b")
      .replace("lib.commonjs", "lib.esm")
      .replace(".cjs", ".js")
  } catch {
    const sdkRequire = createRequire(require.resolve("@unlink-xyz/sdk"))
    return sdkRequire
      .resolve("@zk-kit/eddsa-poseidon/blake-2b")
      .replace("lib.commonjs", "lib.esm")
      .replace(".cjs", ".js")
  }
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
  ],
  resolve: {
    alias: {
      "@zk-kit/eddsa-poseidon/blake-2b": resolveBlake2b(),
      // https://github.com/remix-run/react-router/issues/12568#issuecomment-2625776697
      ...("Deno" in globalThis && { "react-dom/server": "react-dom/server.node" }),
    },
  },
  define: {
    global: "globalThis",
  },
  server: {
    port: 3000,
  },
})
