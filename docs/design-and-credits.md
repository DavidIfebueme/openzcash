# Evidence-led screens and community credit

Approved direction: Coinholder proposal verification. Apply this pattern to new or substantially revised record screens; do not redesign unrelated apps in the same change.

## Information before decoration

- Name the record first. Follow with one sentence explaining what the sources establish.
- Use the OpenZcash theme tokens, readable sans-serif headings, tabular numerals, neutral surfaces, fine borders and restrained gold actions. Support both themes.
- Keep related evidence together. Explain a conclusion next to its numbers and make the underlying records reachable in one action. Use a chart only when it adds understanding.
- Keep requested amounts, decisions, payments, public work, accepted milestones and measured use distinct. Do not turn missing evidence into a verdict or a score. Never add overlapping awards into a portfolio total.
- Label source dates and collection dates separately. Unavailable is not zero. A repository snapshot is not a live feed.
- Use the shell's back navigation and general Ask Zarvis action. A contextual project question may appear in the page, clearly labeled.
- Test desktop, narrow mobile, both themes, keyboard navigation, filters and empty/unavailable states. Preserve shareable URLs and source links.

## Credit the contribution

Use `CommunityCredit` from `src/components/community-credit.tsx`; register the screen or screen family in `SCREEN_CREDITS`.

- Give credit when a community contribution informs a delivered screen or improvement. Keep the exact handle supplied by the contributor/user.
- Describe the role accurately: design, feedback, research, or a neutral community contribution. Do not infer authorship from a suggestion. No invented profile links or endorsements.
- Show a quiet attribution at the end of the screen. A compact byline can link to it where discoverability matters. Avoid promotional banners or duplicate prominent badges.
- A screen-family credit applies to its interface, not authorship of the projects, data or research displayed. Keep source attribution and project-maintainer identity separate.
- Preserve prior credits when improving a screen. Add further contributors and roles when verified; do not replace them with the newest requester's name.
- OpenZcash retains its implementation/design attribution as appropriate. Community acknowledgments are not an exclusivity or ownership claim.

Current attributions:

| Screen family | Contribution | Production |
| --- | --- | --- |
| Coinholder verification | Page design by vaspholdings | Built by OpenZcash |
| Project histories | Community contribution by socrates1024 | Designed and built by OpenZcash |

## Navigation

`src/lib/design-routes.ts` is the shared app order. Ecosystem follows ZCG, with Development, Project histories, DeFi, Z3 and Wallets under it. Preserve routes, app grouping and the detail-to-directory back path when moving a block.
