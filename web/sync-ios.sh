#!/bin/sh
# Rebuild the rules bundle and copy the web game into the iOS app (flat folder, picked up by the synchronized group).
set -e
cd "$(dirname "$0")"
export PATH="$HOME/.airlineroom-tools/node/bin:$PATH"
(cd ../core && npm run -s bundle)
DEST=../ios/AirDefenceDuel/Web
rm -rf "$DEST" && mkdir -p "$DEST"
cp index.html game.js core.js three.min.js fonts.css *.woff2 "$DEST"/
echo "web → $DEST"
