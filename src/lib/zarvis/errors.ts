import { APIConnectionError, APIConnectionTimeoutError, APIUserAbortError } from "openai";
import { APIConnectionError as ClaudeConnectionError, APIConnectionTimeoutError as ClaudeTimeoutError, APIUserAbortError as ClaudeAbortError } from "@anthropic-ai/sdk";
/** Fixed failure classes for logs and metrics. Never a provider message, body or stack. provider_billing: the account, not the request, is the problem (credits exhausted, spend limit reached). */
export const ERROR_CLASSES = ["provider_timeout", "provider_connection", "provider_billing", "provider_http_429", "provider_http_4xx", "provider_http_5xx", "provider_not_configured", "incomplete_response", "empty_response", "tool_limit", "public_read_timeout", "model_required", "deadline", "aborted", "unknown"] as const;
export type ErrorClass = typeof ERROR_CLASSES[number];
/** Usage accumulated before a failure; carries the model and whether every round reported usage so the billed part can still be priced. */
export type PartialUsage = { route: "local" | "model"; depth?: "quick" | "deep"; model: string; modelCalls: number; webSearchCalls: number; webFetchCalls?: number; inputTokens: number; cachedInputTokens: number; cacheWriteTokens?: number; outputTokens: number; usageReported: boolean; groundingFallbacks?: number; repairRounds?: number; xResearchUsd?: number | null };
/** Thrown by the answer pipeline: a class plus the usage accumulated before the failure. The cause stays in memory for tests and debuggers; only the class is logged. */
export class GenerationFailure extends Error {
  constructor(readonly errorClass: ErrorClass, readonly usage?: PartialUsage, cause?: unknown) { super(cause instanceof Error ? cause.message : errorClass, cause === undefined ? undefined : { cause }); this.name = "GenerationFailure"; }
}
const byMessage: Record<string, ErrorClass> = { INCOMPLETE_RESPONSE: "incomplete_response", EMPTY_RESPONSE: "empty_response", TOOL_LIMIT: "tool_limit", PROVIDER_NOT_CONFIGURED: "provider_not_configured", PUBLIC_READ_TIMEOUT: "public_read_timeout", REQUEST_ABORTED: "aborted", MODEL_REQUIRED: "model_required" };
/** SDK classes by identity first (neither SDK sets `name`, and a bundler may mangle class names; the OpenAI and Anthropic classes share their names), then by constructor name for a second SDK copy. */
const sdkError = (error: Error, types: unknown[], name: string) => types.some((type) => typeof type === "function" && error instanceof type) || error.constructor?.name === name;
/** Body error types the Anthropic SDK attaches to a mid-stream SSE error, which carries no HTTP status. */
const byErrorType: Record<string, ErrorClass> = { overloaded_error: "provider_http_5xx", api_error: "provider_http_5xx", timeout_error: "provider_http_5xx", rate_limit_error: "provider_http_429", billing_error: "provider_billing", invalid_request_error: "provider_http_4xx", authentication_error: "provider_http_4xx", permission_error: "provider_http_4xx", not_found_error: "provider_http_4xx", request_too_large: "provider_http_4xx" };
type ErrorBody = { type?: unknown; message?: unknown; details?: { error_code?: unknown } };
/** The documented account-level refusals: the spend-limit code on a 429, and the credit or self-set-limit 400s, which carry no code. The body is inspected here and never logged. */
function billingError(error: Error): boolean {
  const body = (error as { error?: { error?: ErrorBody } & ErrorBody }).error;
  const inner = body && typeof body === "object" ? body.error ?? body : undefined;
  if (!inner || typeof inner !== "object") return false;
  if (inner.details?.error_code === "enforced_spend_limit_reached") return true;
  return inner.type === "invalid_request_error" && typeof inner.message === "string" && /credit balance is too low|reached your specified (?:workspace )?API usage limits/i.test(inner.message);
}
export function classifyError(error: unknown, aborted = false): ErrorClass {
  if (aborted) return "aborted";
  if (error instanceof GenerationFailure) return error.errorClass;
  if (!(error instanceof Error)) return "unknown";
  if (error.name === "AbortError" || sdkError(error, [APIUserAbortError, ClaudeAbortError], "APIUserAbortError")) return "aborted";
  if (sdkError(error, [APIConnectionTimeoutError, ClaudeTimeoutError], "APIConnectionTimeoutError") || (sdkError(error, [APIConnectionError, ClaudeConnectionError], "APIConnectionError") && /timed out/i.test(error.message))) return "provider_timeout";
  if (sdkError(error, [APIConnectionError, ClaudeConnectionError], "APIConnectionError")) return "provider_connection";
  if (billingError(error)) return "provider_billing";
  const status = (error as { status?: unknown }).status;
  if (typeof status === "number") return status === 402 ? "provider_billing" : status === 429 ? "provider_http_429" : status >= 500 ? "provider_http_5xx" : status >= 400 ? "provider_http_4xx" : "unknown";
  const type = (error as { type?: unknown }).type;
  if (typeof type === "string" && type in byErrorType) return byErrorType[type];
  return byMessage[error.message] ?? "unknown";
}
