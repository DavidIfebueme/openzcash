import "server-only";
import OpenAI from "openai";
import type { Tool, ResponseCreateParamsStreaming } from "openai/resources/responses/responses";
import type { zarvisConfig } from "./config";
import { SEARCH_DOMAINS } from "./sources";

type Config = ReturnType<typeof zarvisConfig>;
export function providerClient(config: Config) {
  if (!config.apiKey) throw new Error("PROVIDER_NOT_CONFIGURED");
  // Fixed hosts: never route a credential using a user-supplied URL or SDK environment override.
  return new OpenAI({ apiKey: config.apiKey, baseURL: config.provider === "xai" ? "https://api.x.ai/v1" : "https://api.openai.com/v1", maxRetries: 0, timeout: 50_000 });
}
export function providerSearchTool(config: Config, zipOnly = false): Tool {
  if (zipOnly) return { type: "web_search", filters: { allowed_domains: ["zips.z.cash"] }, ...(config.provider === "openai" ? { search_context_size: "low" as const } : {}) };
  if (config.provider === "xai") return { type: "web_search", filters: { allowed_domains: ["z.cash", "zips.z.cash", "electriccoin.co", "zfnd.org", "forum.zcashcommunity.com"] } };
  return { type: "web_search", filters: { allowed_domains: SEARCH_DOMAINS }, search_context_size: "low" };
}
export function providerOptions(config: Config): Partial<ResponseCreateParamsStreaming> & { max_tool_calls?: number; max_turns?: number } {
  return {
    reasoning: { effort: "low" },
    ...(config.provider === "xai" ? { max_turns: 2 } : { max_tool_calls: 2 }),
    include: ["reasoning.encrypted_content"],
    ...(config.provider === "openai" ? { text: { verbosity: "low" as const } } : {}),
    prompt_cache_key: "openzcash-zarvis-v2",
  };
}
