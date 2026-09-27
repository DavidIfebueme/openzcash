import "server-only";
// Only public data summaries. Never cache prompts, chat histories or generated answers.
type Entry = { expires: number; value: unknown };
const values = new Map<string, Entry>();
const pending = new Map<string, Promise<unknown>>();
const MAX = 100;
export async function cachedPublic<T>(key: string, ttl: number, read: () => Promise<T>): Promise<T> {
  const hit = values.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  values.delete(key);
  const underway = pending.get(key);
  if (underway) return underway as Promise<T>;
  // Do not retain unbounded concurrent queries or enormous public datasets.
  if (pending.size >= MAX) return read();
  const task = read().then((value) => {
    if (JSON.stringify(value).length < 30_000) {
      if (values.size >= MAX) values.delete(values.keys().next().value!);
      values.set(key, { expires: Date.now() + ttl, value });
    }
    return value;
  }).finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}
export function clearPublicCache() { values.clear(); }
