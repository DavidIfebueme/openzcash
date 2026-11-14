# Arborist and GitHub news collection

## Verified sources and recovery

Arborist reads the community-maintained `ZcashCommunityGrants/arboretum-notes` archive and the official Zcash Foundation channel. The channel's advertised Atom feed can return 404. The fallback reads bounded, inert JSON from the English channel page and verifies its channel ID before accepting a recording. It never executes the page or follows arbitrary source URLs.

A recording without published notes has no inferred call number. Matching notes replace it when collected. Historical agenda records remain explicitly labeled.

GitHub Contents provides file paths and SHAs; the repository README is an alternate index. An omitted year can be filled from an explicit README date for the exact same path, with `dateSource` recorded. Years are never inferred from adjacent calls. Existing source inconsistencies are not silently rewritten.

## Cache and freshness

The Arborist page and Zarvis share a process cache initialized from `src/data/arborist/snapshot.json`. This verified public snapshot keeps cold loads available without fetching the entire archive. Refresh happens on use, at most hourly after success, with five-minute retry spacing after failure. Unchanged GitHub SHAs avoid redundant body requests.

Partial refreshes preserve previous successful notes and recordings. Per-source verification dates advance only after that source succeeds; the archive-wide date advances only when both sources succeed. Old data remains visibly dated. Scheduling announcements stream separately and do not block the call archive.

News uses the existing server-only GitHub credential through `ghHeaders()`. Each repository keeps its own last successful response in memory. Errors preserve that response; a valid empty response clears it. The seven-day display window still applies during an outage. A repository whose read failed is read again on the next feed refresh instead of an hour later; the wait doubles while the failure continues, up to the hourly schedule. The page reports incomplete GitHub updates once that repeated read has also failed, or when a repository has no verified response yet. Cold-start failures are marked unavailable; this News cache is not durable storage. The canonical repository is `zcash/zallet`, formerly `zcash/wallet`.

## Refreshing the bundled Arborist archive

Run `node --import tsx scripts/sync-arborist.ts --github-cli` using the existing GitHub CLI login, or omit `--github-cli` to use `GITHUB_TOKEN` when present. The command writes only public records and never logs credentials. A partial or failed collection leaves the previous snapshot untouched. Review the source timestamps, record counts and latest recording before committing the snapshot.

Regression coverage lives in `src/lib/arborist/{collector,discovery,feed}.test.ts` and `src/lib/news/{feed,github}.test.ts`. It includes upstream failures, malformed responses, source identity, preserved records, explicit empty responses, retry spacing, date provenance and expired News items.
