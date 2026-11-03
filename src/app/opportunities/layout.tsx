import { randomInt } from "node:crypto";
import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { OpportunitiesLayout } from "@/components/opportunities/frame";
import {
  sampleOpportunities,
  sampleCampaigns,
} from "@/components/opportunities/model";
import { randomOrder } from "@/components/opportunities/order";
import "@/components/opportunities/opportunities.css";

export default async function Layout({ children }: { children: ReactNode }) {
  await connection();
  const random = () => randomInt(0x100000000) / 0x100000000;
  const order = randomOrder(
    sampleOpportunities.map((o) => o.id),
    random,
  );
  const campaigns = randomOrder(
    sampleCampaigns.map((c) => c.id),
    random,
  );
  return (
    <Suspense fallback={null}>
      <OpportunitiesLayout initialOrder={order} campaignOrder={campaigns}>
        {children}
      </OpportunitiesLayout>
    </Suspense>
  );
}
