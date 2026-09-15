/**
 * Admin write path for ZCG/FPF proposals (gated by the middleware via ADMIN_APIS).
 *   POST   — create an authored proposal (origin='admin').
 *   PATCH  — edit a proposal (e.g. change status); locks the row so the next
 *            spreadsheet import does not overwrite it.
 *   DELETE — admin rows only (hard delete). Sheet rows are refused: deleting an
 *            edited+locked sheet proposal would let the next import resurrect it
 *            unedited, silently discarding the admin's change.
 */
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { zcgProposals, zcgPublications } from "@/lib/db/schema";
import { normalizeKey } from "@/lib/zcg/normalize";
import { recordPublications } from "@/lib/zcg/publications-repo";
import { initialProposalVerdict, proposalPublicationKey, proposalVerdict, publishedValue, type PublicationState, type ProposalVerdict } from "@/lib/zcg/publication-policy";
import {
  proposalCreateSchema,
  proposalDeleteSchema,
  proposalPatchSchema,
} from "@/lib/zcg/admin/proposal-schema";

export const dynamic = "force-dynamic";

function usdToCents(usd: number | null | undefined): bigint | null {
  return usd == null ? null : BigInt(Math.round(usd * 100));
}
function clean(s: string | null | undefined): string | null {
  const v = (s ?? "").trim();
  return v === "" ? null : v;
}
function fail(e: unknown) {
  return Response.json(
    { ok: false, error: e instanceof Error ? e.message : String(e) },
    { status: 400 },
  );
}

export async function POST(req: Request) {
  try {
    const p = proposalCreateSchema.parse(await req.json());
    const title = p.title.trim();
    await getDb().transaction(async (tx) => {
      const [created] = await tx
        .insert(zcgProposals)
        .values({
          id: randomUUID(),
          program: p.program,
          title,
          titleKey: normalizeKey(title),
          status: p.status,
          statusRaw: p.status,
          applicantsRaw: clean(p.applicantsRaw),
          requestedUsdCents: usdToCents(p.requestedUsd),
          platformLink: clean(p.platformLink),
          forumLink: clean(p.forumLink),
          submittedDate: clean(p.submittedDate),
          country: clean(p.country),
          origin: "admin",
          sourceSheetGid: null,
          sourceRowIndex: null,
        }).returning();
      await recordPublications(tx, "proposal-status", [{
        key: proposalPublicationKey(created), value: proposalVerdict(created),
        initial: initialProposalVerdict(created),
      }]);
    });
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const p = proposalPatchSchema.parse(await req.json());
    // Editing locks the row so a re-import never clobbers the admin's change.
    const patch: Record<string, unknown> = { locked: true };
    if (p.status !== undefined) {
      patch.status = p.status;
      patch.statusRaw = p.status;
    }
    if (p.title !== undefined) {
      const t = p.title.trim();
      patch.title = t;
      patch.titleKey = normalizeKey(t);
    }
    if (p.applicantsRaw !== undefined)
      patch.applicantsRaw = clean(p.applicantsRaw);
    if (p.requestedUsd !== undefined)
      patch.requestedUsdCents = usdToCents(p.requestedUsd);
    if (p.platformLink !== undefined)
      patch.platformLink = clean(p.platformLink);

    await getDb().transaction(async (tx) => {
      const [old] = await tx.select().from(zcgProposals).where(eq(zcgProposals.id, p.id));
      if (!old) throw new Error("proposal not found");
      const [publication] = await tx.select().from(zcgPublications).where(and(
        eq(zcgPublications.scope, "proposal-status"),
        eq(zcgPublications.key, proposalPublicationKey(old)),
      ));
      const initial = publication
        ? publishedValue(publication as PublicationState<ProposalVerdict>) : proposalVerdict(old);
      const [updated] = await tx.update(zcgProposals).set(patch)
        .where(eq(zcgProposals.id, p.id)).returning();
      await recordPublications(tx, "proposal-status", [{
        key: proposalPublicationKey(updated), value: proposalVerdict(updated), initial,
      }]);
    });
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = proposalDeleteSchema.parse(await req.json());
    const db = getDb();
    const row = (
      await db
        .select({ origin: zcgProposals.origin })
        .from(zcgProposals)
        .where(eq(zcgProposals.id, id))
        .limit(1)
    ).at(0);
    if (!row) throw new Error("proposal not found");
    if (row.origin !== "admin")
      throw new Error(
        "sheet proposal — edit it instead of deleting (it would reappear on the next import; hiding sheet rows is not supported yet)",
      );
    await db.delete(zcgProposals).where(eq(zcgProposals.id, id));
    return Response.json({ ok: true, action: "deleted" });
  } catch (e) {
    return fail(e);
  }
}
