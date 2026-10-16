# Reuse and integration review package

This implementation lives inside OpenZcash's existing wallet catalog. It is provided under the repository MIT license. No upstream ZecHub PR or maintainer acceptance is claimed.

## Portable core

Copy `src/lib/wallet-finder/types.ts`, `matching.ts`, `evidence.ts`, their tests and the source-review documentation. The engine has no network calls, framework imports or storage dependencies. Its inputs are a profile array and explicit requirements; its output includes match/unknown/excluded status and evidence-backed reasons. The JSON export at `/api/wallets/capabilities` can serve a separate consumer, but pinning a reviewed dataset revision is preferable for reproducible tests.

## Interface integration

The reference React interface is `src/app/wallets/find/finder.tsx` with its CSS module and interaction tests. It uses OpenZcash's catalog, page metadata and credit helpers. A receiving project can adapt those wrappers to its existing wallet cards and navigation without changing the matcher. Preserve platform-scoped evidence, unknown handling, editable answers, keyboard controls, URL state and source links. Keep the maintainer's existing wallet directory and community attribution.

## Review checklist

- Confirm where the flow belongs, who maintains the data, and which source/release review cadence the receiving project can support.
- Validate all affirmative capabilities against the cited primary material; passing the schema check only proves structure.
- Run the matching scenarios, UI interactions and source schema validation.
- Review exact-platform behavior, availability, unsupported/unknown states, no-match recovery and browser Back/Forward.
- Check the phone view, both themes, keyboard focus and evidence links.
- Run the real-user protocol before claiming a measured usability improvement.
- Record implementation readiness, upstream review/acceptance and public deployment as separate states.

For ZecHub, the proposed destination is its existing wallet guide. This package makes the source, reusable rules, evidence and review procedure available to the task owner; submitting it to ZecHub requires an explicit instruction to contact that project. The requirements were informed by @Foreveranka's [community proposal](https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/495).
