import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { chatEnabled } from "@/lib/private-chat/deployment";
import { chatParentOrigin } from "@/lib/private-chat/embedding";
import { PrivateChatPreview } from "./private-chat-preview";

export const metadata: Metadata = {
  title: "Private Chat · OpenZcash",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PrivateChatPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!chatEnabled()) notFound();
  const params = await searchParams;
  const embedded = params.embedded === "1";
  return <PrivateChatPreview parentOrigin={embedded ? chatParentOrigin() : null} portalShell={embedded && params.shell === "portal"} />;
}
