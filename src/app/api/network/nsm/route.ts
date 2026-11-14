/**
 * The NSM value balance for the /nsm live feed: the balance consensus holds
 * out of circulation, recent fee splits and the reissuance schedule, read
 * from the public node feed through its 30-second cache. Read-only, no input.
 */
import { NextResponse } from "next/server";
import { getNsmSnapshot } from "@/lib/network/nsm";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getNsmSnapshot().catch(() => null);
  if (!snapshot) {
    return NextResponse.json(
      { error: "NSM balance unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(snapshot, {
    headers: { "Cache-Control": "no-store" },
  });
}
