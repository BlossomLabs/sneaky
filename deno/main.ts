/**
 * EIP-3668 CCIP-Read gateway for stealth address resolution via ENS.
 *
 * - Auto-generates a signer key on first start (stored in KV)
 * - Resolves ENS names to fresh stealth addresses (nonce-based rotation)
 * - Signs responses per SignatureVerifier.sol (ENS offchain resolver standard)
 * - Registration requires EIP-191 signature + on-chain ENS ownership proof
 *
 * Run locally:  deno run -A --unstable-kv --env-file=.env main.ts
 * Deno Deploy:  KV is stable — no flag needed.
 */

import { createPublicClient, http, zeroAddress } from "viem";
import type { Address, Hex } from "viem";
import {
  generatePrivateKey,
  HDKey,
  privateKeyToAccount,
  serializeSignature,
  sign,
} from "viem/accounts";
import {
  bytesToString,
  decodeFunctionData,
  encodeAbiParameters,
  encodeFunctionResult,
  encodePacked,
  keccak256,
  parseAbi,
  toBytes,
} from "viem/utils";
import { namehash, normalize } from "viem/ens";
import {
  generateEphemeralPrivateKey,
  generateStealthAddresses,
} from "@fluidkey/stealth-account-kit";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORT = Number(Deno.env.get("PORT") ?? "8080");
const CHAIN_ID = Number(Deno.env.get("CHAIN_ID") ?? "84532");
const CCIP_TTL = Number(Deno.env.get("CCIP_TTL") ?? "300");
const ENS_RPC_URL = Deno.env.get("ENS_RPC_URL");

if (!ENS_RPC_URL) {
  throw new Error(
    "ENS_RPC_URL is required (e.g. https://rpc.ankr.com/eth_sepolia)",
  );
}

// ---------------------------------------------------------------------------
// KV + signer key (auto-generated, persisted in KV)
// ---------------------------------------------------------------------------

const kv = await Deno.openKv();

async function getOrCreateSignerKey(): Promise<`0x${string}`> {
  const entry = await kv.get<string>(["config", "signerPrivateKey"]);
  if (entry.value) return entry.value as `0x${string}`;

  const pk = generatePrivateKey();
  await kv.set(["config", "signerPrivateKey"], pk);
  console.log("Generated new signer key");
  return pk;
}

const signerKey = await getOrCreateSignerKey();
const signerAccount = privateKeyToAccount(signerKey);

// ---------------------------------------------------------------------------
// ENS public client (for ownership checks + signature verification)
// ---------------------------------------------------------------------------

const ensClient = createPublicClient({ transport: http(ENS_RPC_URL) });

const ENS_REGISTRY: Address = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";

// ---------------------------------------------------------------------------
// ABI definitions
// ---------------------------------------------------------------------------

const ENS_REGISTRY_ABI = parseAbi([
  "function owner(bytes32 node) view returns (address)",
]);

const RESOLVER_ABI = parseAbi([
  "function resolve(bytes calldata name, bytes calldata data) view returns (bytes memory)",
]);

const RECORD_ABI = parseAbi([
  "function addr(bytes32 node) view returns (address)",
  "function addr(bytes32 node, uint256 coinType) view returns (bytes memory)",
  "function text(bytes32 node, string key) view returns (string memory)",
  "function contenthash(bytes32 node) view returns (bytes memory)",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isHex(s: unknown): s is Hex {
  return typeof s === "string" && /^0x[0-9a-fA-F]+$/.test(s);
}

function isAddr(s: unknown): s is Address {
  return isHex(s) && (s as string).length === 42;
}

// ---------------------------------------------------------------------------
// DNS wire-format decoder (bytes → dotted ENS name)
// ---------------------------------------------------------------------------

function decodeDnsName(encoded: Hex): string {
  const bytes = toBytes(encoded);
  let offset = 0;
  let result = "";
  while (offset < bytes.length) {
    const len = bytes[offset];
    if (len === 0) break;
    result +=
      bytesToString(bytes.subarray(offset + 1, offset + len + 1)) + ".";
    offset += len + 1;
  }
  return result.replace(/\.$/, "");
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserData {
  spendingPublicKey: Hex;
  viewingKeyNode: string; // base58 xprv
  owner: Address;
}

// ---------------------------------------------------------------------------
// Stealth address generation (atomic nonce increment)
// ---------------------------------------------------------------------------

const MAX_RETRIES = 5;

async function generateStealth(name: string): Promise<Address | null> {
  const entry = await kv.get<UserData>(["users", name]);
  if (!entry.value) return null;

  for (let i = 0; i < MAX_RETRIES; i++) {
    const nonceEntry = await kv.get<Deno.KvU64>(["nonces", name]);
    const nonce = nonceEntry.value?.value ?? 0n;

    const viewingNode = HDKey.fromExtendedKey(entry.value.viewingKeyNode);
    const { ephemeralPrivateKey } = generateEphemeralPrivateKey({
      viewingPrivateKeyNode: viewingNode,
      nonce,
      chainId: CHAIN_ID,
    });

    const { stealthAddresses } = generateStealthAddresses({
      spendingPublicKeys: [entry.value.spendingPublicKey],
      ephemeralPrivateKey,
    });

    const commit = await kv
      .atomic()
      .check(nonceEntry)
      .set(["nonces", name], new Deno.KvU64(nonce + 1n))
      .commit();

    if (commit.ok) {
      console.log(`Resolved ${name} nonce=${nonce} → ${stealthAddresses[0]}`);
      return stealthAddresses[0] as Address;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// CCIP-Read response signing (per SignatureVerifier.sol)
// ---------------------------------------------------------------------------

async function signCcipResponse(
  sender: Address,
  requestData: Hex,
  result: Hex,
): Promise<Hex> {
  const validUntil = BigInt(Math.floor(Date.now() / 1000) + CCIP_TTL);

  const messageHash = keccak256(
    encodePacked(
      ["bytes", "address", "uint64", "bytes32", "bytes32"],
      [
        "0x1900",
        sender,
        validUntil,
        keccak256(requestData),
        keccak256(result),
      ],
    ),
  );

  const sig = await sign({ hash: messageHash, privateKey: signerKey });

  return encodeAbiParameters(
    [
      { name: "result", type: "bytes" },
      { name: "expires", type: "uint64" },
      { name: "sig", type: "bytes" },
    ],
    [result, validUntil, serializeSignature(sig)],
  );
}

// ---------------------------------------------------------------------------
// GET /signer — public endpoint to retrieve the signer address
// ---------------------------------------------------------------------------

function handleSigner(): Response {
  return json({ address: signerAccount.address });
}

// ---------------------------------------------------------------------------
// POST /register — auth'd registration keyed by ENS name
// ---------------------------------------------------------------------------

async function handleRegister(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "Invalid JSON" }, 400);

  const { name, address, signature, spendingPublicKey, viewingKeyNode } = body;

  if (typeof name !== "string" || !name.includes("."))
    return json({ error: "Invalid ENS name" }, 400);
  if (!isAddr(address))
    return json({ error: "Invalid address" }, 400);
  if (!isHex(signature))
    return json({ error: "Invalid signature" }, 400);
  if (!isHex(spendingPublicKey))
    return json({ error: "Invalid spendingPublicKey" }, 400);
  if (
    typeof viewingKeyNode !== "string" ||
    !viewingKeyNode.startsWith("xprv")
  )
    return json(
      { error: "viewingKeyNode must be a base58 xprv string" },
      400,
    );

  try {
    HDKey.fromExtendedKey(viewingKeyNode);
  } catch {
    return json({ error: "Cannot parse viewingKeyNode" }, 400);
  }

  let norm: string;
  try {
    norm = normalize(name);
  } catch {
    return json({ error: "Invalid ENS name (normalization failed)" }, 400);
  }

  // Step 1: Verify EIP-191 signature proves ownership of the claimed address
  const message = `Register ${norm} on SecretHandshake`;
  const valid = await ensClient.verifyMessage({
    address: address as Address,
    message,
    signature: signature as Hex,
  });
  if (!valid) return json({ error: "Signature verification failed" }, 403);

  // Step 2: Check on-chain ENS name ownership
  const node = namehash(norm);
  let ensOwner: Address;
  try {
    ensOwner = await ensClient.readContract({
      address: ENS_REGISTRY,
      abi: ENS_REGISTRY_ABI,
      functionName: "owner",
      args: [node],
    });
  } catch (e) {
    console.error("ENS Registry lookup failed:", e);
    return json({ error: "ENS ownership check failed" }, 502);
  }

  if (
    ensOwner !== zeroAddress &&
    ensOwner.toLowerCase() !== (address as string).toLowerCase()
  ) {
    return json({ error: "Not the on-chain ENS name owner" }, 403);
  }

  // Prevent hijacking: if already registered by a different address, reject
  const existing = await kv.get<UserData>(["users", norm]);
  if (
    existing.value &&
    existing.value.owner.toLowerCase() !== (address as string).toLowerCase()
  ) {
    return json(
      { error: "Name already registered by another address" },
      409,
    );
  }

  const commit = await kv
    .atomic()
    .set(["users", norm], {
      spendingPublicKey,
      viewingKeyNode,
      owner: (address as string).toLowerCase() as Address,
    } satisfies UserData)
    .set(["nonces", norm], new Deno.KvU64(0n))
    .commit();

  if (!commit.ok) return json({ error: "KV commit failed" }, 500);

  console.log(`Registered ${norm} (owner: ${address})`);
  return json({ ok: true, name: norm });
}

// ---------------------------------------------------------------------------
// CCIP-Read gateway — handles both POST / and GET /:sender/:data.json
// ---------------------------------------------------------------------------

async function handleCcipRead(
  sender: string,
  data: string,
): Promise<Response> {
  if (!isAddr(sender) || !isHex(data))
    return json({ error: "Invalid request format" }, 400);

  // Decode outer: resolve(bytes name, bytes data)
  let dnsName: Hex, innerData: Hex;
  try {
    const decoded = decodeFunctionData({
      abi: RESOLVER_ABI,
      data: data as Hex,
    });
    [dnsName, innerData] = decoded.args;
  } catch {
    return json({ error: "Cannot decode resolve() calldata" }, 400);
  }

  const name = decodeDnsName(dnsName);

  // Decode inner query (addr / text / contenthash)
  let query: { functionName: string; args: readonly unknown[] };
  try {
    query = decodeFunctionData({ abi: RECORD_ABI, data: innerData });
  } catch {
    return json(
      { error: `Unsupported record query (${innerData.slice(0, 10)})` },
      400,
    );
  }

  let fnResult: Hex;

  switch (query.functionName) {
    case "addr": {
      const hasCoinType = query.args.length > 1;
      const coinType = hasCoinType ? (query.args[1] as bigint) : 60n;

      const stealthAddr =
        coinType === 60n ? await generateStealth(name) : null;
      const resolved = stealthAddr ?? (zeroAddress as Address);

      if (hasCoinType) {
        const abi = RECORD_ABI.find(
          (a) => a.name === "addr" && a.inputs.length === 2,
        )!;
        fnResult = encodeFunctionResult({
          abi: [abi],
          functionName: "addr",
          result: coinType === 60n ? (resolved as Hex) : ("0x" as Hex),
        });
      } else {
        const abi = RECORD_ABI.find(
          (a) => a.name === "addr" && a.inputs.length === 1,
        )!;
        fnResult = encodeFunctionResult({
          abi: [abi],
          functionName: "addr",
          result: resolved,
        });
      }
      break;
    }

    case "text": {
      const abi = RECORD_ABI.find((a) => a.name === "text")!;
      fnResult = encodeFunctionResult({
        abi: [abi],
        functionName: "text",
        result: "",
      });
      break;
    }

    case "contenthash": {
      const abi = RECORD_ABI.find((a) => a.name === "contenthash")!;
      fnResult = encodeFunctionResult({
        abi: [abi],
        functionName: "contenthash",
        result: "0x" as Hex,
      });
      break;
    }

    default:
      return json(
        { error: `Unsupported query: ${query.functionName}` },
        400,
      );
  }

  const signed = await signCcipResponse(
    sender as Address,
    data as Hex,
    fnResult,
  );
  return json({ data: signed });
}

// ---------------------------------------------------------------------------
// GET /status/:name
// ---------------------------------------------------------------------------

async function handleStatus(rawName: string): Promise<Response> {
  let norm: string;
  try {
    norm = normalize(rawName);
  } catch {
    norm = rawName.toLowerCase();
  }

  const entry = await kv.get<UserData>(["users", norm]);
  if (!entry.value) return json({ registered: false });

  const nonceEntry = await kv.get<Deno.KvU64>(["nonces", norm]);

  return json({
    registered: true,
    name: norm,
    owner: entry.value.owner,
    nonce: Number(nonceEntry.value?.value ?? 0n),
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // GET /signer
  if (url.pathname === "/signer" && req.method === "GET") {
    return handleSigner();
  }

  // POST /register
  if (url.pathname === "/register" && req.method === "POST") {
    return handleRegister(req);
  }

  // POST / — CCIP-Read (EIP-3668)
  if (url.pathname === "/" && req.method === "POST") {
    const body = await req.json().catch(() => null);
    if (!body) return json({ error: "Invalid JSON" }, 400);
    return handleCcipRead(body.sender, body.data);
  }

  // GET /:sender/:data.json — CCIP-Read (EIP-3668)
  const ccipGet = url.pathname.match(
    /^\/(0x[0-9a-fA-F]{40})\/(0x[0-9a-fA-F]+)\.json$/,
  );
  if (ccipGet && req.method === "GET") {
    return handleCcipRead(ccipGet[1], ccipGet[2]);
  }

  // GET /status/:name
  const statusMatch = url.pathname.match(/^\/status\/(.+)$/);
  if (statusMatch && req.method === "GET") {
    return handleStatus(decodeURIComponent(statusMatch[1]));
  }

  return new Response("Not Found", { status: 404, headers: corsHeaders });
}

Deno.serve({ port: PORT }, async (req) => {
  try {
    return await handleRequest(req);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error(err);
    return json({ error: err.message }, 500);
  }
});

console.log(
  `Stealth CCIP-Read gateway on :${PORT}  chainId=${CHAIN_ID}  signer=${signerAccount.address}`,
);
