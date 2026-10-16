import "server-only";

/** Credentials are sent only to api.github.com, including repository transfers. */
export function createEcosystemGithubRequest({ token, signal, fetcher = fetch }: {
  token: string; signal: AbortSignal; fetcher?: typeof fetch;
}) {
  return async (endpoint: string, query?: string): Promise<unknown> => {
    try {
      if (!token || !/^(graphql$|(?:users|orgs|repos)\/)/.test(endpoint)) throw new Error();
      let url = new URL(endpoint, "https://api.github.com/");
      const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(60_000)]);
      for (let redirects = 0; redirects <= 3; redirects++) {
        if (url.origin !== "https://api.github.com" || url.username || url.password) throw new Error();
        requestSignal.throwIfAborted();
        const response = await fetcher(url, {
          method: query ? "POST" : "GET", redirect: "manual", cache: "no-store", signal: requestSignal,
          headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
            Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "OpenZcash-ecosystem" },
          ...(query ? { body: JSON.stringify({ query }) } : {}),
        });
        if ([301, 302, 307, 308].includes(response.status)) {
          const location = response.headers.get("location");
          await response.body?.cancel();
          if (!location || query) throw new Error();
          url = new URL(location, url);
          continue;
        }
        if (!response.ok) { await response.body?.cancel(); throw new Error(); }
        const result = await response.json();
        if (result?.errors?.length) throw new Error();
        return result;
      }
      throw new Error();
    } catch {
      // No response bodies, tokens, request headers or raw network errors.
      throw new Error("Public GitHub collection unavailable");
    }
  };
}
