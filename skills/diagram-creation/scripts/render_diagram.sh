#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: render_diagram.sh [options] INPUT.d2 [OUTPUT_BASE]

Validate D2 source, render SVG with D2, then render PNG with librsvg.
OUTPUT_BASE defaults to INPUT without its .d2 suffix.

Options:
  --theme ID       D2 theme ID (default: 200, Dark Mauve)
  --layout NAME    D2 layout engine (default: elk)
  --pad PIXELS     D2 canvas padding (default: 40)
  --zoom FACTOR    PNG zoom factor (default: 2 for crisp raster output)
  -h, --help       Show this help
EOF
}

fail() {
  printf 'render_diagram.sh: %s\n' "$*" >&2
  exit 1
}

theme=200
layout=elk
pad=40
zoom=2

while (($#)); do
  case "$1" in
    --theme)
      (($# >= 2)) || fail "--theme requires a value"
      theme=$2
      shift 2
      ;;
    --layout)
      (($# >= 2)) || fail "--layout requires a value"
      layout=$2
      shift 2
      ;;
    --pad)
      (($# >= 2)) || fail "--pad requires a value"
      pad=$2
      shift 2
      ;;
    --zoom)
      (($# >= 2)) || fail "--zoom requires a value"
      zoom=$2
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      break
      ;;
    -*)
      fail "unknown option: $1"
      ;;
    *)
      break
      ;;
  esac
done

(($# >= 1 && $# <= 2)) || {
  usage >&2
  exit 2
}

input=$1
output_base=${2:-${input%.d2}}
output_base=${output_base%.svg}
output_base=${output_base%.png}

[[ -f "$input" ]] || fail "input file not found: $input"
[[ "$input" == *.d2 ]] || fail "input must have a .d2 suffix: $input"
[[ -n "$output_base" ]] || fail "output base must not be empty"
for output in "$output_base.svg" "$output_base.png"; do
  if [[ -e "$output" && "$input" -ef "$output" ]]; then
    fail "refusing to overwrite the input through output path: $output"
  fi
done
command -v d2 >/dev/null 2>&1 || fail "d2 is required; on macOS run: brew install d2"
command -v rsvg-convert >/dev/null 2>&1 || fail "rsvg-convert is required; on macOS run: brew install librsvg"

output_dir=$(dirname "$output_base")
mkdir -p "$output_dir"
tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/diagram-render.XXXXXX")
cleanup() {
  rm -f "$tmp_dir/render.svg" "$tmp_dir/render.png"
  rmdir "$tmp_dir" 2>/dev/null || true
}
trap cleanup EXIT

d2 validate "$input"
d2 --bundle=false --layout="$layout" --theme="$theme" --pad="$pad" "$input" "$tmp_dir/render.svg"
external_refs=$(grep -Eo '(xlink:href|href)="[^"]+"' "$tmp_dir/render.svg" | grep -Ev '="(#|data:)' || true)
if [[ -n "$external_refs" ]]; then
  fail "rendered SVG contains an external resource or link; use D2 shapes or embedded data URIs"
fi
if grep -q '<foreignObject' "$tmp_dir/render.svg"; then
  fail "markdown labels (|md ... |) render as foreignObject and are dropped from the PNG; use plain text labels"
fi
rsvg-convert --zoom "$zoom" "$tmp_dir/render.svg" -o "$tmp_dir/render.png"

install -m 0644 "$tmp_dir/render.svg" "$output_base.svg"
install -m 0644 "$tmp_dir/render.png" "$output_base.png"

png_dimensions=$(file "$tmp_dir/render.png" | sed -nE 's/.*PNG image data, ([0-9]+) x ([0-9]+),.*/\1 \2/p')
printf 'Render: D2 %s; theme=%s; layout=%s; pad=%s; zoom=%s\n' "$(d2 --version)" "$theme" "$layout" "$pad" "$zoom"
if [[ -n "$png_dimensions" ]]; then
  read -r png_width png_height <<<"$png_dimensions"
  aspect_ratio=$(awk -v width="$png_width" -v height="$png_height" 'BEGIN { printf "%.2f", width / height }')
  printf 'Dimensions: PNG %sx%s; width/height=%s\n' "$png_width" "$png_height" "$aspect_ratio"
fi
printf 'SVG: %s\nPNG: %s\n' "$output_base.svg" "$output_base.png"
