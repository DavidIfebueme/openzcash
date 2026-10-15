import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve, basename } from 'node:path';
const root = process.cwd();
const mode = process.argv[2];
if (!['web', 'directory'].includes(mode)) throw new Error('Choose web or directory');
const destination = resolve(root, 'tmp', `private-chat-pilot-${mode}`);
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
const copy = (source, target = source) => cp(join(root, source), join(destination, target), {
  recursive: true,
  filter: path => !['.DS_Store', '__pycache__'].includes(basename(path)) && !basename(path).startsWith('._') && !basename(path).startsWith('.env'),
});
if (mode === 'directory') {
  await copy('dist-private-chat');
  await copy('ops/private-chat/directory/package.json', 'package.json');
  await copy('ops/private-chat/directory/package-lock.json', 'package-lock.json');
  await copy('ops/private-chat/directory/Dockerfile', 'Dockerfile');
  for (const file of ['entrypoint.sh', 'native.mjs', 'bootstrap.mjs', 'service.mjs', 'configure.py']) await copy(`ops/private-chat/directory/${file}`, `ops/${file}`);
  await copy('scripts/private-chat-directory-lock.py', 'ops/private-chat-directory-lock.py');
} else {
  for (const path of ['src', 'public', 'scripts', 'skills', 'ops/error-fallback', 'data', 'drizzle', 'package.json', 'package-lock.json', 'next.config.ts', 'postcss.config.mjs', 'tsconfig.json']) await copy(path);
  await copy('ops/private-chat/Dockerfile.web', 'Dockerfile');
  await rm(join(destination, 'public/private-chat-nym'), { recursive: true, force: true });
  const pkg = JSON.parse(await readFile(join(destination, 'package.json'), 'utf8'));
  // The portal's release checks already passed; keep pilot builds focused and reproducible.
  pkg.scripts.prebuild = 'node scripts/stage-private-chat-nym.mjs';
  await writeFile(join(destination, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
}
await writeFile(join(destination, '.dockerignore'), '.git\nnode_modules\n.env*\ntmp\n**/._*\n**/.DS_Store\n');
process.stdout.write(`Staged ${mode} deployment source in ${destination}\n`);
