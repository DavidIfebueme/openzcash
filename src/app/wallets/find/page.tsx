import { Suspense } from "react";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { WalletFinder } from "./finder";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Wallet Finder · OpenZcash",
  description: "Find Zcash wallets for your platform, privacy and signing needs, with sources and the limits of what has been verified.",
  path: "/wallets/find",
  card: { kicker: "Wallet capabilities, checked against your needs" },
});

export default function WalletFinderPage() {
  return <Suspense fallback={<p role="status">Loading Wallet Finder…</p>}><WalletFinder /></Suspense>;
}
