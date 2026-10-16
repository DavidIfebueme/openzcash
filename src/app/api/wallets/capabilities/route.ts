import { WALLET_EVIDENCE } from "@/lib/wallet-finder/evidence";

/** Public reusable evidence only. No answers, accounts, balances, or telemetry. */
export function GET() {
  return Response.json({
    schemaVersion: 1,
    license: "MIT",
    matchingPolicy: "All required capabilities must be supported on one available platform. Unknown is never supported.",
    definitions: {
      hardwareSigning: "External hardware signer integration for software; on-device signing for hardware wallets.",
      multichain: "Manage native assets on more than one blockchain. Cross-chain payments or swaps alone do not establish this capability.",
      checkedAt: "Date the cited material was checked; not a guarantee of continued support.",
    },
    profiles: WALLET_EVIDENCE,
  }, { headers: { "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" } });
}
