# Using Zarvis

Zarvis is the guide on OpenZcash: it answers questions about Zcash and about the
funding data this site publishes, in the language of the question. It is free to
use and capacity-limited; OpenZcash pays the model. This file describes the
interface in this checkout. Limits, retention and the incident log it references live at
<https://openzcash.org/zarvis/about>, which is generated from the deployed
configuration and is the authoritative version.

## Where it runs

- Full page at `/zarvis`.
- The same chat is available across the site, including the Monthly pages,
  through the launcher in the corner.

## Asking

- Questions arrive as plain text, at most 2,000 characters, in any language.
  There is no keyword syntax to learn.
- The pills under the composer are one-tap starting points covering the common
  paths: how shielded transactions work, the latest treasury balances, the Dev
  Fund split, treasury scenarios, a project history lookup and a Zcash pitch.
- The selector next to the composer chooses the depth. Quick answers are
  written within 55 seconds; Deep analysis within 110.
- Follow-ups work in context: "and in 2025?", "and the Lockbox?", "what is its
  status?" resolve against the previous turn when they can be answered directly,
  and go to the model with the recent conversation otherwise.

## The two kinds of answer

Every answer carries a badge saying which kind it is.

1. **Direct from OpenZcash data · no AI.** The question matched one of the
   site's own records and was answered by code: no model call, no quota cost,
   and the record's date is shown. Prices, treasury balances, grant ledger
   sums, ZIPs, wallet and community listings, Arborist calls and the chain tip
   are answered this way.
2. **Model answer.** Everything else goes to the configured model, which
   receives the recent conversation, the records retrieved from this site and
   the official ZIP corpus, and must cite what it used. The badge names the
   model and counts the sources; "N sources consulted" opens the list.

For model answers backed by recognized financial evidence, a numeric guard
checks USD, ZEC and percentage figures against the retrieved records and
protocol constants. Unsupported figures may be restated once, when time permits;
those still unsupported are withheld with a notice. Other answers and currencies
are not fully covered, and a matching figure can still be out of context. Open
the sources.

## Pitches, narratives and site workflows

Ask for a draft with an audience, occasion, language and format, for example:
"Write a 30-second Zcash opening for a small business owner" or
"Crie um pitch de 60 segundos para uma ONG". Follow-ups such as
"Agora adapte para espanhol e reduza a uma frase" keep the current brief.
A new subject ends that writing brief.

Zarvis uses the same original EN/PT-BR/ES catalog as `/narratives`, including
its factual qualifications. It can write fresh copy for conversations,
presentations, panels, interviews and social posts. The library itself remains
a collection of reviewed examples. Its print selection is separate from chat.

For timed pitches, the app measures the delivered text against an upper bound
of 80 words for 30 seconds and 150 for 60 seconds. It checks one-sentence requests
too. An overlong response gets at most one bounded rewrite; if it still fails,
the app reports that limitation instead of claiming it fits. An explicit word
count overrides these timing defaults. Speaking time still varies by speaker.
The existing source details retain the library passages used without adding
reference lists to the reusable pitch.

Zarvis also has reviewed instructions for printing, Crosslink tests and
incentives, demo Zcred participation and the separate Private Chat service.
It reads public information; it cannot inspect internal test runs, deployment
status, private messages or wallets. A local review date proves none of those.

## Sharing an answer

Under every complete answer:

- **Copy answer** — the text alone.
- **Copy with sources** — the text plus its badge, sources and retrieval date,
  formatted for pasting into a forum post, issue or report.
- **Copy question link** — a link that carries only that one question. Opening
  it fills the composer; nothing is sent until the reader decides. Zarvis never
  writes a question into the page address by itself.

Shared treasury-calculator links carry only scenario assumptions.

## Limits and quotas

- Per network address: a fixed 10-minute cap and a daily cap reserve a quota
  unit before routing. A completed direct answer returns the unit. A refused
  question says when to retry, and the send button waits with you.
- Site-wide hourly and daily request caps also apply before routing. When any
  request-count cap is full, direct answers are blocked too.
- A separate daily spending ceiling, when configured, pauses model answers;
  direct answers remain available while request-count quota is available.
- The exact numbers in effect are shown at <https://openzcash.org/zarvis/about>
  under "What you may ask", because they change with capacity.

## Privacy

- The conversation lives in page memory. Reloading or starting a new chat
  clears it. No question or answer is written to a database or a log.
- Feedback sends the rating and, for "Needs work", an optional reason from a
  fixed list — never the conversation text.
- For model answers, the recent turns and retrieved records go to the model
  provider. Response storage is disabled for this integration; provider
  retention policies may still apply, and the current provider detail is linked
  from the About page.
- Never paste recovery phrases, private keys or viewing keys into the chat,
  even though Zarvis cannot spend anything. Viewing keys expose transaction
  history to whoever holds them.

## Feedback, health and incidents

- "Useful" and "Needs work" under an answer feed the daily metrics only.
- `/api/zarvis/health` is public and reports whether the last hourly canary
  run passed.
- Past incidents are published on the About page under "Status and incidents".

## Known limitations

- Zarvis is a guide, not an official spokesperson for Zcash, ECC, the Zcash
  Foundation, ZCG or FPF, and it can be wrong.
- It reads public records only. It cannot see wallets, private balances or
  anything you did not type, and it cannot send, sign or contact anyone.
- Calendar dates for future blocks are estimates; ZIP statuses and listed
  activation heights are not proof that a change is live.
- There is no official Zarvis or OpenZcash token. Any token using either name
  is not created, endorsed or issued by OpenZcash.
