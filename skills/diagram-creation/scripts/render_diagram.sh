#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: render_diagram.sh [options] INPUT.d2 [OUTPUT_BASE]

Validate D2 source, render SVG and PNG, then create temporary review images.
OUTPUT_BASE defaults to INPUT without its .d2 suffix.

Options:
  --theme ID            D2 theme ID (default: 200, Dark Mauve)
  --layout NAME         D2 layout engine (default: elk)
  --pad PIXELS          D2 canvas padding (default: 40)
  --zoom FACTOR         PNG zoom factor (default: 2)
  --preview-width PX    Review preview width (default: 980)
  --crop-size PX        Maximum native crop width/height (default: 1900)
  --crop-overlap PX     Native crop overlap (default: 200)
  --review-dir DIR      Review output directory (default: a new temp directory)
  --no-review-images    Do not create a preview or native crops
  -h, --help            Show this help

The review directory must not already exist. Remove it after visual inspection.
EOF
}

fail() {
  printf 'render_diagram.sh: %s\n' "$*" >&2
  exit 1
}

positive_integer() {
  [[ "$1" =~ ^[1-9][0-9]*$ ]]
}

nonnegative_integer() {
  [[ "$1" =~ ^[0-9]+$ ]]
}

theme=200
layout=elk
pad=40
zoom=2
preview_width=980
crop_size=1900
crop_overlap=200
review_dir=""
review_images=1

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
    --preview-width)
      (($# >= 2)) || fail "--preview-width requires a value"
      preview_width=$2
      shift 2
      ;;
    --crop-size)
      (($# >= 2)) || fail "--crop-size requires a value"
      crop_size=$2
      shift 2
      ;;
    --crop-overlap)
      (($# >= 2)) || fail "--crop-overlap requires a value"
      crop_overlap=$2
      shift 2
      ;;
    --review-dir)
      (($# >= 2)) || fail "--review-dir requires a value"
      review_dir=$2
      shift 2
      ;;
    --no-review-images)
      review_images=0
      shift
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

positive_integer "$preview_width" || fail "--preview-width must be a positive integer"
positive_integer "$crop_size" || fail "--crop-size must be a positive integer"
nonnegative_integer "$crop_overlap" || fail "--crop-overlap must be a non-negative integer"
((crop_overlap < crop_size)) || fail "--crop-overlap must be smaller than --crop-size"
((review_images == 1)) || [[ -z "$review_dir" ]] || fail "--review-dir cannot be combined with --no-review-images"

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
command -v file >/dev/null 2>&1 || fail "file is required"

if ((review_images == 1)); then
  if [[ -z "$review_dir" ]]; then
    review_dir=$(mktemp -d "${TMPDIR:-/tmp}/diagram-review.XXXXXX")
    rmdir "$review_dir"
  else
    [[ ! -e "$review_dir" && ! -L "$review_dir" ]] || fail "review directory already exists: $review_dir"
  fi
fi

output_dir=$(dirname "$output_base")
mkdir -p "$output_dir"
tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/diagram-render.XXXXXX")
cleanup() {
  rm -r "$tmp_dir" 2>/dev/null || true
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

png_dimensions=$(LC_ALL=C file "$tmp_dir/render.png" | sed -nE 's/.*PNG image data, ([0-9]+) x ([0-9]+),.*/\1 \2/p')
[[ -n "$png_dimensions" ]] || fail "could not read rendered PNG dimensions"
read -r png_width png_height <<<"$png_dimensions"

crop_count=0
if ((review_images == 1)); then
  review_stage="$tmp_dir/review"
  mkdir "$review_stage"
  rsvg-convert --width "$preview_width" "$tmp_dir/render.svg" -o "$review_stage/preview-${preview_width}.png"

  axis_positions() {
    local length=$1
    local position=0
    local next
    local step=$((crop_size - crop_overlap))
    printf '0'
    while ((position + crop_size < length)); do
      next=$((position + step))
      if ((next + crop_size >= length)); then
        next=$((length - crop_size))
      fi
      ((next > position)) || break
      printf ' %s' "$next"
      position=$next
    done
    printf '\n'
  }

  x_positions=$(axis_positions "$png_width")
  y_positions=$(axis_positions "$png_height")
  crop_columns=$(wc -w <<<"$x_positions" | tr -d ' ')
  crop_rows=$(wc -w <<<"$y_positions" | tr -d ' ')
  ((crop_columns * crop_rows <= 100)) || fail "review would create more than 100 crops; increase --crop-size"

  row=0
  for y in $y_positions; do
    row=$((row + 1))
    column=0
    crop_height=$crop_size
    ((y + crop_height <= png_height)) || crop_height=$((png_height - y))
    for x in $x_positions; do
      column=$((column + 1))
      crop_width=$crop_size
      ((x + crop_width <= png_width)) || crop_width=$((png_width - x))
      crop_count=$((crop_count + 1))
      printf -v crop_name 'crop-r%02d-c%02d-x%s-y%s-%sx%s.png' "$row" "$column" "$x" "$y" "$crop_width" "$crop_height"
      rsvg-convert --zoom "$zoom" --left="-$x" --top="-$y" \
        --page-width "$crop_width" --page-height "$crop_height" \
        "$tmp_dir/render.svg" -o "$review_stage/$crop_name"
    done
  done
fi

install -m 0644 "$tmp_dir/render.svg" "$output_base.svg"
install -m 0644 "$tmp_dir/render.png" "$output_base.png"
if ((review_images == 1)); then
  mkdir -p "$(dirname "$review_dir")"
  mv "$review_stage" "$review_dir"
fi

aspect_ratio=$(awk -v width="$png_width" -v height="$png_height" 'BEGIN { printf "%.2f", width / height }')
printf 'Render: D2 %s; theme=%s; layout=%s; pad=%s; zoom=%s\n' "$(d2 --version)" "$theme" "$layout" "$pad" "$zoom"
printf 'Dimensions: PNG %sx%s; width/height=%s\n' "$png_width" "$png_height" "$aspect_ratio"
printf 'SVG: %s\nPNG: %s\n' "$output_base.svg" "$output_base.png"
if ((review_images == 1)); then
  printf 'Review directory: %s\n' "$review_dir"
  printf 'Preview (%spx): %s/preview-%s.png\n' "$preview_width" "$review_dir" "$preview_width"
  printf 'Native crops: %s file(s), max %sx%s with %spx overlap\n' "$crop_count" "$crop_size" "$crop_size" "$crop_overlap"
fi
