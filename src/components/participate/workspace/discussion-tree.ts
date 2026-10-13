type ThreadComment = { id: string; parentId: string | null; createdAt: string };

// Deeper replies keep their real parent; only the current view is shortened.
export const VISIBLE_REPLY_DEPTH = 3;

export function indexDiscussion<T extends ThreadComment>(comments: T[], order: "oldest" | "newest") {
  const byId = new Map(comments.map(comment => [comment.id, comment]));
  const children = new Map<string, T[]>();
  const roots: T[] = [];
  for (const comment of byId.values()) {
    if (!comment.parentId || !byId.has(comment.parentId) || comment.parentId === comment.id) roots.push(comment);
    else {
      const siblings = children.get(comment.parentId) ?? [];
      siblings.push(comment);
      children.set(comment.parentId, siblings);
    }
  }
  const chronological = (a: T, b: T) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
  roots.sort((a, b) => order === "oldest" ? chronological(a, b) : chronological(b, a));
  for (const siblings of children.values()) siblings.sort(chronological);
  return { byId, children, roots };
}

export function commentAncestors<T extends ThreadComment>(byId: Map<string, T>, id: string) {
  const ancestors: T[] = [];
  const seen = new Set([id]);
  let parentId = byId.get(id)?.parentId;
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    ancestors.unshift(parent);
    parentId = parent.parentId;
  }
  return ancestors;
}

export function descendantCount<T extends ThreadComment>(children: Map<string, T[]>, id: string) {
  const pending = [...children.get(id) ?? []];
  const seen = new Set([id]);
  while (pending.length) {
    const comment = pending.pop()!;
    if (seen.has(comment.id)) continue;
    seen.add(comment.id);
    pending.push(...children.get(comment.id) ?? []);
  }
  return seen.size - 1;
}
