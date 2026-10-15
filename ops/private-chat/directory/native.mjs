import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import WebSocket from 'ws';
const require = createRequire(import.meta.url);
const { nativeSelfAddress, parseNativeFrame } = require('../dist-private-chat/src/lib/private-chat/native-wire.js');
export const configPath = '/home/node/.nym/clients/openzcash-directory/config/config.toml';
export function command(file, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { stdio: 'ignore' });
    const timer = setTimeout(() => child.kill('SIGKILL'), 240_000);
    child.once('error', () => { clearTimeout(timer); reject(new Error('Operator command failed')); });
    child.once('exit', code => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error('Operator command failed'));
    });
  });
}
export function startNative() {
  return spawn('nym-client', ['run', '--id', 'openzcash-directory'], { stdio: 'ignore' });
}
export async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise(resolve => {
    const timer = setTimeout(() => child.kill('SIGKILL'), 8000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    child.kill('SIGTERM');
  });
}
export async function selfAddress(child) {
  for (let attempt = 0; attempt < 90; attempt++) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error('Native client stopped');
    const address = await new Promise(resolve => {
      const socket = new WebSocket('ws://127.0.0.1:1977', { handshakeTimeout: 1000 });
      let settled = false;
      const finish = value => { if (settled) return; settled = true; clearTimeout(timer); socket.terminate(); resolve(value); };
      const timer = setTimeout(() => finish(null), 1500);
      socket.on('error', () => finish(null));
      socket.on('open', () => socket.send(nativeSelfAddress()));
      socket.on('message', (data, binary) => {
        const event = binary ? parseNativeFrame(Buffer.from(data)) : null;
        if (event?.kind === 'address') finish(event.address);
      });
    });
    if (address) return address;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Native client did not become ready');
}
