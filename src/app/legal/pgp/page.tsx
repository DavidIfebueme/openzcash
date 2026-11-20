import { redirect } from "next/navigation";

/** Keep existing PGP links working inside the unified Updates desk. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = new URLSearchParams({ source: "pgp" });
  for (const key of ["q", "region", "topic", "language"]) {
    const value = params[key];
    if (typeof value === "string") query.set(key, value);
  }
  redirect(`/legal?${query}#updates`);
}
