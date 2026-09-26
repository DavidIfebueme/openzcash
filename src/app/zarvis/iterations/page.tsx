import { notFound } from "next/navigation";
import { ZarvisIterations } from "@/components/zarvis/zarvis-iterations";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Zarvis iterations · OpenZcash",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ZarvisIterations/>;
}
