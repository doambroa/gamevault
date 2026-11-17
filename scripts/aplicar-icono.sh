#!/bin/sh
# Regenera todos los iconos (Windows, web/iPhone, Android, instalador) a partir de buildres/icon.svg
# Uso: sh scripts/aplicar-icono.sh [otro.svg]   (necesita rsvg-convert e ImageMagick)
set -e
cd "$(dirname "$0")/.."
SRC=${1:-buildres/icon.svg}
[ "$SRC" != buildres/icon.svg ] && cp "$SRC" buildres/icon.svg
r() { rsvg-convert -w "$1" -h "$1" buildres/icon.svg -o "$2"; }
r 1024 buildres/icon.png; r 512 buildres/icon512.png
r 512 public/icon-512.png; r 192 public/icon-192.png; r 64 public/favicon.png
rsvg-convert -w 180 -h 180 -b '#0b0d1a' buildres/icon.svg -o public/apple-touch-icon.png
for d in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do r "${d#*:}" "android/res/mipmap-${d%%:*}/ic_launcher.png"; done
T=$(mktemp -d)
for s in 16 24 32 48 64 128 256; do r $s "$T/$s.png"; done
convert "$T"/16.png "$T"/24.png "$T"/32.png "$T"/48.png "$T"/64.png "$T"/128.png "$T"/256.png buildres/icon.ico
# Imagen lateral del instalador (164×314, BMP de 24 bits)
r 120 "$T/side.png"
convert -size 164x314 gradient:'#1b2140'-'#08080f' "$T/side.png" -gravity north -geometry +0+60 -composite \
  -font DejaVu-Sans-Bold -pointsize 17 -fill '#f4f5fa' -gravity north -annotate +0+196 'GAMEVAULT' \
  -type TrueColor BMP3:buildres/sidebar.bmp
rm -rf "$T"
echo "Iconos regenerados desde $SRC"
