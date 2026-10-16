import { projectHistoryDirectory } from "@/lib/project-history/data";
import { searchHistoryIdentities } from "@/lib/project-history/identities";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.length > 120) return Response.json({ error: "Search is limited to 120 characters." }, { status: 400 });
  const items = searchHistoryIdentities(await projectHistoryDirectory(), q).map(({ id, name, description, category }) => ({
    id, name, description, category, url: `https://openzcash.org/ecosystem/history/${id}`,
  }));
  return Response.json({ schemaVersion: 1, count: items.length, data: items }, { headers: { "Cache-Control": "public, max-age=60", "X-Content-Type-Options": "nosniff" } });
}
