import { answerPlan } from "@/lib/zarvis/depth";
import { zarvisConfig } from "@/lib/zarvis/config";
import { readChatRequest, sameOrigin } from "@/lib/zarvis/validation";
import { reserveZarvisRequest } from "@/lib/zarvis/usage";
import { generateAnswer } from "@/lib/zarvis/openai";
import { acquireGeneration, recordGeneration, recordRejection, feedbackTicket } from "@/lib/zarvis/metrics";
import { GenerationFailure, classifyError, type ErrorClass } from "@/lib/zarvis/errors";
import { logChatRequest, logRejection, type ChatOutcome } from "@/lib/zarvis/observe";
import { queueTopic, spendTodayUsd } from "@/lib/zarvis/metrics-store";
import { conversationTopic } from "@/lib/zarvis/topics";
import { answerLanguage, directLanguage, type DirectLanguage } from "@/lib/zarvis/language";
import { voiceConfig } from "@/lib/zarvis/voice";
import { xResearchConfig } from "@/lib/zarvis/x-research-config";
import type { ZarvisEvent } from "@/lib/zarvis/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const fail = (error: string, status: number, extra = {}) => Response.json({ error }, { status, headers: { ...headers, ...extra } });
const USAGE_LIMIT = "Zarvis has reached a usage limit. Please try again later; the public sources remain available.";
const SPEND_CAP = "Zarvis has reached today's limit for model-assisted answers. Questions the public records answer directly still work, and the sources remain available.";

export function GET() {
  const config = zarvisConfig();
  return Response.json({ available: config.enabled, provider: config.providerLabel, webSearch: config.webSearch, voice: config.enabled && voiceConfig().enabled, ...(config.enabled && xResearchConfig().enabled ? { xResearch: true } : {}) }, { headers });
}

export async function POST(request: Request) {
  const started = performance.now();
  const reject = (outcome: ChatOutcome, error: string, status: number, extra = {}) => { logRejection(outcome, performance.now() - started); return fail(error, status, extra); };
  if (!sameOrigin(request)) { recordRejection("forbidden"); return reject("forbidden", "Please open Zarvis on OpenZcash to ask a question.", 403); }
  const config = zarvisConfig();
  if (!config.enabled) return reject("disabled", "Zarvis is being connected. Please explore the sources or try again later.", 503);
  let input;
  try { input = await readChatRequest(request); }
  catch { recordRejection("invalid"); return reject("invalid", "Send a question of up to 2,000 characters. Start a new chat if this conversation is too long.", 400); }
  // Over the estimated-spend ceiling the provider is off limits (also during a quota pause); zero-cost direct answers still go through.
  const capped = typeof config.dailyUsdCap === "number" && spendTodayUsd() >= config.dailyUsdCap;
  const release = acquireGeneration();
  if (!release) return reject("busy", "Zarvis is busy. Please try again shortly.", 429, { "Retry-After": "5" });
  let refund: (() => Promise<boolean>) | undefined;
  try {
    const allowance = await reserveZarvisRequest(request.headers);
    if (!allowance.allowed) { release(); recordRejection("quota"); return reject("quota", USAGE_LIMIT, 429, { "Retry-After": String(allowance.retryAfter) }); }
    refund = allowance.refund;
  } catch { release(); recordRejection("storage"); return reject("storage", "Zarvis is temporarily unavailable. Please try again shortly.", 503); }
  const controller = new AbortController();
  const abort = () => controller.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  if (request.signal.aborted) controller.abort();
  const plan = answerPlan(input.messages, input.depth);
  const timeout = setTimeout(abort, plan.timeoutMs);
  const encoder = new TextEncoder();
  // Two labels join the log line: a topic from the fixed taxonomy and the answer language the pipeline stamped on `done` (a failure before `done` is labelled by the question's own words). The question itself never leaves this handler.
  let language: DirectLanguage | null = null;
  const labels = () => { const lang = language ?? directLanguage(answerLanguage(input.messages, input.session)); return { topic: conversationTopic(input.messages, lang), lang }; };
  const stream = new ReadableStream<Uint8Array>({
    async start(out) {
      const emit = (event: ZarvisEvent) => { if (event.type === "done") language = event.provenance.language; if (!controller.signal.aborted) out.enqueue(encoder.encode(`${JSON.stringify(event.type === "done" ? { ...event, feedbackToken: feedbackTicket(Date.now(), event.provenance.route) } : event)}\n`)); };
      try {
        emit({ type: "status", message: "Finding the right sources…" });
        const metrics = await generateAnswer(input.messages, controller.signal, emit, input.session, input.depth, { localOnly: capped });
        const ms = performance.now() - started;
        // Bookkeeping after the answer is delivered must never turn a finished answer into an error event.
        try {
          // A direct answer called no model: the quota unit goes back, so only model answers count against the visitor.
          if (metrics?.route === "local" && metrics.modelCalls === 0 && refund) void refund();
          const estimatedUsd = recordGeneration("completed", ms, metrics);
          const tagged = labels(); queueTopic(metrics.route, tagged.topic, tagged.lang);
          logChatRequest({ at: new Date().toISOString(), route: metrics.route, outcome: "completed", depth: metrics.depth ?? plan.depth, ms: Math.round(ms), modelCalls: metrics.modelCalls, webSearchCalls: metrics.webSearchCalls, webFetchCalls: metrics.webFetchCalls, inputTokens: metrics.inputTokens, cachedInputTokens: metrics.cachedInputTokens, outputTokens: metrics.outputTokens, groundingFallbacks: metrics.groundingFallbacks ?? 0, repairRounds: metrics.repairRounds ?? 0, estimatedUsd, errorClass: null, ...tagged });
        } catch { /* counters only */ }
      } catch (error) {
        const ms = performance.now() - started;
        const declined = capped && !request.signal.aborted && error instanceof GenerationFailure && error.errorClass === "model_required";
        if (declined) { recordRejection("spendCap"); logRejection("spend_cap", ms); }
        else {
          const outcome = request.signal.aborted ? "aborted" : "failed";
          // A fixed class only: the provider message, body and stack never reach the log or the client.
          const errorClass: ErrorClass = request.signal.aborted ? "aborted" : controller.signal.aborted ? "deadline" : classifyError(error);
          const usage = error instanceof GenerationFailure ? error.usage : undefined;
          const estimatedUsd = recordGeneration(outcome, ms, usage, errorClass);
          const tagged = labels(); queueTopic(usage?.route ?? "model", tagged.topic, tagged.lang);
          logChatRequest({ at: new Date().toISOString(), route: usage?.route ?? "model", outcome, depth: usage?.depth ?? plan.depth, ms: Math.round(ms), modelCalls: usage?.modelCalls ?? 0, webSearchCalls: usage?.webSearchCalls ?? 0, webFetchCalls: usage?.webFetchCalls ?? 0, inputTokens: usage?.inputTokens ?? 0, cachedInputTokens: usage?.cachedInputTokens ?? 0, outputTokens: usage?.outputTokens ?? 0, groundingFallbacks: usage?.groundingFallbacks ?? 0, repairRounds: usage?.repairRounds ?? 0, estimatedUsd, errorClass, ...tagged });
        }
        if (!request.signal.aborted) {
          const message = declined ? SPEND_CAP : controller.signal.aborted ? (plan.depth === "deep" ? "This analysis reached its time limit. Try a narrower question." : "This answer reached its time limit. Try a narrower question or choose Deep analysis.") : "Zarvis could not finish this answer. Please retry in a moment.";
          try { out.enqueue(encoder.encode(`${JSON.stringify({ type: "error", message })}\n`)); } catch { /* disconnected */ }
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
