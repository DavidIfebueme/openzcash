import { gatewayOrigin, type ChatEnvironment } from "./deployment";
import { chatParentOrigin } from "./embedding";
/** Scoped to the chat and its worker; never expands the portal CSP. */
export function chatCsp(env: ChatEnvironment, nonce?: string, embedded = false): string {
  const development = env.NODE_ENV === "development";
  const gateway = gatewayOrigin(env.NEXT_PUBLIC_PRIVATE_CHAT_GATEWAY_ORIGIN);
  const enabled = development
    ? env.NEXT_PUBLIC_PRIVATE_CHAT_PREVIEW === "true"
    : env.PRIVATE_CHAT_DEPLOYMENT === "pilot" &&
      env.NEXT_PUBLIC_PRIVATE_CHAT_PILOT === "true" && gateway !== null;
  const connections = enabled
    ? " https://validator.nymtech.net " + (gateway ?? "wss:") : "";
  const script = nonce ? "'self' 'nonce-" + nonce + "' 'strict-dynamic'" : "'self'";
  return [
    "default-src 'none'",
    "script-src " + script + " 'wasm-unsafe-eval'" + (development ? " 'unsafe-eval'" : ""),
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data:", "font-src 'self'",
    "connect-src 'self'" + connections, "worker-src 'self'", "frame-src 'none'",
    "frame-ancestors " + (embedded ? chatParentOrigin(env) : "'none'"),
    "object-src 'none'", "base-uri 'none'", "form-action 'none'",
  ].join("; ");
}
