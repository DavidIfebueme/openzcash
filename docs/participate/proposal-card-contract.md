# Proposal card contract

Every proposal **card** in Participate and community workspaces uses `ProposalCard`, regardless of status, source, publication age or archive availability. Tables and detail pages may use their own layouts; they must retain the same source and status semantics.

The shared component owns this order:

1. Title and budget, with requested and approved amounts distinguished.
2. One metadata row for submitted date, author, decision date, minutes date, source check and (for timed community votes only) close date. Missing facts are omitted, never guessed.
3. Status and category tags using the existing names and colors. GitHub labels retain their source attribution. Categories use the same resolver as filtering. Unknown categories render `Uncategorized` and remain searchable by that filter.
4. Committee or voting information appropriate to that proposal. No inferred votes or invented individual feedback.
5. One footer: available engagement on the left, record/source action on the right.
6. Expanded discussion or record content below the footer.

Archive availability changes capabilities, not layout. A proposal without an imported archive links to its source and identifies the pending import; it must not fabricate likes, comments, historical versions or a blockchain proof. Imported records retain their stable record identifiers and existing engagement controls. No display enrichment rewrites a preserved source capture.

ESLint rejects standalone proposal-row markup and direct imports of the heading component outside `ProposalCard`. `npm run check:proposal-cards` runs this rule over every TSX surface before every production build, with inline suppressions disabled. Regression coverage includes all published decisions, the entire historical and review fixtures, source-only proposals, imported proposals and community submissions. A new source adapter must use this same component and satisfy those contracts.
