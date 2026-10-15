import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { command, configPath, selfAddress, startNative, stopChild } from './native.mjs';
let native, runtime, stopping = false;
async function stop(code) {
  if (stopping) return;
  stopping = true;
  await stopChild(runtime);
  await stopChild(native);
  process.exit(code);
}
process.once('SIGTERM', () => void stop(0));
process.once('SIGINT', () => void stop(0));
try {
  if (!existsSync(configPath) || !existsSync('/data/directory/identity.sealed') || !existsSync('/data/directory/binding.sealed'))
    throw new Error('Explicit initialization required');
  await command('python3', ['/app/ops/configure.py']);
  native = startNative();
  native.once('exit', () => { if (!stopping) void stop(1); });
  if (await selfAddress(native) !== process.env.PRIVATE_CHAT_DIRECTORY_ADDRESS) throw new Error('Native identity changed');
  runtime = spawn('python3', ['/app/ops/private-chat-directory-lock.py', 'node', '/app/dist-private-chat/scripts/private-chat-directory-server.js'], { stdio: ['ignore', 'inherit', 'inherit'] });
  runtime.once('exit', () => { if (!stopping) void stop(1); });
  runtime.once('error', () => void stop(1));
} catch {
  process.stderr.write('Pilot failed closed: native identity or runtime unavailable.\n');
  await stop(1);
}
