import { randomInt } from "node:crypto";
import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { OpportunitiesLayout } from "@/components/opportunities/frame";
import { getCatalog } from "@/components/opportunities/catalog.server";
import { randomOrder } from "@/components/opportunities/order";
import "@/components/opportunities/opportunities.css";
async function CatalogLayout({ children }: { children: ReactNode }) {
  await connection();
  const catalog = await getCatalog();
  const items = randomOrder(catalog.items, () => randomInt(0x100000000) / 0x100000000);
  return <OpportunitiesLayout catalog={{ ...catalog, items }}>{children}</OpportunitiesLayout>;
}
export default function Layout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="opportunities-beta"><div className="op-page" role="status">Loading opportunities…</div></div>}><CatalogLayout>{children}</CatalogLayout></Suspense>;
}
