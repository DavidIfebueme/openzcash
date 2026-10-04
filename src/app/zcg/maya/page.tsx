import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Pool liquidity is part of the Observatory's market coverage.
export default function MayaRedirect() {
  permanentRedirect("/zec-observatory#liquidity");
}
