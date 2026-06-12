#!/usr/bin/env bash
# Regenerates the Chrome Web Store graphics (4 screenshots + promo tile) from generate.py.
# Thin wrapper so the render step matches assets/icons/render.sh. Re-run after editing
# generate.py. Requires Python 3 and librsvg (`brew install librsvg`).
#
#   ./marketing/store/render.sh
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$here/generate.py"
