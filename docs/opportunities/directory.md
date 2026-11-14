# Opportunities directory

OpenZcash is a discovery and preparation surface. Account creation, publication,
applications, submissions and rewards happen on the linked source platform.

- `/opportunities`: a mixed listing of public ZEC Bounties records and curated
  Gleyo, Yukon, Crosslink and official career destinations.
- `/opportunities/platforms`: provider instructions and canonical links.
- `/opportunities/art`: 29 stock covers (27 existing, plus ZecHub and NU7), searchable and downloadable.
- `/opportunities/prepare`: a tab-local Gleyo or ZEC Bounties brief, cover selection,
  clipboard handoff and outbound continuation. No write endpoint, account or upload.
- Legacy example URLs redirect to the directory; HashSmash and Crosslink keep
  dedicated destinations. Crosslink deep-links to its existing Incentives tab.

ZEC Bounties is read anonymously from its documented `https://zechub.zone/api/bounties`
endpoint. Pagination is bounded to 40 pages of 50, four requests at a time, with a
12-second overall deadline. Partial and unavailable reads are shown explicitly.
Only approved, public, unassigned, unexpired MAIN records are projected. Suggested,
assigned, private and terminal records are excluded. Raw user/payment fields are
never passed to the browser or stored by the module. The source still determines
eligibility; the CTA reads "View on ZEC Bounties", not a promise of acceptance.

Each server process caches only the normalized catalog for 15 minutes on success
and one minute on an incomplete/failed read. Expired data is replaced on failure,
not retained as current. Source URLs are fixed or constructed from validated IDs.
No third-party image content is loaded from bounty descriptions.

Every page supplies its freshly validated catalog to the client. Visible listing
and detail pages refresh their server data every minute and when the tab regains
focus, while keeping the session's mixed order. Expired deadlines are removed on
each server read. Preparation pages do not poll or reset their drafts.

Gleyo had no validated anonymous feed during research on 2026-11-03: the tested
search route redirected to login. It is represented by a curated program link;
no private/session-based scraping is used. Job entries link to employer pages and
show their checked date, without inventing salaries or application eligibility.
HashSmash follows Yukon rules and has no added OpenZcash monthly prize. Crosslink
incentive amounts and claim windows remain in the existing source-backed guide.

Artwork is editorial. Locale flags are only rendered from explicit source metadata.
The existing beta's example rewards, accounts and submission model were removed.

Sources: https://bounties.zechub.wiki/docs/api,
https://bounties.zechub.wiki/docs/creators,
https://bounties.zechub.wiki/docs/task-statuses,
https://gleyo.app/documentation, https://www.yukon.org/hashsmash,
https://shieldedlabs.net/jobs/, https://jobs.ashbyhq.com/zodl.
