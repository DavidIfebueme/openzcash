import "server-only";
import { z } from "zod";
import { junoBlockTime } from "./juno-block-time";

/**
 * ZecHub DAO governance feed.
 *
 * ZecHub runs as an on-chain DAO (cw-dao / DAO DAO) on Juno. We read its
 * proposals from the public indexer or directly from the Juno contract, and
 * cache one shared 50-proposal window for ten minutes.
 * Read-only: we never submit or vote.
 */

const DAO = "juno1nktrulhakwm0n3wlyajpwxyg54n39xx4y8hdaqlty7mymf85vweq7m6t0y";
// dao-proposal-single module (prefix "A") — holds every proposal; the DAO's
// multiple-choice module is currently empty.
const SINGLE_MODULE =
  "juno14futcfehnc8fn4nz6gtm25svn05mzz09ju8rtj0jvven2hpxj85s0q8a55";
const PREFIX = "A";
const INDEXER = "https://indexer.daodao.zone/juno-1/contract";
const TTL_MS = 10 * 60_000;
const RETRY_MS = 60_000;
const MAX_PROPOSALS = 50;
const CHAIN_QUERY_URL = `https://rest.cosmos.directory/juno/cosmwasm/wasm/v1/contract/${SINGLE_MODULE}/smart/${encodeURIComponent(Buffer.from(JSON.stringify({ reverse_proposals: { limit: MAX_PROPOSALS } })).toString("base64"))}`;

export const ZECHUB_DAO_URL = `https://daodao.zone/dao/${DAO}`;

export type ZechubProposal = {
  /** On-chain proposal id, e.g. 161. */
  id: number;
  /** Display reference, e.g. "A161". */
  ref: string;
  title: string;
  /** DAO DAO status: open | passed | executed | rejected | closed | … */
  status: string;
  createdAt: string; // ISO 8601, or "" when the source has no timestamp.
  /** On-chain creation block, used to recover dates if the indexer is down. */
  startHeight?: number;
  yes: number;
  no: number;
  abstain: number;
  proposer: string;
  url: string;
  /** The proposer's own text (budget included), cut at DESCRIPTION_CHARS; "" when the source has none. */
  description: string;
};

export type ZechubGovernance = {
  proposals: ZechubProposal[];
  status: "live" | "stale" | "unavailable";
  fetchedAt: string | null;
  source: "indexer" | "chain" | null;
};

const votes = z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()])
  .transform(Number).refine(Number.isSafeInteger);
const itemsSchema = z.array(z.object({
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  createdAt: z.string().optional(),
  proposal: z.object({
    title: z.string().trim().min(1), status: z.string().min(1),
    proposer: z.string(), description: z.string().optional(),
    start_height: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional().catch(undefined),
    votes: z.object({ yes: votes, no: votes, abstain: votes }),
  }),
})).max(MAX_PROPOSALS).refine((items) => new Set(items.map((item) => item.id)).size === items.length);

/** Long enough for a budget table, short enough to keep the shared cache small. */
export const DESCRIPTION_CHARS = 2_000;
function excerpt(text: string | undefined): string {
  const clean = (text ?? "").replace(/\r\n/g, "\n").trim();
  return clean.length > DESCRIPTION_CHARS
    ? `${clean.slice(0, DESCRIPTION_CHARS).trimEnd()}…`
    : clean;
}

let cache: ZechubGovernance | null = null;
let attemptedAt: number | null = null;
let pending: Promise<ZechubGovernance> | null = null;

async function read(source: "indexer" | "chain"): Promise<ZechubGovernance | null> {
  try {
    const res = await fetch(source === "indexer"
      ? `${INDEXER}/${SINGLE_MODULE}/daoProposalSingle/reverseProposals?limit=${MAX_PROPOSALS}`
      : CHAIN_QUERY_URL, {
      headers: { accept: "application/json" }, signal: AbortSignal.timeout(8_000), cache: "no-store",
    });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    const raw = source === "chain"
      ? z.object({ data: z.object({ proposals: itemsSchema }) }).parse(body).data.proposals
      : itemsSchema.parse(body);
    // This established DAO has proposal history. An empty indexer result is
    // unconfirmed until the contract itself reports it.
    if (source === "indexer" && !raw.length) return null;
    const proposals = raw.sort((a, b) => b.id - a.id).map((item): ZechubProposal => ({
      id: item.id, ref: `${PREFIX}${item.id}`, title: item.proposal.title,
      status: item.proposal.status,
      // Contract queries do not contain creation timestamps. Preserve a known
      // timestamp for the same ID; never substitute fetch time or expiry time.
      createdAt: item.createdAt && Number.isFinite(Date.parse(item.createdAt)) ? item.createdAt
        : cache?.proposals.find((previous) => previous.id === item.id)?.createdAt ?? "",
      startHeight: item.proposal.start_height,
      yes: item.proposal.votes.yes, no: item.proposal.votes.no, abstain: item.proposal.votes.abstain,
      proposer: item.proposal.proposer, url: `${ZECHUB_DAO_URL}/proposals/${PREFIX}${item.id}`,
      description: excerpt(item.proposal.description),
    }));
    return { proposals, status: "live", source, fetchedAt: new Date().toISOString() };
  } catch { return null; }
}

async function refresh(): Promise<ZechubGovernance> {
  attemptedAt = Date.now();
  const result = await read("indexer") ?? await read("chain");
  if (result) cache = result;
  else cache = cache?.fetchedAt ? { ...cache, status: "stale" }
    : { proposals: [], status: "unavailable", source: null, fetchedAt: null };
  return cache;
}

export async function getZechubGovernance(limit = 40): Promise<ZechubGovernance> {
  const count = Number.isFinite(limit) ? Math.min(MAX_PROPOSALS, Math.max(1, Math.trunc(limit))) : MAX_PROPOSALS;
  const now = Date.now();
  const fresh = cache?.status === "live" && cache.fetchedAt && now - Date.parse(cache.fetchedAt) < TTL_MS;
  const backoff = attemptedAt != null && now - attemptedAt < RETRY_MS;
  if (cache && (fresh || (!pending && backoff))) return { ...cache, proposals: cache.proposals.slice(0, count) };
  if (!pending) pending = refresh().finally(() => { pending = null; });
  const result = await pending;
  return { ...result, proposals: result.proposals.slice(0, count) };
}

/** News needs creation dates. Resolve only its requested window, not the whole DAO history. */
export async function getZechubProposals(limit = 30): Promise<ZechubProposal[]> {
  const { proposals } = await getZechubGovernance(limit);
  return Promise.all(proposals.map(async (proposal) => ({
    ...proposal,
    createdAt: proposal.createdAt || await junoBlockTime(proposal.startHeight),
  })));
}
