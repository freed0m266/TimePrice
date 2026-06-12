#!/usr/bin/env bash
# Renders the master icon (icon.svg) into the runtime PNGs WXT serves from public/icon/.
# WXT auto-detects public/icon/{16,32,48,96,128}.png and wires manifest `icons`;
# `action.default_icon` is wired explicitly in wxt.config.ts. Re-run after editing icon.svg.
#
# Requires librsvg (`brew install librsvg`). Run from the repo root or anywhere:
#   ./assets/icons/render.sh
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
src="$here/icon.svg"
out="$here/../../public/icon"
mkdir -p "$out"

for size in 16 32 48 96 128; do
  rsvg-convert -w "$size" -h "$size" "$src" -o "$out/$size.png"
  echo "rendered $out/$size.png"
done
