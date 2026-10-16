import { readEcosystemState } from "@/lib/ecosystem/data";
import { ECOSYSTEM_TIME_ZONE } from "@/lib/ecosystem/checkpoint";

export async function GET() {
  const { catalog, source, available, checkpoint } = await readEcosystemState();
  const lease = checkpoint?.lease;
  return Response.json({
    schedule: "daily", timeZone: ECOSYSTEM_TIME_ZONE,
    paused: process.env.DISABLE_AUTO_REFRESH === "true", source, storeAvailable: available,
    collectedAt: catalog.snapshot.collectedAt, repositories: catalog.snapshot.repositories.length,
    successfulDay: checkpoint?.successfulDay ?? null, lastAttemptAt: checkpoint?.lastAttemptAt ?? null,
    lastSuccessAt: checkpoint?.lastSuccessAt ?? null, outcome: checkpoint?.outcome ?? null,
    nextRetryAt: checkpoint?.nextRetryAt ?? null, running: Boolean(lease && Date.parse(lease.expiresAt) > Date.now()),
  }, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
