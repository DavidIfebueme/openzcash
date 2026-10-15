/** Nym client address: identity[.encryption]@gateway, base58. Keep this pattern identical in scripts/private-chat-nym-worker.js. */
const NYM_ADDRESS =
  /^[1-9A-HJ-NP-Za-km-z]{20,200}(?:\.[1-9A-HJ-NP-Za-km-z]{20,200})?@[1-9A-HJ-NP-Za-km-z]{20,200}$/;

export function isNymAddress(value: string): boolean {
  return NYM_ADDRESS.test(value);
}
