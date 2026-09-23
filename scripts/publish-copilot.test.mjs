import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { DISCOVERY_PATHS, FILES, publishCopilot } from "./publish-copilot.mjs";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "zcg-public-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const file of FILES) {
    const path = join(root, "skills/zcg-copilot", file);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, file === "SKILL.md" ? "---\nname: zcg-copilot\ndescription: Public research\n---\n" : `test ${file}\n`);
  }
  return root;
}

test("exports only the reviewed skill files and removes stale public files", async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, "skills/zcg-copilot/.env"), "PRIVATE_FIXTURE");
  await mkdir(join(root, "skills/private-skill"));
  await writeFile(join(root, "skills/private-skill/SKILL.md"), "PRIVATE_FIXTURE");
  await publishCopilot(root);
  await writeFile(join(root, "public/.well-known/agent-skills/zcg-copilot/stale.txt"), "old");
  await publishCopilot(root);
  for (const directory of DISCOVERY_PATHS) {
    const base = join(root, "public/.well-known", directory);
    const index = JSON.parse(await readFile(join(base, "index.json"), "utf8"));
    assert.equal(index.skills.length, 1);
    assert.deepEqual(index.skills[0].files, FILES);
    const exported = await readdir(join(base, "zcg-copilot"), { recursive: true });
    assert.deepEqual(exported.filter((f) => f !== "scripts").sort(), [...FILES].sort());
    for (const file of FILES) {
      assert.equal(await readFile(join(base, "zcg-copilot", file), "utf8"),
        await readFile(join(root, "skills/zcg-copilot", file), "utf8"));
    }
  }
});

test("rejects symlinked publication files", async (t) => {
  const root = await fixture(t);
  const path = join(root, "skills/zcg-copilot/LICENSE");
  await writeFile(join(root, "private.txt"), "PRIVATE_FIXTURE");
  await rm(path);
  await symlink(join(root, "private.txt"), path);
  await assert.rejects(publishCopilot(root), /Refusing symlink/);
});

test("missing helpers stop publication instead of advertising an incomplete package", async (t) => {
  const root = await fixture(t);
  await rm(join(root, "skills/zcg-copilot/scripts/zcg.py"));
  await assert.rejects(publishCopilot(root), /ENOENT/);
});
