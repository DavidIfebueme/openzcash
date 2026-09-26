import "server-only";
import OpenAI from "openai";
import type { Response as OpenAIResponse, ResponseInputItem, ResponseCreateParamsStreaming, Tool } from "openai/resources/responses/responses";
import { zarvisConfig } from "./config";
import { systemPrompt } from "./prompt";
import { conversationKnowledge } from "./context";
import { lookupPublicData, lookupTool } from "./data";
import { SEARCH_DOMAINS, selectKnowledge } from "./sources";
import { citedSources, renderResponse } from "./answer";
import type { ChatMessage, ZarvisEvent, ZarvisSource } from "./types";

export async function generateAnswer(messages: ChatMessage[], signal: AbortSignal, emit: (event: ZarvisEvent) => void) {
  const config = zarvisConfig();
  const client = new OpenAI({ apiKey: config.apiKey, maxRetries: 0, timeout: 50_000 });
  const question = conversationKnowledge(messages);
  const input: ResponseInputItem[] = messages.map(({ role, content }) => ({ role, content }));
  const candidates: ZarvisSource[] = selectKnowledge(question).map(({ title, url }) => ({ title, url }));
  let webUsed = false;
  let text = "";
  // One retrieval round, followed by one final answer. No unbounded agent loop.
  for (let round = 0; round < 2; round++) {
    signal.throwIfAborted();
    const tools: Tool[] = round === 0 ? [lookupTool] : [];
    if (config.webSearch && !webUsed) tools.push({ type: "web_search", filters: { allowed_domains: SEARCH_DOMAINS }, search_context_size: "low" });
    const parameters: ResponseCreateParamsStreaming & { max_tool_calls: number } = {
      model: config.model,
      instructions: systemPrompt(question),
      input,
      tools,
      // Request room for a search and source check; model rounds are also bounded below.
      max_tool_calls: 2,
      parallel_tool_calls: true,
      max_output_tokens: 3_000,
      reasoning: { effort: "low" },
      text: { verbosity: "low" },
      store: false,
      include: ["reasoning.encrypted_content"],
      stream: true,
    };
    const stream = await client.responses.create(parameters, { signal });
    let result: OpenAIResponse | undefined;
    for await (const event of stream) {
      signal.throwIfAborted();
      if (event.type === "response.output_text.delta") emit({ type: "delta", text: event.delta });
      if (event.type === "response.refusal.delta") emit({ type: "delta", text: event.delta });
      if (event.type === "response.web_search_call.in_progress") emit({ type: "status", message: "Checking Zcash sources…" });
      if (event.type === "response.completed") result = event.response;
      if (event.type === "response.failed" || event.type === "response.incomplete" || event.type === "error")
        throw new Error("INCOMPLETE_RESPONSE");
    }
    if (!result || result.status !== "completed") throw new Error("INCOMPLETE_RESPONSE");
    const rendered = renderResponse(result);
    if (rendered.text) text += `${text ? "\n\n" : ""}${rendered.text}`;
    candidates.push(...rendered.sources);
    webUsed ||= result.output.some((item) => item.type === "web_search_call");
    const calls = result.output.filter((item) => item.type === "function_call");
    if (!calls.length) {
      if (!text.trim()) throw new Error("EMPTY_RESPONSE");
      emit({ type: "replace", text });
      const consulted = [...citedSources(text, candidates), ...candidates.filter((source) => source.retrievedAt)];
      emit({ type: "done", sources: [...new Map(consulted.map((source) => [source.url, source])).values()].slice(0, 20) });
      return;
    }
    if (round === 1) throw new Error("TOOL_LIMIT");
    for (const item of result.output) {
      if (item.type === "message" || item.type === "reasoning" || item.type === "function_call" || item.type === "web_search_call") input.push(item);
    }
    for (const [index, call] of calls.entries()) {
      let output = { content: JSON.stringify({ error: "Lookup limit reached; answer only from available evidence." }), source: undefined as ZarvisSource | undefined };
      if (index < 3 && call.name === "lookup_openzcash" && call.arguments.length <= 1_000) {
        emit({ type: "status", message: "Reading public OpenZcash records…" });
        try { output = { source: undefined, ...await lookupPublicData(JSON.parse(call.arguments), signal) }; } catch { /* untrusted arguments remain a failed lookup */ }
      }
      if (output.source) candidates.push(output.source);
      input.push({ type: "function_call_output", call_id: call.call_id, output: output.content });
    }
    if (text) emit({ type: "delta", text: "\n\n" });
  }
  throw new Error("TOOL_LIMIT");
}
