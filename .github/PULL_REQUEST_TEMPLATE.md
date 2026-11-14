## Summary

<!-- What changed and why. One or two sentences. -->

## Validation

<!-- How you verified the change. The gate below is required; run the relevant
     opt-in PostgreSQL suites too when touching imports, publication policy,
     or persisted snapshots, and note any skipped suites. -->

- [ ] `npm run typecheck && npm run lint && npm test && npm run test:copilot && npm run build` passes
- [ ] Service changes: the equivalent gate passed inside `services/participate` / `services/private-chat`

## Checklist

- [ ] Tests cover the behavior change (or the change is docs/copy only)
- [ ] Documentation matches the code: commands, paths, and claims verified against the tree
- [ ] New figures or datasets carry public sources and provenance
- [ ] No secrets, credentials, or internal URLs in the diff
- [ ] Regenerated artifacts (`public/.well-known/`, navigation icons) are intentional, not stray `prebuild` output
