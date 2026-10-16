import WalletCatalog from "./catalog";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { HARDWARE, SOFTWARE } from "./catalog-data";
export const dynamic = "force-dynamic";

// The same evidence-derived default counts as the catalog stat row.
const WALLETS = [...SOFTWARE, ...HARDWARE];
const FULL_SHIELDED = WALLETS.filter((w) => w.shielded === "full").length;

export const metadata = pageMetadata({
  title: "Zcash Wallets · OpenZcash",
  description:
    "Explore Zcash wallets with platform-specific evidence for shielded sending and receiving.",
  path: "/wallets",
  card: { stat: `${WALLETS.length} wallets · ${FULL_SHIELDED} shielded both ways` },
});
export default function WalletsPage() {
  return <WalletCatalog />;
}
