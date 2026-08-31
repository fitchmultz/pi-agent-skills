#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: render_svg.sh [options] INPUT.svg [OUTPUT.png]

Validate an editable SVG source, render its PNG, fully decode every raster, and
create temporary review images. OUTPUT defaults to INPUT with a .png suffix.

Options:
  --zoom FACTOR         PNG zoom factor (default: 2)
  --preview-width PX    Review preview width (default: 980)
  --crop-size PX        Maximum native crop width/height (default: 1900)
  --crop-overlap PX     Native crop overlap (default: 200)
  --review-dir DIR      Review output directory (default: a new temp directory)
  --no-review-images    Do not create a preview or native crops
  -h, --help            Show this help

The input SVG remains the canonical editable source. The review directory must
not already exist or contain the source or final PNG. Remove it after inspection.
EOF
}

fail() {
  printf 'render_svg.sh: %s\n' "$*" >&2
  exit 1
}

positive_integer() {
  [[ "$1" =~ ^[1-9][0-9]*$ ]]
}

nonnegative_integer() {
  [[ "$1" == 0 || "$1" =~ ^[1-9][0-9]*$ ]]
}

positive_number() {
  [[ "$1" =~ ^([0-9]+([.][0-9]*)?|[.][0-9]+)$ ]] \
    && awk -v value="$1" 'BEGIN { exit !(value > 0) }'
}

lexical_absolute_path() {
  local candidate=$1
  local component
  local count
  local result=""
  local -a components=()
  local -a stack=()
  [[ "$candidate" == /* ]] || candidate="$PWD/$candidate"
  IFS='/' read -r -a components <<<"$candidate"
  for component in "${components[@]}"; do
    case "$component" in
      ''|.) ;;
      ..)
        count=${#stack[@]}
        ((count == 0)) || unset "stack[$((count - 1))]"
        ;;
      *) stack[${#stack[@]}]=$component ;;
    esac
  done
  for component in "${stack[@]}"; do result="$result/$component"; done
  printf '%s\n' "${result:-/}"
}

zoom=2
preview_width=980
crop_size=1900
crop_overlap=200
review_dir=""
review_images=1

while (($#)); do
  case "$1" in
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
    -*) fail "unknown option: $1" ;;
    *) break ;;
  esac
done

(($# >= 1 && $# <= 2)) || {
  usage >&2
  exit 2
}

positive_number "$zoom" || fail "--zoom must be a positive number"
positive_integer "$preview_width" || fail "--preview-width must be a positive integer"
positive_integer "$crop_size" || fail "--crop-size must be a positive integer"
nonnegative_integer "$crop_overlap" || fail "--crop-overlap must be a non-negative integer"
((crop_overlap < crop_size)) || fail "--crop-overlap must be smaller than --crop-size"
((review_images == 1)) || [[ -z "$review_dir" ]] || fail "--review-dir cannot be combined with --no-review-images"

input=$1
output=${2:-${input%.svg}.png}
[[ -f "$input" && ! -L "$input" ]] || fail "input must be a regular SVG file: $input"
[[ "$input" == *.svg ]] || fail "input must have a .svg suffix: $input"
[[ "$output" == *.png ]] || fail "output must have a .png suffix: $output"
command -v rsvg-convert >/dev/null 2>&1 || fail "rsvg-convert is required; on macOS run: brew install librsvg"
command -v node >/dev/null 2>&1 || fail "node is required"

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
png_verifier="$script_dir/verify_png.mjs"
[[ -f "$png_verifier" ]] || fail "PNG verifier is missing: $png_verifier"

input_abs=$(lexical_absolute_path "$input")
output_abs=$(lexical_absolute_path "$output")
[[ "$input_abs" != "$output_abs" ]] || fail "output must not overwrite the SVG source"
output_dir=$(dirname "$output")
mkdir -p "$output_dir" || fail "cannot create output directory: $output_dir"
if [[ -L "$output" ]] || [[ -e "$output" && ! -f "$output" ]]; then
  fail "output target must be a regular file or absent: $output"
fi

grep -Eq '<svg([[:space:]>])' "$input" || fail "input does not contain an SVG root element"
external_refs=$(grep -Eo "(xlink:href|href)[[:space:]]*=[[:space:]]*[\"'][^\"']+[\"']" "$input" \
  | grep -Ev "=[[:space:]]*[\"'](#|data:)" || true)
[[ -z "$external_refs" ]] || fail "SVG contains an external resource or link; embed assets as data URIs"
grep -Eiq '<foreignObject([[:space:]>])' "$input" \
  && fail "foreignObject content is not portable through librsvg; use SVG text elements"
grep -Eiq '<script([[:space:]>])|javascript:|[[:space:]]on[a-z]+[[:space:]]*=' "$input" \
  && fail "active SVG content is not allowed"
grep -Eiq '@import' "$input" && fail "SVG contains an external CSS resource"
external_css_refs=$(grep -Eo "url\\([[:space:]]*[\"']?[^)]*" "$input" \
  | grep -Ev "url\\([[:space:]]*[\"']?(#|data:)" || true)
[[ -z "$external_css_refs" ]] || fail "SVG contains an external CSS resource"

review_reserved=0
keep_review=0
tmp_dir=""
publish_tmp=""

cleanup() {
  [[ -z "$tmp_dir" ]] || rm -r "$tmp_dir" 2>/dev/null || true
  [[ -z "$publish_tmp" ]] || rm -f "$publish_tmp" 2>/dev/null || true
  if ((review_reserved == 1 && keep_review == 0)); then
    [[ -z "$review_dir" ]] || rm -r "$review_dir" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if ((review_images == 1)); then
  if [[ -z "$review_dir" ]]; then
    review_dir=$(mktemp -d "${TMPDIR:-/tmp}/diagram-review.XXXXXX") \
      || fail "cannot reserve a temporary review directory"
  else
    review_dir=$(lexical_absolute_path "$review_dir")
    [[ ! -e "$review_dir" && ! -L "$review_dir" ]] || fail "review directory already exists: $review_dir"
    mkdir -m 0700 "$review_dir" || fail "cannot create review directory: $review_dir"
  fi
  review_reserved=1
  review_abs=$(lexical_absolute_path "$review_dir")
  if [[ "$input_abs" == "$review_abs"/* || "$output_abs" == "$review_abs"/* ]]; then
    fail "review directory must not contain the SVG source or final PNG"
  fi
fi

tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/diagram-svg-render.XXXXXX") \
  || fail "cannot reserve a render directory"
rsvg-convert --zoom "$zoom" "$input" -o "$tmp_dir/render.png"
png_verification=$(node "$png_verifier" "$tmp_dir/render.png") \
  || fail "rendered PNG failed full decode verification"
read -r png_width png_height _ <<<"$png_verification"

crop_count=0
if ((review_images == 1)); then
  review_stage="$tmp_dir/review"
  mkdir "$review_stage"
  rsvg-convert --width "$preview_width" "$input" -o "$review_stage/preview-${preview_width}.png"

  axis_positions() {
    local length=$1
    local position=0
    local next
    local step=$((crop_size - crop_overlap))
    printf '0'
    while ((position + crop_size < length)); do
      next=$((position + step))
      if ((next + crop_size >= length)); then next=$((length - crop_size)); fi
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
      printf -v crop_name 'crop-r%02d-c%02d-x%s-y%s-%sx%s.png' \
        "$row" "$column" "$x" "$y" "$crop_width" "$crop_height"
      rsvg-convert --zoom "$zoom" --left="-$x" --top="-$y" \
        --page-width "$crop_width" --page-height "$crop_height" \
        "$input" -o "$review_stage/$crop_name"
    done
  done
  node "$png_verifier" "$review_stage"/*.png >/dev/null \
    || fail "one or more review images failed full decode verification"
fi

publish_tmp=$(mktemp "$output_dir/.diagram-svg-publish.XXXXXX") \
  || fail "cannot reserve an output staging file"
install -m 0644 "$tmp_dir/render.png" "$publish_tmp"
if ((review_images == 1)); then
  for review_file in "$review_stage"/*; do
    install -m 0644 "$review_file" "$review_dir/$(basename "$review_file")"
  done
fi
if [[ -L "$output" ]] || [[ -e "$output" && ! -f "$output" ]]; then
  fail "output target changed during rendering and is no longer a regular file or absent: $output"
fi
node -e 'require("node:fs").renameSync(process.argv[1], process.argv[2])' "$publish_tmp" "$output"
publish_tmp=""
keep_review=$review_images

aspect_ratio=$(awk -v width="$png_width" -v height="$png_height" 'BEGIN { printf "%.2f", width / height }')
printf 'Render: SVG-native; librsvg; zoom=%s\n' "$zoom"
printf 'Dimensions: PNG %sx%s; width/height=%s\n' "$png_width" "$png_height" "$aspect_ratio"
printf 'SVG source: %s\nPNG: %s\n' "$input" "$output"
if ((review_images == 1)); then
  printf 'Review directory: %s\n' "$review_dir"
  printf 'Preview (%spx): %s/preview-%s.png\n' "$preview_width" "$review_dir" "$preview_width"
  printf 'Native crops: %s file(s), max %sx%s with %spx overlap\n' \
    "$crop_count" "$crop_size" "$crop_size" "$crop_overlap"
fi
