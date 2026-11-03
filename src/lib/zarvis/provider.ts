import "server-only";
import OpenAI from "openai";
import type { Tool, ResponseCreateParamsStreaming } from "openai/resources/responses/responses";
import type { ProviderConfig } from "./config";
import { SEARCH_DOMAINS } from "./sources";
import type { AnswerPlan } from "./depth";
import type { ResearchScope } from "./research-scope";

/** The Responses API providers (OpenAI, xAI); the Anthropic transport has its own client and search tool in anthropic.ts. */
type Config = ProviderConfig;
export function providerClient(config: Config, timeout = 50_000) {
  if (!config.apiKey) throw new Error("PROVIDER_NOT_CONFIGURED");
  // Fixed hosts: never route a credential using a user-supplied URL or SDK environment override.
  return new OpenAI({ apiKey: config.apiKey, baseURL: config.provider === "xai" ? "https://api.x.ai/v1" : "https://api.openai.com/v1", maxRetries: 0, timeout });
}
/** Grok accepts at most five allowed domains per search, so the five are chosen by topic; OpenAI receives the whole reviewed list. */
export const GROK_SEARCH_DOMAINS: Record<Exclude<ResearchScope, "zip">, string[]> = {
  general: ["openzcash.org", "zechub.wiki", "z.cash", "zips.z.cash", "forum.zcashcommunity.com"],
  governance: ["openzcash.org", "forum.zcashcommunity.com", "zfnd.org", "electriccoin.co", "z.cash"],
  news: ["zodl.com", "zakura.com", "shieldedlabs.net", "zcashlabs.org", "zfnd.org"],
  mining: ["zcashinfo.com", "zecstats.com", "zips.z.cash", "z.cash", "electriccoin.co"],
  history: ["openzcash.org", "z.cash", "electriccoin.co", "shieldedlabs.net", "zfnd.org"],
};
export function providerSearchTool(config: Config, scope: ResearchScope = "general"): Tool {
  if (scope === "zip") return { type: "web_search", filters: { allowed_domains: ["zips.z.cash"] }, ...(config.provider === "openai" ? { search_context_size: "low" as const } : {}) };
  if (config.provider === "xai" || scope === "mining" || scope === "history") return {
    type: "web_search", filters: { allowed_domains: GROK_SEARCH_DOMAINS[scope] },
    ...(config.provider === "openai" ? { search_context_size: "low" as const } : {}),
  };
  return { type: "web_search", filters: { allowed_domains: SEARCH_DOMAINS }, search_context_size: "low" };
}
export function providerOptions(config: Config, effort: AnswerPlan["effort"] = "low"): Partial<ResponseCreateParamsStreaming> & { max_tool_calls?: number; max_turns?: number } {
  return {
    reasoning: { effort },
    ...(config.provider === "xai" ? { max_turns: 2 } : { max_tool_calls: 2 }),
    include: ["reasoning.encrypted_content"],
    ...(config.provider === "openai" ? { text: { verbosity: "low" as const } } : {}),
    prompt_cache_key: "openzcash-zarvis-v2",
  };
}
