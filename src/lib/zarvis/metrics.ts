import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { GenerationMetrics } from "./openai";

const latencyBounds = [250, 1000, 3000, 5000, 10000, 20000, 40000, 60000, Infinity];
const empty = () => ({ since: new Date().toISOString(), completed: 0, failed: 0, aborted: 0, busy: 0, local: 0, model: 0, modelCalls: 0, webSearchCalls: 0, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, unreportedUsage: 0, groundingFallbacks: 0, estimatedModelUsd: 0, unpricedRequests: 0, helpful: 0, unhelpful: 0, latency: latencyBounds.map(() => 0) });
type MetricsState = { totals: ReturnType<typeof empty>; active: number; lastLog: number; usedFeedback: Map<string, number>; localKey: Buffer };
const globalState = globalThis as typeof globalThis & { __zarvisMetricsV1?: MetricsState };
const state = globalState.__zarvisMetricsV1 ??= { totals: empty(), active: 0, lastLog: Date.now(), usedFeedback: new Map(), localKey: randomBytes(32) };
const feedbackKey = () => process.env.OPENAI_API_KEY || process.env.XAI_API_KEY || state.localKey;
const mac = (payload: string) => createHmac("sha256", feedbackKey()).update(`zarvis-feedback:${payload}`).digest();
export function feedbackTicket(now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ nonce: randomBytes(12).toString("hex"), expires: now + 3600000 })).toString("base64url");
  return `${payload}.${mac(payload).toString("base64url")}`;
}
export function recordFeedback(ticket: string, helpful: boolean, now = Date.now()) {
  try {
    if (ticket.length > 400) return false;
    const parts = ticket.split("."); if (parts.length !== 2) return false;
    const signature = Buffer.from(parts[1], "base64url"), expected = mac(parts[0]);
    if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return false;
    const data = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    if (!/^[a-f0-9]{24}$/.test(data.nonce) || !Number.isSafeInteger(data.expires) || data.expires <= now || data.expires > now + 3600000) return false;
    for (const [nonce, expiry] of state.usedFeedback) if (expiry <= now) state.usedFeedback.delete(nonce);
    if (state.usedFeedback.has(data.nonce) || state.usedFeedback.size >= 10000) return false;
    state.usedFeedback.set(data.nonce, data.expires);
    if (helpful) state.totals.helpful++; else state.totals.unhelpful++;
    flushMetrics(); return true;
  } catch { return false; }
}
export function acquireGeneration() {
  const configured = Number(process.env.ZARVIS_MAX_CONCURRENT ?? 8);
  const max = Number.isInteger(configured) && configured > 0 ? Math.min(configured, 32) : 8;
  if (state.active >= max) { state.totals.busy++; flushMetrics(); return null; }
  state.active++; let released = false;
  return () => { if (!released) { state.active--; released = true; } };
}
export function recordGeneration(outcome: "completed" | "failed" | "aborted", ms: number, metrics?: GenerationMetrics) {
  state.totals[outcome]++;
  if (outcome !== "completed") state.totals.unpricedRequests++;
  if (outcome === "completed") {
    state.totals.latency[latencyBounds.findIndex((bound) => ms <= bound)]++;
    if (metrics) {
      state.totals[metrics.route]++;
      for (const key of ["modelCalls", "webSearchCalls", "inputTokens", "cachedInputTokens", "outputTokens"] as const) state.totals[key] += metrics[key];
      const estimated = estimateUsageUsd(metrics);
      if (estimated === null) state.totals.unpricedRequests++; else state.totals.estimatedModelUsd += estimated;
      state.totals.groundingFallbacks += metrics.groundingFallbacks ?? 0;
      if (metrics.modelCalls && !metrics.usageReported) state.totals.unreportedUsage++;
    }
  }
  flushMetrics();
}
export function metricsSnapshot() {
  const percentile = (q: number) => {
    if (!state.totals.completed) return null;
    let seen = 0;
    for (let i = 0; i < latencyBounds.length; i++) { seen += state.totals.latency[i]; if (seen >= state.totals.completed * q) return Number.isFinite(latencyBounds[i]) ? latencyBounds[i] : null; }
    return null;
  };
  return { ...state.totals, latency: [...state.totals.latency], active: state.active, scope: "this server process since restart", latencyBucketBoundsMs: latencyBounds.map((b) => Number.isFinite(b) ? b : null), p50BucketUpperMs: percentile(0.5), p95BucketUpperMs: percentile(0.95), note: "Counts only; no prompts, replies, raw IPs or visitor identifiers. Tokens are completed-call usage, not an invoice; failed/aborted provider calls may still be billed. Feedback is deduplicated per process for one hour." };
}
function flushMetrics() {
  if (process.env.ZARVIS_AGGREGATE_METRICS !== "true" || Date.now() - state.lastLog < 60000) return;
  state.lastLog = Date.now();
  console.info("Zarvis aggregate metrics", JSON.stringify(metricsSnapshot()));
}
export function resetMetricsForTests() { state.totals = empty(); state.active = 0; state.usedFeedback.clear(); }

/** Optional operator-supplied rates. Missing rates mean unknown cost, never free usage. */
export function estimateUsageUsd(metrics: GenerationMetrics): number | null {
  if (!metrics.modelCalls) return 0;
  if (!metrics.usageReported) return null;
  const rate = (name: string) => {
    const raw = process.env[name]; if (raw === undefined || raw.trim() === "") return null;
    const value = Number(raw); return Number.isFinite(value) && value >= 0 && value <= 1e6 ? value : null;
  };
  const input = rate("ZARVIS_INPUT_USD_PER_MILLION"), output = rate("ZARVIS_OUTPUT_USD_PER_MILLION");
  const cached = rate("ZARVIS_CACHED_INPUT_USD_PER_MILLION"), search = rate("ZARVIS_SEARCH_USD_PER_CALL");
  if (input === null || output === null || (metrics.cachedInputTokens > 0 && cached === null) || (metrics.webSearchCalls > 0 && search === null)) return null;
  return ((metrics.inputTokens - metrics.cachedInputTokens) * input + metrics.cachedInputTokens * (cached ?? 0) + metrics.outputTokens * output) / 1e6 + metrics.webSearchCalls * (search ?? 0);
}
