import { loadEcosystemCatalog } from "@/lib/ecosystem/data";

export async function GET() {
  return Response.json(await loadEcosystemCatalog(), {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
