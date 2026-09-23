export type ResearchAssistant = {
  id: string;
  name: string;
  group: "chat" | "coding";
  logo: string;
  hint: string;
  url: string;
  action: string;
};

// Curated entry points, not a model-quality ranking or an integration claim.
// Capability sources and logo provenance: docs/copilot-assistants.md.
export const RESEARCH_ASSISTANTS: ResearchAssistant[] = [
  { id: "chatgpt", name: "ChatGPT", group: "chat", logo: "/logos/assistants/openai.png", hint: "Use Search or deep research to check current sources.", url: "https://chatgpt.com/", action: "Open ChatGPT" },
  { id: "gemini", name: "Gemini", group: "chat", logo: "/logos/assistants/gemini.svg", hint: "Use Deep Research for a comparison grounded in web sources.", url: "https://gemini.google.com/", action: "Open Gemini" },
  { id: "claude", name: "Claude", group: "chat", logo: "/logos/assistants/claude.svg", hint: "Enable web search before asking for current funding data.", url: "https://claude.ai/", action: "Open Claude" },
  { id: "grok", name: "Grok", group: "chat", logo: "/logos/assistants/grok.png", hint: "Ask Grok to search the web and check the linked records.", url: "https://grok.com/", action: "Open Grok" },
  { id: "perplexity", name: "Perplexity", group: "chat", logo: "/logos/assistants/perplexity.svg", hint: "Paste into a new thread and review the cited sources.", url: "https://www.perplexity.ai/", action: "Open Perplexity" },
  { id: "venice", name: "Venice", group: "chat", logo: "/logos/assistants/venice.png", hint: "Enable Web Search. E2EE mode cannot browse the web.", url: "https://venice.ai/", action: "Open Venice" },
  { id: "cursor", name: "Cursor", group: "coding", logo: "/logos/agents/cursor.png", hint: "Paste into Agent and allow web lookups. Keep the task read-only.", url: "https://cursor.com/docs", action: "Cursor guide" },
  { id: "claude-code", name: "Claude Code", group: "coding", logo: "/logos/assistants/claude.svg", hint: "Paste into your existing session. Allow only the public reads needed for research.", url: "https://code.claude.com/docs/en/overview", action: "Claude Code guide" },
  { id: "codex", name: "Codex", group: "coding", logo: "/logos/assistants/openai.png", hint: "Use your existing app or CLI with web access. Keep the task read-only.", url: "https://github.com/openai/codex", action: "Codex guide" },
  { id: "github-copilot", name: "GitHub Copilot", group: "coding", logo: "/logos/agents/github-copilot.png", hint: "Use a chat or agent session that can look up the public sources.", url: "https://docs.github.com/en/copilot", action: "Copilot guide" },
  { id: "opencode", name: "OpenCode", group: "coding", logo: "/logos/agents/opencode.png", hint: "Use a model and tools with web access, with read-only permissions.", url: "https://opencode.ai/docs/", action: "OpenCode guide" },
  { id: "other", name: "Other agent", group: "coding", logo: "/logos/glyphs/copilot.png", hint: "Use any assistant that can read the public sources. Web access is required.", url: "/zcg/copilot/instructions", action: "Research guide" },
];
