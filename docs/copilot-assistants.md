# Public copilot setup and assistant choices

Reviewed September 23, 2026. The three pages share the same setup component and
provider picker, with separate prompts and research guides for ZCG, Coinholder,
and ZecHub. No model-version or quality ranking is implied.

## Three levels

1. Quick start: locally compose and copy a research prompt. No installation.
2. Save instructions: fetch the selected public Markdown guide only after the user
   clicks Copy; copy it for manual use in a supported project or skills folder.
3. Agent skill: copy a pinned skills CLI command. Nothing executes in the browser.

Provider links contain no prompt or question. Buttons do not open conversations
automatically, submit text, connect wallets, or install software. Prompt text is
component state, not local storage, an analytics payload, or a URL parameter.
Assistant logos are local, so no provider receives an image request.

The publisher explicitly allowlists three packages. ZCG retains its reviewed helpers;
Coinholder and ZecHub publish SKILL.md, README.md, and LICENSE only. Their older
repository scripts are not part of the public package. Instructions use existing
read-only web tools. Never publish the private application repository.

## Selection and prominence

The consumer picker begins with ChatGPT, Gemini, and Claude. Similarweb's July 29,
2026 article reports May 2026 worldwide generative-AI web traffic led by ChatGPT
(about 53%), Gemini (27–28%), and Claude (about 9%). This is website traffic, not
mobile use, model quality, active users, or OpenZcash-specific usage:
https://aisearch.similarweb.com/blog/gen-ai-stats/

Grok, Perplexity, and Venice remain directly visible. We have no comparable evidence
to call Venice the least-used tool. Privacy behavior depends on the selected mode.
Coding agents are separate because developer-tool adoption and consumer web traffic
are different measures. Stack Overflow's 2025 developer survey provides historical
context, not a current cross-category ranking:
https://survey.stackoverflow.co/2025/ai

## Capability references

- ChatGPT Search: https://help.openai.com/en/articles/9237897-chatgpt-search
- Gemini Deep Research: https://support.google.com/gemini/answer/15719111?hl=en
- Claude web search: https://support.claude.com/en/articles/10684626-enable-and-use-web-search
- Grok web search: https://docs.x.ai/developers/tools/web-search
- Perplexity: https://hub-prod.perplexity.ai/hub/helpcenter
- Venice: https://venice.ai/faqs/all and https://venice.ai/privacy
  Web Search must be enabled; E2EE mode cannot browse. Do not infer that every mode
  provides the same privacy guarantees.
- Cursor: https://cursor.com/docs
- Claude Code: https://code.claude.com/docs/en/overview
- Codex: https://github.com/openai/codex
- GitHub Copilot: https://docs.github.com/en/copilot
- OpenCode: https://opencode.ai/docs/

Links are entry points and documentation, not provider integrations. Web access and
permissions depend on the app, model, plan, and settings. Other agent uses the
current copilot's guide. The copy-and-paste prompt is provider-independent.

## Logo provenance

- OpenAI official GitHub organization avatar (ChatGPT and Codex):
  https://avatars.githubusercontent.com/u/14957082?v=4
- Grok official favicon: https://grok.com/images/favicon.svg
  Rasterized to PNG locally; foreignObject markup is not shipped.
- Venice official favicon: https://venice.ai/favicon.png
- Gemini, Claude, Perplexity: canonical paths from the existing simple-icons package,
  with source fields pointing to gemini.google.com, claude.ai, and perplexity.ai.
- Cursor and GitHub Copilot: existing local brand icons; sources cursor.com/brand and
  primer.style/foundations/icons/copilot-24.
- OpenCode: existing local OpenCode mark.
- Other agent: the application's generic copilot glyph.
