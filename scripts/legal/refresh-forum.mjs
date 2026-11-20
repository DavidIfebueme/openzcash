// Run from the repository root. Select public posts in posts.json before refreshing.
import { readFile, writeFile } from "node:fs/promises";
const directory = "data/legal/forum";
const entries = JSON.parse(await readFile(directory + "/posts.json", "utf8"));
const snapshots = {};
for (const entry of entries) {
  if (!/^[a-z0-9-]+\/[1-9]\d*$/.test(entry.topic) || !Number.isSafeInteger(entry.number) || entry.number < 1) {
    throw new Error("Invalid topic or post number: " + entry.slug);
  }
  const url = new URL("https://forum.zcashcommunity.com/t/" + entry.topic + "/" + entry.number + ".json?include_raw=true");
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("Forum returned " + response.status + " for " + entry.slug);
  const topic = await response.json();
  const post = topic.post_stream.posts.find(post => post.post_number === entry.number);
  if (String(topic.id) !== entry.topic.split("/")[1] || !post || post.username !== "divijpandya" || post.hidden || post.deleted_at || !post.raw?.trim()) {
    throw new Error("Public post or author could not be verified: " + entry.slug);
  }
  snapshots[entry.slug] = { author: post.name || post.username, username: post.username, posted: post.created_at, revised: post.updated_at, markdown: post.raw };
}
await writeFile(directory + "/snapshots.json", JSON.stringify(snapshots, null, 2) + "\n");
