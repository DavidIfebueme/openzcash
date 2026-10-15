FROM node:26.12.0-trixie-slim@sha256:0d1e33586362bb9e608c4e751e7a9e7edb55c9ac11461ed5666af696cc461dd4
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl python3 util-linux tini libatomic1 && rm -rf /var/lib/apt/lists/*
RUN curl --fail --location --retry 3 https://github.com/nymtech/nym/releases/download/nym-binaries-v2026.20-glasgow/nym-client -o /usr/local/bin/nym-client \
 && echo '076391d969cf4dc8715ed2aa6650b43a34120b050c93fc760c511f5b48b2e4f5  /usr/local/bin/nym-client' | sha256sum -c - \
 && chmod 755 /usr/local/bin/nym-client \
 && /usr/local/bin/nym-client --version \
 && ln -s /data/nym /home/node/.nym
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY dist-private-chat ./dist-private-chat
COPY ops ./ops
ENV NODE_ENV=production PRIVATE_CHAT_DIRECTORY_DATA=/data/directory
ENTRYPOINT ["/usr/bin/tini", "-g", "--", "/bin/sh", "/app/ops/entrypoint.sh"]
