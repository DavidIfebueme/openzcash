import { Suspense } from "react";
import { EcosystemExplorer } from "@/components/ecosystem/explorer";
import { loadEcosystemCatalog } from "@/lib/ecosystem/data";
import { explorerCatalog } from "@/lib/ecosystem/explorer-catalog";
import { pageMetadata } from "@/lib/seo/page-metadata";

// The explorer's headline count, from the same checked snapshot.
const PROJECTS = loadEcosystemCatalog().registry.projects.length;

export const metadata = pageMetadata({
  title: "Ecosystem · OpenZcash",
  description: "Explore Zcash projects, maintainers, public code and source-linked funding history.",
  path: "/ecosystem",
  card: { stat: `${PROJECTS} projects & components` },
});

export default function EcosystemPage() {
  return (
    // useSearchParams inside the explorer needs a boundary for the static shell.
    <Suspense fallback={null}>
      <EcosystemExplorer catalog={explorerCatalog(loadEcosystemCatalog())} mode="ecosystem" />
    </Suspense>
  );
}
