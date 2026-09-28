import { answerPlan } from "@/lib/zarvis/depth";
import { zarvisConfig } from "@/lib/zarvis/config";
import { readChatRequest, sameOrigin } from "@/lib/zarvis/validation";
import { reserveZarvisRequest } from "@/lib/zarvis/usage";
import { generateAnswer } from "@/lib/zarvis/openai";
import { acquireGeneration, recordGeneration, feedbackTicket } from "@/lib/zarvis/metrics";
import type { ZarvisEvent } from "@/lib/zarvis/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const fail = (error: string, status: number, extra = {}) => Response.json({ error }, { status, headers: { ...headers, ...extra } });

export function GET() {
  const config = zarvisConfig();
  return Response.json({ available: config.enabled, provider: config.providerLabel, webSearch: config.webSearch }, { headers });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail("Please open Zarvis on OpenZcash to ask a question.", 403);
  if (!zarvisConfig().enabled) return fail("Zarvis is being connected. Please explore the sources or try again later.", 503);
  let input;
  try { input = await readChatRequest(request); }
  catch { return fail("Send a question of up to 2,000 characters. Start a new chat if this conversation is too long.", 400); }
  const release = acquireGeneration();
  if (!release) return fail("Zarvis is busy. Please try again shortly.", 429, { "Retry-After": "5" });
  try {
    const allowance = await reserveZarvisRequest(request.headers);
    if (!allowance.allowed) { release(); return fail("Zarvis has reached a usage limit. Please try again later; the public sources remain available.", 429, { "Retry-After": String(allowance.retryAfter) }); }
  } catch { release(); return fail("Zarvis is temporarily unavailable. Please try again shortly.", 503); }
  const started = performance.now();
  const controller = new AbortController();
  const abort = () => controller.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  if (request.signal.aborted) controller.abort();
  const plan = answerPlan(input.messages, input.depth);
  const timeout = setTimeout(abort, plan.timeoutMs);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(out) {
      const emit = (event: ZarvisEvent) => { if (!controller.signal.aborted) out.enqueue(encoder.encode(`${JSON.stringify(event.type === "done" ? { ...event, feedbackToken: feedbackTicket() } : event)}\n`)); };
      try {
        emit({ type: "status", message: "Finding the right sources…" });
        const metrics = await generateAnswer(input.messages, controller.signal, emit, input.session, input.depth);
        recordGeneration("completed", performance.now() - started, metrics);
        // Opt-in local diagnostics: counts only, never questions, answers, IDs or credentials.
        if (process.env.NODE_ENV === "development" && process.env.ZARVIS_DIAGNOSTICS === "true") console.info("Zarvis metrics", JSON.stringify(metrics));
      } catch {
        recordGeneration(request.signal.aborted ? "aborted" : "failed", performance.now() - started);
        // Never send provider errors, credentials, prompts or stack traces to the client/logs.
        if (!request.signal.aborted) {
          try { out.enqueue(encoder.encode(`${JSON.stringify({ type: "error", message: controller.signal.aborted ? (plan.depth === "deep" ? "This analysis reached its time limit. Try a narrower question." : "This answer reached its time limit. Try a narrower question or choose Deep analysis.") : "Zarvis could not finish this answer. Please retry in a moment." })}\n`)); } catch { /* disconnected */ }
        }
      } finally {
        release();
        clearTimeout(timeout); request.signal.removeEventListener("abort", abort);
        try { out.close(); } catch { /* client already disconnected */ }
      }
    },
    cancel() { controller.abort(); release(); clearTimeout(timeout); request.signal.removeEventListener("abort", abort); },
  });
  return new Response(stream, { headers: { ...headers, "Content-Type": "application/x-ndjson; charset=utf-8", "X-Accel-Buffering": "no" } });
}
