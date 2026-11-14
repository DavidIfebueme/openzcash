import {
} from "@/components/workspace";
import { Badge, Card } from "@/components/ui";
import { OrgHeader } from "@/components/org-header";
import { IconShield } from "@/components/icons";
import { Suspense } from "react";
import { OrgUpdates } from "@/components/org-updates";
import { getShieldedLabsUpdates } from "@/lib/org-updates/forum";
import { pageMetadata } from "@/lib/seo/page-metadata";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Shielded Labs · OpenZcash",
  description:
    "Donation-funded and never paid from the Dev Fund or block rewards, Shielded Labs drives Crosslink (hybrid Proof-of-Stake) and the Network Sustainability Mechanism.",
  path: "/shielded-labs",
});

const SITE = "https://shieldedlabs.net/";
const CROSSLINK = "https://shieldedlabs.net/crosslink/";
const NSM = "https://shieldedlabs.net/nsm/";
const ROADMAP = "https://shieldedlabs.net/roadmap/";
const GITHUB = "https://github.com/ShieldedLabs";

type Zip = { id: string; title: string; desc: string; url: string };

// The Network Sustainability Mechanism as NU7 left it (ZIP 259): two ZIPs
// active, one still a draft. ZIP 234 (issuance smoothing) was replaced by 237.
const ZIPS: Zip[] = [
  {
    id: "ZIP 235",
    title: "60% of fees",
    desc: "Removes 60% of every block's transaction fees from circulation; miners keep the rest. Active since NU7, November 2026.",
    url: "https://zips.z.cash/zip-0235",
  },
  {
    id: "ZIP 237",
    title: "Reissuance that keeps the halvings",
    desc: "Holds the removed ZEC as a balance in consensus and returns it through block subsidies from block 8,939,664. Activated with NU7 in place of ZIP 234.",
    url: "https://zips.z.cash/zip-0237",
  },
  {
    id: "ZIP 233",
    title: "Voluntary removals",
    desc: "A transaction field for taking ZEC out of circulation by choice. A draft, not deployed with NU7.",
    url: "https://zips.z.cash/zip-0233",
  },
];

async function LiveUpdates() {
  const updates = await getShieldedLabsUpdates(12);
  return (
    <OrgUpdates
      updates={updates}
      title="Latest from Shielded Labs"
      sourceUrl="https://forum.zcashcommunity.com/search?q=%22Shielded%20Labs%22%20in%3Atitle"
      sourceLabel="Community forum"
      empty="No recent posts found on the forum."
    />
  );
}

export default function ShieldedLabsPage() {
  return (
    <>
      <OrgHeader
        name="Shielded Labs"
        logo="/logos/shielded-labs.png"
        tagline="An independent, donation-funded Zcash organization and the first that has never taken Development Fund or block-reward money. It drives two protocol-economics efforts: Crosslink (hybrid Proof-of-Stake) and the Network Sustainability Mechanism."
        links={[
          { href: SITE, label: "shieldedlabs.net" },
          { href: ROADMAP, label: "Roadmap & milestones" },
          { href: GITHUB, label: "GitHub · ShieldedLabs" },
          { href: NSM, label: "NSM overview" },
        ]}
        stats={[
          { label: "Funding", value: "Donations", sub: "independent, never Dev Fund" },
          { label: "Focus", value: "Protocol", sub: "economics & finality" },
          { label: "Efforts", value: "2", sub: "Crosslink · NSM" },
          { label: "Projects", value: "4", sub: "in the ecosystem registry" },
        ]}
      />
      <>
        <a href={CROSSLINK} target="_blank" rel="noreferrer" className="block">
          <Card
            interactive
            className="mb-6 border-amber-500/20 bg-amber-500/[0.05]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-amber-700/80">
                  <IconShield className="h-3.5 w-3.5" />
                  Crosslink
                </p>
                <p className="mt-1.5 text-sm font-medium text-stone-900">
                  Hybrid Proof-of-Work + Proof-of-Stake with BFT finality
                </p>
                <p className="mt-1 text-xs leading-relaxed text-stone-600">
                  Gives Zcash the combined security of PoW and PoS and lets
                  people get paid to hold ZEC. PoW and BFT finality are
                  integrated; staking &amp; tokenomics are in development, with
                  hardening and productionization (final ZIPs + audits) slated
                  for 2026.
                </p>
              </div>
              <Badge tone="amber">Milestone 4</Badge>
            </div>
          </Card>
        </a>

        <h2 className="mb-1 text-sm font-semibold text-stone-700">
          Network Sustainability Mechanism (NSM)
        </h2>
        <p className="mb-3 text-xs text-stone-600">
          Changes to ZEC supply economics: two active since NU7, one still a
          draft.{" "}
          <Link
            href="/nsm"
            className="text-amber-700 underline decoration-amber-500/40 underline-offset-2 hover:text-amber-800"
          >
            Live NSM balance
          </Link>{" "}
          ·{" "}
          <a
            href={NSM}
            target="_blank"
            rel="noreferrer"
            className="text-amber-700 underline decoration-amber-500/40 underline-offset-2 hover:text-amber-800"
          >
            Overview ↗
          </a>
        </p>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          {ZIPS.map((z) => (
            <a
              key={z.id}
              href={z.url}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              <Card interactive className="h-full">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-stone-900">
                    {z.title}
                  </p>
                  <Badge tone="zinc">{z.id}</Badge>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-stone-600">
                  {z.desc}
                </p>
              </Card>
            </a>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <a href={ROADMAP} target="_blank" rel="noreferrer" className="block">
            <Card
              interactive
              className="flex items-center justify-between gap-3"
            >
              <span className="text-sm font-medium text-stone-900">
                Roadmap
              </span>
              <span className="text-xs text-stone-600">milestones ↗</span>
            </Card>
          </a>
          <a href={GITHUB} target="_blank" rel="noreferrer" className="block">
            <Card
              interactive
              className="flex items-center justify-between gap-3"
            >
              <span className="text-sm font-medium text-stone-900">GitHub</span>
              <span className="text-xs text-stone-600">ShieldedLabs ↗</span>
            </Card>
          </a>
        </div>
        <Suspense
          fallback={
            <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-600 shadow-sm">
              Loading the latest posts...
            </div>
          }
        >
          <div className="mb-6">
            <LiveUpdates />
          </div>
        </Suspense>
      </>
    </>
  );
}
