import { chatEntryResponse, chatServiceOrigin } from "@/lib/private-chat-entry";

export const dynamic = "force-dynamic";

export function GET() {
  return chatEntryResponse(Buffer.from(crypto.randomUUID()).toString("base64"), chatServiceOrigin());
}
