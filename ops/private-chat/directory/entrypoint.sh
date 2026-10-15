#!/bin/sh
set -eu
umask 077
test "${RAILWAY_VOLUME_MOUNT_PATH:-}" = /data
install -d -m 700 -o node -g node /data/nym /data/directory
if [ "${PRIVATE_CHAT_SERVICE_MODE:-run}" = setup ]; then
  exec runuser -u node -- node -e 'console.log("Pilot setup mode: waiting for explicit initialization."); setInterval(() => {}, 60000);'
fi
exec runuser -u node -- flock --no-fork --nonblock /data/nym/process.lock node /app/ops/service.mjs
