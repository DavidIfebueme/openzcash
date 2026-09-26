# Zarvis

Zarvis is the OpenZcash AI guide: `/zarvis`, the navigation entry, and a floating conversation on public workspace pages. The UI follows OpenZcash's light and dark themes. Answers follow the language of the question.

## Enable

1. Create a **dedicated OpenAI project and restricted API key** for OpenZcash. Allow the Responses API and the selected model. Save the key as `OPENAI_API_KEY` in the server's secret manager / Railway service `zbo`, never in client code or a `NEXT_PUBLIC_` variable. Do not paste it into chat or commit it.
2. Apply the additive `0005_zarvis_usage` migration through the existing boot migration process. It creates only short-lived request counters, not a conversation table. Requests fail closed if the table/database is unavailable.
3. Set `ZARVIS_ENABLED=true`. The defaults are `ZARVIS_MODEL=gpt-5-mini`, `ZARVIS_WEB_SEARCH=true`, `ZARVIS_DAILY_REQUEST_LIMIT=100`, and `ZARVIS_HOURLY_REQUEST_LIMIT=30`. The production request origin is pinned to `https://openzcash.org`; set `ZARVIS_ORIGIN` explicitly for a preview domain. Forwarded host headers cannot expand this allowlist. Set `ZARVIS_ENABLED=false` to turn off paid calls immediately. The feature stays disabled by default until deliberately enabled.
4. Test a basic privacy explanation, a current treasury query, an external protocol question, and a Portuguese follow-up. Check citations, reporting dates, source failures, light/dark modes and mobile. A rendered UI or configured key is not proof that a billed model call succeeded.
5. Set a project budget alert and appropriate billing controls in OpenAI. **App request limits are not a dollar billing cap.** Inspect actual usage before raising them.

## Cost reference (checked 2026-09-25)

GPT-5 mini: $0.25 / million input tokens, $0.025 / million cached input tokens, and $2.00 / million output tokens (including reasoning). Example: 10,000 input + 2,000 output tokens = $0.0065 before tools. Web search adds $0.01 per tool call plus search-content tokens. A question can use two model requests, because retrieved records need a final synthesis. History, instructions and retrieved sources all count as input; visible answer length is not total token usage.

- https://developers.openai.com/api/docs/models/gpt-5-mini
- https://developers.openai.com/api/docs/pricing

## Knowledge and freshness

- Curated, dated background: privacy, Unified Addresses, viewing keys, issuance/halvings, funding rules, ledger interpretation, treasury scenarios, governance and ecosystem navigation (`src/lib/zarvis/sources.ts`). This is a reviewed starting library, not a claim of exhaustive or automatically current knowledge.
- Live read-only tools: existing public treasury, market, grants, recipients, disbursement, published proposal, coinholder, ZecHub, ecosystem, news and funding-history data. The tool calls explicit public readers; the model cannot supply URLs, database queries or private routes. Records are bounded and truncation is labeled. Reporting dates and stale flags remain attached.
- OpenAI web search can consult a fixed list of Zcash reference/community domains for long-tail and current external information. Community content remains untrusted evidence, not official consensus. Disable search with `ZARVIS_WEB_SEARCH=false` if desired; the assistant must disclose missing current evidence.
- Returned citations are rendered as safe Markdown links. Only cited retrieved/background sources appear in the source drawer. AI citations are not independent verification; users can inspect the evidence.
- Review curated notes after protocol upgrades, source changes or new treasury methodology. Do not ingest the private repository, keys, private wallet scans, admin routes or confidential material.

## Data and safeguards

Conversation state stays in browser memory and survives ordinary workspace navigation. Reloading or New chat clears it. The backend does not write prompts or replies to a database or logs. It sends the recent conversation to OpenAI with `store: false`. This does not exempt OpenAI abuse-monitoring retention; the UI links to the provider's policy. Hosting access logs are separate.

A daily HMAC digest of the proxy-reported network address keys short-lived abuse counters. Raw addresses and messages are not persisted by this feature. Counters expire at the end of their windows and are removed on subsequent requests; they are not audience analytics or unique-person counts. Proxy-derived network quotas are advisory; atomic global caps remain effective even if headers are forged. No location or identifier is sent to OpenAI as a search location / user identifier.

The server enforces a 32 KiB request body, up to 12 recent messages / 18,000 characters, a 2,000-character question, two model rounds, up to three public lookups, a built-in tool limit, 3,000 output tokens per model call, no automatic provider retries and a 55-second generation deadline. Usage limits are 5 requests per network per 10 minutes, 20 per day, plus the global hourly/daily limits in Postgres. Failed/aborted requests consume their reservation to prevent retry abuse. A request can still incur cost before cancellation. Source content and user-supplied instructions cannot grant access to additional tools.

The UI renders no model-generated HTML or images. No third-party model endpoints are exposed in browser CSP; calls and the API key stay server-side. The model cannot send transactions, access funds, execute scripts, contact others or modify records.

## Verification

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- Manual desktop/mobile checks, streaming / stop / retry / new chat, source links and navigation continuity.

Real-provider smoke tests require a securely configured funded OpenAI project. Never silently substitute canned answers and call them live AI.
