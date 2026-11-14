import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runCollectorCycle } from "@/lib/services/poll-reconcile";

const DEV_INTERNAL_SECRET = "zcap-dev-internal-secret";

function isAuthorizedInternalRequest(request: Request) {
  const secret =
    process.env.ZCAP_INTERNAL_SECRET ??
    (process.env.NODE_ENV !== "production"
      ? DEV_INTERNAL_SECRET
      : undefined);

  if (!secret) {
    throw new Error("ZCAP_INTERNAL_SECRET is required");
  }

  const provided = request.headers.get("x-zcap-internal-secret") ?? "";
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(secret, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!isAuthorizedInternalRequest(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const result = await runCollectorCycle();
  return NextResponse.json(result);
}
