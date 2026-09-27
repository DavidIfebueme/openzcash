import { sameOrigin } from "@/lib/zarvis/validation";
import { recordFeedback } from "@/lib/zarvis/metrics";
import { z } from "zod";
const schema = z.object({ ticket: z.string().max(400), helpful: z.boolean() }).strict();
export async function POST(request: Request) {
  const respond = (status: number) => new Response(null, { status, headers: { "Cache-Control": "no-store" } });
  if (!sameOrigin(request) || !request.headers.get("content-type")?.startsWith("application/json")) return respond(403);
  if (Number(request.headers.get("content-length")) > 1024 || !request.body) return respond(400);
  const reader = request.body.getReader(); let bytes = 0; let text = ""; const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength; if (bytes > 1024) { await reader.cancel(); return respond(400); }
      text += decoder.decode(value, { stream: true });
    }
    const data = schema.safeParse(JSON.parse(text + decoder.decode()));
    if (!data.success) return respond(400);
    return respond(recordFeedback(data.data.ticket, data.data.helpful) ? 204 : 409);
  } catch { return respond(400); } finally { reader.releaseLock(); }
}
