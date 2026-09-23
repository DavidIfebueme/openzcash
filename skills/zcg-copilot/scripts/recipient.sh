#!/usr/bin/env bash
# Public read-only helper. Requires Python 3; no third-party packages.
set -euo pipefail
exec python3 "$(dirname "$0")/zcg.py" recipient "$@"
