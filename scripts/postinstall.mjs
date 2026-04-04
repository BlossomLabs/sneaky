import { readFileSync, writeFileSync } from "node:fs";

const file = "node_modules/@unlink-xyz/sdk/dist/index.js";
let code = readFileSync(file, "utf8");

code = code
  .replace(
    'const { createRequire } = await import("module");',
    "// patched for browser compat",
  )
  .replace("const require2 = createRequire(import.meta.url);", "")
  .replace(
    'return require2("@zk-kit/eddsa-poseidon/blake-2b");',
    'return await import("@zk-kit/eddsa-poseidon/blake-2b");',
  );

writeFileSync(file, code);
