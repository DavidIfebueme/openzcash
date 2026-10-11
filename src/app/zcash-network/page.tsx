import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { NetworkDashboard } from "./network-dashboard";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Zcash Network · OpenZcash",
  description: "A live view of the Zcash network: blocks, mining, shielded value pools, supply and the next halving.",
};

export default function ZcashNetworkPage() {
  return <div className={geist.variable}><NetworkDashboard /></div>;
}
