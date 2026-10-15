// Explicit operator action, invoked under /data/nym/process.lock. Never called by startup.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { command, configPath, selfAddress, startNative, stopChild } from './native.mjs';
let native;
try {
  if (!process.env.PRIVATE_CHAT_DIRECTORY_STORAGE_KEY) throw new Error('Storage key required');
  if (!existsSync(configPath)) await command('nym-client', ['init', '--id', 'openzcash-directory']);
  await command('python3', ['/app/ops/configure.py', 'configure']);
  native = startNative();
  process.env.PRIVATE_CHAT_DIRECTORY_ADDRESS = await selfAddress(native);
  await command('python3', ['/app/ops/private-chat-directory-lock.py', 'node', '/app/dist-private-chat/scripts/private-chat-directory-init.js']);
  const descriptor = JSON.parse(await readFile('/data/directory/descriptor.json', 'utf8'));
  // Public pins only. No storage key, room token, or native private key is printed.
  process.stdout.write(JSON.stringify(descriptor) + '\n');
} catch {
  process.stderr.write('Explicit pilot initialization failed; inspect configuration privately.\n');
  process.exitCode = 1;
} finally {
  await stopChild(native);
}
