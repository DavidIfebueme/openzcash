export type ResearchAssistant = {
  id: string;
  name: string;
  group: "chat" | "coding";
  logo: string;
  hint: string;
  url: string;
  action: string;
  installAgent?: string;
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
  { id: "cursor", name: "Cursor", group: "coding", logo: "/logos/agents/cursor.png", hint: "Paste into Agent and allow read-only web lookups.", url: "https://cursor.com/docs", action: "Cursor guide", installAgent: "cursor" },
  { id: "claude-code", name: "Claude Code", group: "coding", logo: "/logos/assistants/claude.svg", hint: "Allow only the public reads needed for research.", url: "https://code.claude.com/docs/en/overview", action: "Claude Code guide", installAgent: "claude-code" },
  { id: "codex", name: "Codex", group: "coding", logo: "/logos/assistants/openai.png", hint: "Use web access with read-only permissions.", url: "https://github.com/openai/codex", action: "Codex guide", installAgent: "codex" },
  { id: "gemini-cli", name: "Gemini CLI", group: "coding", logo: "/logos/assistants/gemini.svg", hint: "Allow web research with read-only permissions.", url: "https://geminicli.com/docs/cli/skills/", action: "Gemini CLI guide", installAgent: "gemini-cli" },
  { id: "github-copilot", name: "GitHub Copilot", group: "coding", logo: "/logos/agents/github-copilot.png", hint: "Use a session with access to public web sources.", url: "https://docs.github.com/en/copilot", action: "Copilot guide", installAgent: "github-copilot" },
  { id: "opencode", name: "OpenCode", group: "coding", logo: "/logos/agents/opencode.png", hint: "Use a model with read-only web tools.", url: "https://opencode.ai/docs/", action: "OpenCode guide", installAgent: "opencode" },
  { id: "other", name: "Other agent", group: "coding", logo: "/logos/glyphs/copilot.png", hint: "Use any assistant that can read the public sources. Web access is required.", url: "/zcg/copilot/instructions", action: "Research guide" },
];
