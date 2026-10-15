import { isNymAddress } from "./nym-address";
import { isPublicKey } from "./keys";
export type ChatEnvironment = Record<string, string | undefined>;
export function gatewayOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "wss:" && !url.username && !url.password &&
      url.pathname === "/" && !url.search && !url.hash ? url.origin : null;
  } catch { return null; }
}
export function chatOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      url.pathname === "/" && !url.search && !url.hash ? url.origin : null;
  } catch { return null; }
}
export function validGatewayIdentity(value: string | undefined): boolean {
  return typeof value === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(value);
}
/** Production-mode builds require an explicitly configured pilot. */
export function pilotDeployment(env: ChatEnvironment = process.env) {
  if (env.PRIVATE_CHAT_DEPLOYMENT !== "pilot" ||
      env.NEXT_PUBLIC_PRIVATE_CHAT_PILOT !== "true") return null;
  const origin = chatOrigin(env.PRIVATE_CHAT_ORIGIN);
  const gateway = gatewayOrigin(env.NEXT_PUBLIC_PRIVATE_CHAT_GATEWAY_ORIGIN);
  const address = env.PRIVATE_CHAT_DIRECTORY_ADDRESS;
  const publicKey = env.PRIVATE_CHAT_DIRECTORY_PUBLIC_KEY;
  if (!origin || !gateway || !validGatewayIdentity(env.NEXT_PUBLIC_PRIVATE_CHAT_GATEWAY_ID) ||
      !address || !isNymAddress(address) || !publicKey || !isPublicKey(publicKey)) return null;
  return { origin, gateway, directory: { address, publicKey, replyMode: "surb" as const } };
}
export function chatEnabled(env: ChatEnvironment = process.env): boolean {
  return env.NODE_ENV === "development"
    ? env.NEXT_PUBLIC_PRIVATE_CHAT_PREVIEW === "true"
    : env.NODE_ENV === "production" && pilotDeployment(env) !== null;
}
