import { copyFile, lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Publish only these reviewed MIT-licensed files, never the private repository.
export const FILES = [
  "SKILL.md", "README.md", "LICENSE", "scripts/zcg.py",
  "scripts/search.sh", "scripts/recipient.sh", "scripts/summary.sh",
];
export const DISCOVERY_PATHS = ["agent-skills", "skills"];

export async function publishCopilot(root) {
  const source = join(root, "skills/zcg-copilot");
  const markdown = await readFile(join(source, "SKILL.md"), "utf8");
  const description = markdown.match(/^description: (.+)$/m)?.[1];
  if (!description) throw new Error("ZCG Copilot needs a discovery description");
  for (const file of FILES) {
    // Reject symlinks, including parent folders, before copying anything.
    let current = root;
    for (const part of ["skills", "zcg-copilot", ...file.split("/")]) {
      current = join(current, part);
      if ((await lstat(current)).isSymbolicLink()) throw new Error(`Refusing symlink: ${file}`);
    }
    if (!(await lstat(join(source, file))).isFile()) throw new Error(`Not a file: ${file}`);
  }
  const index = { skills: [{ name: "zcg-copilot", description, files: FILES }] };
  for (const discovery of DISCOVERY_PATHS) {
    const target = join(root, "public/.well-known", discovery);
    await rm(target, { recursive: true, force: true });
    for (const file of FILES) {
      const dest = join(target, "zcg-copilot", file);
      await mkdir(dirname(dest), { recursive: true });
      await copyFile(join(source, file), dest);
    }
    await writeFile(join(target, "index.json"), JSON.stringify(index, null, 2) + "\n");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await publishCopilot(fileURLToPath(new URL("..", import.meta.url)));
  console.log(`Published ZCG Copilot: ${FILES.length} allowlisted files`);
}
