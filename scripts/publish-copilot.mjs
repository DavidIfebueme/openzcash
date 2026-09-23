import { copyFile, lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Publish only these reviewed MIT-licensed files, never the private repository.
export const PACKAGES = {
  "zcg-copilot": [
    "SKILL.md", "README.md", "LICENSE", "scripts/zcg.py",
    "scripts/search.sh", "scripts/recipient.sh", "scripts/summary.sh",
  ],
  "coinholder-copilot": ["SKILL.md", "README.md", "LICENSE"],
  "zechub-copilot": ["SKILL.md", "README.md", "LICENSE"],
};
export const DISCOVERY_PATHS = ["agent-skills", "skills"];

export async function publishCopilot(root) {
  const skills = [];
  // Validate every package before changing any published output.
  for (const [name, files] of Object.entries(PACKAGES)) {
    const source = join(root, "skills", name);
    for (const file of files) {
      // Reject symlinks, including parent folders, before copying anything.
      let current = root;
      for (const part of ["skills", name, ...file.split("/")]) {
        current = join(current, part);
        if ((await lstat(current)).isSymbolicLink()) throw new Error(`Refusing symlink: ${file}`);
      }
      if (!(await lstat(join(source, file))).isFile()) throw new Error(`Not a file: ${file}`);
    }
    const markdown = await readFile(join(source, "SKILL.md"), "utf8");
    const description = markdown.match(/^description: (.+)$/m)?.[1];
    if (!description || !markdown.includes(`name: ${name}\n`)) throw new Error(`Invalid discovery metadata: ${name}`);
    skills.push({ name, description, files });
  }
  const index = { skills };
  for (const discovery of DISCOVERY_PATHS) {
    const target = join(root, "public/.well-known", discovery);
    await rm(target, { recursive: true, force: true });
    for (const { name, files } of skills) {
      for (const file of files) {
        const dest = join(target, name, file);
        await mkdir(dirname(dest), { recursive: true });
        await copyFile(join(root, "skills", name, file), dest);
      }
    }
    await writeFile(join(target, "index.json"), JSON.stringify(index, null, 2) + "\n");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await publishCopilot(fileURLToPath(new URL("..", import.meta.url)));
  console.log(`Published ${Object.keys(PACKAGES).length} copilots: ${Object.values(PACKAGES).flat().length} allowlisted files`);
}
