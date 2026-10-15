import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  validDirectoryConfig,
  type DirectoryConfig,
} from "@/lib/private-chat/directory-wire";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { chatEnabled, pilotDeployment } from "@/lib/private-chat/deployment";
import { PrivateChatPreview } from "./private-chat-preview";

export const metadata: Metadata = {
  title: "Private Chat · OpenZcash",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PrivateChatPage() {
  if (!chatEnabled()) notFound();
  let directoryConfig: DirectoryConfig | null = pilotDeployment()?.directory ?? null;
  if (process.env.NODE_ENV === "development") try {
    const value = JSON.parse(
      await readFile(
        join(process.cwd(), "tmp/private-chat-directory.json"),
        "utf8",
      ),
    );
    if (validDirectoryConfig(value)) directoryConfig = value;
  } catch {
    /* Discover stays unavailable until a Nym provider is configured. */
  }
  return <PrivateChatPreview directoryConfig={directoryConfig} />;
}
