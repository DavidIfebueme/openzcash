import { NextRequest, NextResponse } from "next/server";
import { getNetworkSnapshot } from "@/lib/network/provider";
import type { NetworkPeriod } from "@/lib/network/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get("period") ?? "day";
  if (!["day", "week", "month"].includes(period)) {
    return NextResponse.json({ error: "Invalid network period" }, { status: 400 });
  }
  const snapshot = await getNetworkSnapshot(period as NetworkPeriod);
  return NextResponse.json(snapshot, {
    status: snapshot.status === "unavailable" ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
