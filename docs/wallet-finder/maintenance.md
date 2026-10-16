# Wallet Finder: evidence maintenance

The finder supplements the existing `/wallets` catalog. It matches explicit requirements against platform-specific source records. It does not rank security, hold keys, connect a wallet, process transactions, or infer truth from a badge or URL.

## Source of truth

- `src/lib/wallet-finder/types.ts`: versioned TypeScript schema.
- `src/lib/wallet-finder/evidence.ts`: reviewed facts and limitations for each catalog entry.
- `src/lib/wallet-finder/matching.ts`: deterministic matching and validation.
- `/api/wallets/capabilities`: reusable public JSON (`schemaVersion: 1`).
- `docs/wallet-finder-sources.md`: research decisions and source limitations.

Availability, shielded send, shielded receive, hardware signing and multichain support are separate fields. Keep each field specific to a platform and release/channel. A wallet's Android send capability cannot be combined with its iOS receive capability to satisfy one request. Desktop means only the operating systems stated in the evidence scope; hardware means only the named model/integration/firmware.

`multichain` means holding/managing native assets from more than one blockchain. A swap or cross-chain payment does not establish that capability. `hardwareSigning` means a confirmed external-device integration in software, or signing on the hardware device itself.

## Update procedure

1. Read the wallet maintainer's documentation, release notes or source implementation. Use precise primary URLs. Aggregators may help discover a source but cannot substantiate a positive match alone.
2. Identify the exact platform, release/channel and required companion app/firmware. Distinguish announced, beta, available and interrupted workflows in the availability record.
3. Update only facts actually checked. Record `checkedAt`, source title/URL, a useful `scope`, and the limitation in `note`. The checked date records source review; it is not a hands-on security audit or a promise of future functionality.
4. Use `unknown` for missing/conflicting evidence or unresolved operational reports. Unknown is not unsupported. Use `unsupported` only when primary material explicitly establishes the limitation. Keep conflicting links and explain the uncertainty.
5. Review the catalog headline and platform list for contradictions. Preserve capabilities that differ by platform in the detailed record; do not promote a desktop capability to mobile.
6. Run `npm run wallets:check`, the matching/data/UI tests, TypeScript, and production build. Check changed evidence links, mobile, keyboard and both themes.
7. Have another reviewer compare the changed claims with the sources. Record remaining caveats; publish only after the review.

Review affected facts whenever a relevant release, integration change or breakage report appears. Perform a periodic source review at least monthly. This repository does not claim that those future reviews happen automatically. An old review date remains visible until a person rechecks it; a deployment must not silently advance dates.

## Reproducible checks

```sh
npm ci
npm run wallets:check
npx vitest run src/lib/wallet-finder src/app/wallets/find src/lib/design-routes.test.ts
npm run typecheck
npm test
npm run build
npm run dev -- --hostname 127.0.0.1 --port 4234
```

The finder and evidence data need no account, wallet keys or production database. Other portal routes may use the documented project services. Copying the matcher and evidence module into another application requires only TypeScript; retain the repository MIT license and attribution.

## Community provenance

The guided selection and field-level evidence requirements were informed by @Foreveranka's [Wallet Finder proposal](https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/495). OpenZcash implements this flow on its existing catalog. This credit is for requirements and community feedback, not authorship of OpenZcash code, wallet software, or independently reviewed facts.
