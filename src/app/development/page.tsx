import { connection } from "next/server";
import { Suspense } from "react";
import { EcosystemExplorer } from "@/components/ecosystem/explorer";
import { loadEcosystemCatalog } from "@/lib/ecosystem/data";
import { explorerCatalog } from "@/lib/ecosystem/explorer-catalog";
import { pageMetadata } from "@/lib/seo/page-metadata";

export const metadata = pageMetadata({
  title: "Development · OpenZcash",
  description: "Public Zcash repository inventory with real default-branch activity, releases, purpose tags and historical funding sources.",
  path: "/development",
});

export default async function DevelopmentPage() {
  await connection();
  const catalog = await loadEcosystemCatalog();
  return (
    // useSearchParams inside the explorer needs a boundary for the static shell.
    <Suspense fallback={null}>
      <EcosystemExplorer catalog={explorerCatalog(catalog)} mode="development" />
    </Suspense>
  );
}
