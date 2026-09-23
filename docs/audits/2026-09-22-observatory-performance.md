# Observatory snapshot consistency and loading

Observed on production `6758cc6` on September 22, 2026 (September 23 UTC).

## Reproduction and cause

A direct HTTP sequence reproduced the reported Refresh/F5 discrepancy. At 01:54:55 UTC, the server-rendered page reported 4.21043% DEX share. `/api/markets` reported 3.62641% at 01:55:01, and a full page reload returned 4.21043%. CEX volume was identical in all three. Wrapped-feed timestamps and data were unchanged between the two page responses, despite the intervening API refresh. Both routes sent `Cache-Control: no-store`; browser caching was not the cause.

The page and API had separate module-local feed closures. Their independent indexer calls both duplicated external work and collected different subsets of pools. Approximately $10.4M of the difference came from missing or different DEX coverage, including ZeroFi, Raydium and BNB pools. A change in coverage must not be interpreted as a corresponding change in actual market activity.

## Correction

A versioned process-wide dashboard reader owns the collector, its source caches, in-flight work and the atomically published snapshot. The SSR page, API and startup warmer use the same reader. Navigation returns the dated snapshot immediately while due collection runs; explicit refresh joins that collection. Failed source retries remain bounded. Public data warms at startup and due work is checked every minute. The displayed timestamp is the publication time of the snapshot, not the time of each page request. The client also rejects older snapshots and refreshes due data when the tab becomes visible.

The application currently runs as one Railway instance. A multi-instance deployment would need an external shared snapshot store. The first collection after process startup can still wait for external providers. Provider outages, bounded pool indexing and unavailable balances remain visible; this change does not turn partial coverage into a complete global volume tape.

## Measurements

Production HTTP response completion before the correction, two sequential observations per page:

| Route | First measured visit | Next visit |
| --- | ---: | ---: |
| `/zcg` | 0.349 s | 0.360 s |
| `/zcg/investments` | 1.288 s | 0.354 s |
| `/defi` | 0.532 s | 0.333 s |
| `/news` | 1.018 s | 0.342 s |
| `/zcg/grants` | 0.477 s | 0.374 s |

These are server response measurements, not browser interactivity scores or proof of cold caches. No unrelated refactor was justified by this sample.

The original Observatory sequence took 5.429 s / 6.163 s / 0.421 s. The earlier production cold API collection took 32.71 s. In the corrected production-mode local server, the first measurement joined startup collection and took 17.047 s; the subsequent API / F5 / API sequence took 0.018 s / 0.041 s / 0.008 s. All four returned the exact same publication timestamp, CEX and DEX sums, and 4.2240394476% share. Localhost timings exclude internet latency and are not a production speedup ratio.

## Validation

Four regression tests first failed on the original cache: independent page/API bundles, a refresh followed by reload, nonblocking reads during collection, and preserved dates/backoff after failure. All pass after the correction. The full suite passed 419 tests with 8 existing integration skips. Production build, type checking, focused lint and diff checks passed. Desktop and 390px mobile previews show the snapshot time without horizontal overflow. The original HTTP sequence was repeated against a compiled Next server, including a full reload and exact value/timestamp comparison.

Reproduction payloads and timing receipts are stored in `/private/tmp/zec-performance` in the working environment; they contain only public dashboard data and are not runtime dependencies.
