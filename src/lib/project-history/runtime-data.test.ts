import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@/lib/ecosystem/data", () => ({ loadEcosystemCatalog: mocks.load }));
import registry from "@/data/ecosystem/registry.json";
import snapshot from "@/data/ecosystem/snapshot.json";
import { projectHistoryDirectory } from "./data";
import type { Catalog } from "@/lib/ecosystem/types";
it("rebuilds history identities when the runtime publication changes without a module restart", async () => {
  const first = { registry, snapshot } as unknown as Catalog;
  const updated = { registry: first.registry, snapshot: { ...first.snapshot, collectedAt: "2026-10-17T03:30:00.000Z",
    repositories: first.snapshot.repositories.map(repo => repo.fullName === "chainapsis/vizor-wallet" ? { ...repo, stars: repo.stars + 1 } : repo) } };
  mocks.load.mockResolvedValueOnce(first).mockResolvedValueOnce(first).mockResolvedValue(updated);
  const before = await projectHistoryDirectory();
  expect(await projectHistoryDirectory()).toBe(before);
  const after = await projectHistoryDirectory();
  expect(after).not.toBe(before);
  const oldRepo = before.find(item => item.id === "vizor-wallet")!.repositories.find(repo => repo.fullName === "chainapsis/vizor-wallet")!;
  const newRepo = after.find(item => item.id === "vizor-wallet")!.repositories.find(repo => repo.fullName === oldRepo.fullName)!;
  expect(newRepo.stars).toBe(oldRepo.stars + 1);
  expect(after.find(item => item.id === "vizor-wallet")!.checkedAt).toBe(before.find(item => item.id === "vizor-wallet")!.checkedAt);
});
