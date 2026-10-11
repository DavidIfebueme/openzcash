import { Participate } from "@/components/participate/participate";
import { DecisionHistory } from "@/components/participate/decision-history";
import { participationService } from "@/lib/participate/config";
import { participationUpstream } from "@/lib/participate/upstream";
import { pageMetadata } from "@/lib/seo/page-metadata";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Participate · ZCG · OpenZcash",
  description: "An independent participation pilot: explore ZCG proposals, discuss ideas and build a verifiable history. Designed to grow into community governance on Zcash.",
  path: "/zcg/participate",
});

export default async function ParticipatePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const requested = (await searchParams).view;
  const view = requested === "history" || requested === "committee" ? requested : "proposals";
  const service = participationService(Boolean(participationUpstream(process.env.PARTICIPATE_UPSTREAM_URL)));
  return <Participate service={service} view={view}>{!service && view === "history" ? <DecisionHistory /> : null}</Participate>;
}
