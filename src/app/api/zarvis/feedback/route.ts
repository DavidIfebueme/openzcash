import { sameOrigin } from "@/lib/zarvis/validation";
import { readBoundedJson } from "@/lib/zarvis/request-body";
import { recordFeedback } from "@/lib/zarvis/metrics";
import { z } from "zod";
const schema = z.object({ ticket: z.string().max(400), helpful: z.boolean() }).strict();
export async function POST(request: Request) {
  const respond = (status: number) => new Response(null, { status, headers: { "Cache-Control": "no-store" } });
  if (!sameOrigin(request)) return respond(403);
  try {
    const data = schema.safeParse(await readBoundedJson(request, 1024));
    if (!data.success) return respond(400);
    return respond(recordFeedback(data.data.ticket, data.data.helpful) ? 204 : 409);
  } catch { return respond(400); }
}
