import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { DISCOVERY_PATHS, PACKAGES, publishCopilot } from "./publish-copilot.mjs";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "zcg-public-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [name, files] of Object.entries(PACKAGES)) {
    for (const file of files) {
      const path = join(root, "skills", name, file);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, file === "SKILL.md" ? `---\nname: ${name}\ndescription: Public research\n---\n` : `test ${file}\n`);
    }
  }
  return root;
}

test("exports only the reviewed skill files and removes stale public files", async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, "skills/zcg-copilot/.env"), "PRIVATE_FIXTURE");
  await mkdir(join(root, "skills/private-skill"));
  await writeFile(join(root, "skills/private-skill/SKILL.md"), "PRIVATE_FIXTURE");
  await mkdir(join(root, "skills/zechub-copilot/scripts"));
  await writeFile(join(root, "skills/zechub-copilot/scripts/private.sh"), "PRIVATE_FIXTURE");
  await publishCopilot(root);
  await writeFile(join(root, "public/.well-known/agent-skills/zcg-copilot/stale.txt"), "old");
  await publishCopilot(root);
  for (const directory of DISCOVERY_PATHS) {
    const base = join(root, "public/.well-known", directory);
    const index = JSON.parse(await readFile(join(base, "index.json"), "utf8"));
    assert.deepEqual(index.skills.map((s) => s.name), Object.keys(PACKAGES));
    assert.deepEqual((await readdir(base)).sort(), ["index.json", ...Object.keys(PACKAGES)].sort());
    for (const entry of index.skills) {
      const files = PACKAGES[entry.name];
      assert.deepEqual(entry.files, files);
      const exported = await readdir(join(base, entry.name), { recursive: true });
      assert.deepEqual(exported.filter((f) => f !== "scripts").sort(), [...files].sort());
      for (const file of files) {
        assert.equal(await readFile(join(base, entry.name, file), "utf8"),
          await readFile(join(root, "skills", entry.name, file), "utf8"));
      }
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

test("an invalid later package leaves the previously published output untouched", async (t) => {
  const root = await fixture(t);
  await publishCopilot(root);
  const indexPath = join(root, "public/.well-known/agent-skills/index.json");
  const before = await readFile(indexPath, "utf8");
  await rm(join(root, "skills/zechub-copilot/SKILL.md"));
  await assert.rejects(publishCopilot(root), /ENOENT/);
  assert.equal(await readFile(indexPath, "utf8"), before);
});

test("rejects symlinked package directories before reading or publishing", async (t) => {
  const root = await fixture(t);
  await rm(join(root, "skills/coinholder-copilot"), { recursive: true });
  await symlink(join(root, "skills/zcg-copilot"), join(root, "skills/coinholder-copilot"));
  await assert.rejects(publishCopilot(root), /Refusing symlink/);
});
