import type { Address, Hex } from "viem"

const DEFAULT_GATEWAY_URL = "https://sneakey.blossom.deno.net"

export function getGatewayUrl(): string {
  const url = import.meta.env.VITE_GATEWAY_URL ?? DEFAULT_GATEWAY_URL
  return url.replace(/\/$/, "")
}

export interface SignerResponse {
  address: Address
}

export async function fetchSigner(): Promise<SignerResponse> {
  const res = await fetch(`${getGatewayUrl()}/signer`)
  if (!res.ok) throw new Error(`GET /signer failed: ${res.status}`)
  return res.json()
}

export interface StatusResponse {
  registered: boolean
  name?: string
  owner?: Address
  nonce?: number
}

export async function fetchStatus(name: string): Promise<StatusResponse> {
  const res = await fetch(
    `${getGatewayUrl()}/status/${encodeURIComponent(name)}`,
  )
  if (!res.ok) throw new Error(`GET /status failed: ${res.status}`)
  return res.json()
}

export interface RegisterBody {
  name: string
  address: Address
  signature: Hex
  spendingPublicKey: Hex
  viewingKeyNode: string
  previousResolver?: Address
}

export interface RegisterResponse {
  ok?: boolean
  name?: string
  error?: string
}

export interface DeregisterBody {
  name: string
  address: Address
  signature: Hex
}

export interface DeregisterResponse {
  ok?: boolean
  previousResolver?: Address
  error?: string
}

export async function postDeregister(
  body: DeregisterBody,
): Promise<DeregisterResponse> {
  const res = await fetch(`${getGatewayUrl()}/deregister`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data: DeregisterResponse = await res.json()
  if (!res.ok) throw new Error(data.error ?? `POST /deregister failed: ${res.status}`)
  return data
}

export async function postRegister(
  body: RegisterBody,
): Promise<RegisterResponse> {
  const res = await fetch(`${getGatewayUrl()}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data: RegisterResponse = await res.json()
  if (!res.ok) throw new Error(data.error ?? `POST /register failed: ${res.status}`)
  return data
}
