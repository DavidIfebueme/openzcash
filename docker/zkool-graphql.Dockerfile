# zkool_graphql - Zcash watch-only wallet engine (UFVK) exposed via GraphQL.
# Source: github.com/hhanh00/zkool2 (MIT license). Builds from source and runs a
# slim binary that connects to a public lightwalletd (no own full node).
#
# NOTE: the first build is HEAVY (~15-20 min; downloads the Zcash crates and compiles in release).
# For reproducibility, pin ZKOOL_REF to a tag/commit (e.g. --build-arg ZKOOL_REF=v6.21.0).

# -- build: compile zkool_graphql --
FROM rust:1-bookworm AS build
RUN apt-get update && apt-get install -y --no-install-recommends \
      git clang cmake pkg-config libssl-dev protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*
ARG ZKOOL_REF=main
WORKDIR /src
RUN git clone https://github.com/hhanh00/zkool2.git . && git checkout "${ZKOOL_REF}"
WORKDIR /src/rust
RUN cargo build --release --bin zkool_graphql

# -- runtime: slim image with only the binary --
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      libssl3 ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/rust/target/release/zkool_graphql /usr/local/bin/zkool_graphql
WORKDIR /data
EXPOSE 8000
# SQLite DB on a volume, public mainnet lightwalletd, GraphQL on :8000 (endpoint /graphql).
ENTRYPOINT ["zkool_graphql"]
CMD ["-d", "/data/zkool.db", "-l", "https://zec.rocks", "-p", "8000"]
