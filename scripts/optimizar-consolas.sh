#!/bin/sh
# Optimiza imágenes de consola como TinyPNG: recorta el borde transparente, reduce a 480 px,
# cuantiza la paleta (pngquant), quita metadatos y recomprime (optipng).
#   sh scripts/optimizar-consolas.sh <origen.png> <slug>   → public/consolas/<slug>.png
set -e
DEST="$(dirname "$0")/../public/consolas/$2.png"
convert "$1[0]" -strip -trim +repage -resize '480x480>' -define png:color-type=6 /tmp/gv-opt.png
pngquant --quality=60-85 --speed 1 --strip --force --output "$DEST" /tmp/gv-opt.png || cp /tmp/gv-opt.png "$DEST"
optipng -quiet -fix -o5 -strip all "$DEST"
echo "$2: $(($(stat -c%s "$1")/1024)) KB → $(($(stat -c%s "$DEST")/1024)) KB"
