import { generateFluidkeyMessage } from "@fluidkey/stealth-account-kit"
import type { Address } from "viem"

export function generateSneakyMessage(params: {
  pin: string
  address: Address
}) {
  const { message } = generateFluidkeyMessage(params)
  return { message: message.replace("Fluidkey", "Sneaky") }
}
