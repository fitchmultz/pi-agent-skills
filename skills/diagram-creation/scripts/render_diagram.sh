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

The review directory must not already exist or overlap either final artifact path.
Remove it after visual inspection. Interrupted publication reports retained recovery dirs.
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
  [[ "$1" == 0 || "$1" =~ ^[1-9][0-9]*$ ]]
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
  for component in "${stack[@]}"; do
    result="$result/$component"
  done
  printf '%s\n' "${result:-/}"
}

prospective_directory_path() {
  local candidate
  local suffix=""
  local parent
  candidate=$(lexical_absolute_path "$1")
  while [[ ! -e "$candidate" && ! -L "$candidate" ]]; do
    [[ "$candidate" != / ]] || break
    suffix="/$(basename "$candidate")$suffix"
    parent=$(dirname "$candidate")
    [[ "$parent" != "$candidate" ]] || break
    candidate=$parent
  done
  [[ -d "$candidate" ]] || return 1
  candidate=$(cd "$candidate" && pwd -P)
  lexical_absolute_path "$candidate$suffix"
}

first_missing_directory() {
  local candidate
  local first_missing=""
  local parent
  candidate=$(lexical_absolute_path "$1")
  while [[ ! -e "$candidate" && ! -L "$candidate" ]]; do
    first_missing=$candidate
    parent=$(dirname "$candidate")
    [[ "$parent" != "$candidate" ]] || break
    candidate=$parent
  done
  [[ -n "$first_missing" && -d "$candidate" ]] || return 1
  printf '%s\n' "$first_missing"
}

review_conflicts_with_final() {
  local review=$1
  local final=$2
  [[ "$review" == "$final" || "$review" == "$final/"* || "$final" == "$review/"* ]]
}

directory_contains_native() {
  local parent
  local current
  local next
  parent=$(cd "$1" && pwd -P) || return 1
  current=$(cd "$2" && pwd -P) || return 1
  while :; do
    [[ "$current" -ef "$parent" ]] && return 0
    next=$(dirname "$current")
    [[ "$next" != "$current" ]] || return 1
    current=$next
  done
}

review_ancestor_aliases_final() {
  local current
  local final=$2
  local next
  [[ -e "$final" || -L "$final" ]] || return 1
  current=$(cd "$1" && pwd -P) || return 1
  while :; do
    [[ "$current" -ef "$final" ]] && return 0
    next=$(dirname "$current")
    [[ "$next" != "$current" ]] || return 1
    current=$next
  done
}

mask_allocation_signals() {
  trap '' HUP INT TERM
}

restore_allocation_signals() {
  trap - HUP INT TERM
}

reserve_temp_directory() {
  local target_variable=$1
  local template=$2
  local allocated
  local status
  mask_allocation_signals
  if allocated=$(mktemp -d "$template"); then
    printf -v "$target_variable" '%s' "$allocated"
    restore_allocation_signals
    return 0
  else
    status=$?
  fi
  restore_allocation_signals
  return "$status"
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
command -v d2 >/dev/null 2>&1 || fail "d2 is required; on macOS run: brew install d2"
command -v rsvg-convert >/dev/null 2>&1 || fail "rsvg-convert is required; on macOS run: brew install librsvg"
command -v node >/dev/null 2>&1 || fail "node is required"

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
png_verifier="$script_dir/verify_png.mjs"
[[ -f "$png_verifier" ]] || fail "PNG verifier is missing: $png_verifier"

svg_output="$output_base.svg"
png_output="$output_base.png"
output_dir=$(dirname "$output_base")
mkdir -p "$output_dir" || fail "cannot create output directory: $output_dir"
output_dir_abs=$(cd "$output_dir" && pwd -P)
svg_output_abs="$output_dir_abs/$(basename "$svg_output")"
png_output_abs="$output_dir_abs/$(basename "$png_output")"

for output in "$svg_output" "$png_output"; do
  if [[ -L "$output" ]] || [[ -e "$output" && ! -f "$output" ]]; then
    fail "output target must be a regular file or absent: $output"
  fi
  if [[ -e "$output" && "$input" -ef "$output" ]]; then
    fail "refusing to overwrite the input through output path: $output"
  fi
done

review_reserved=0
review_cleanup_root=""
keep_review=0
tmp_dir=""
publish_dir=""
backup_dir=""
transaction_active=0
had_svg=0
had_png=0
recovery_reported=0

path_exists() {
  [[ -e "$1" || -L "$1" ]]
}

atomic_rename() {
  node -e 'require("node:fs").renameSync(process.argv[1], process.argv[2])' "$1" "$2"
}

atomic_link() {
  node -e 'require("node:fs").linkSync(process.argv[1], process.argv[2])' "$1" "$2"
}

recover_outputs() {
  set +e
  if ((had_svg == 1)) && [[ -f "$backup_dir/render.svg" && ! -L "$backup_dir/render.svg" ]]; then
    atomic_link "$backup_dir/render.svg" "$svg_output" >/dev/null 2>&1 || true
  fi
  if ((had_png == 1)) && [[ -f "$backup_dir/render.png" && ! -L "$backup_dir/render.png" ]]; then
    atomic_link "$backup_dir/render.png" "$png_output" >/dev/null 2>&1 || true
  fi
  if ((recovery_reported == 0)); then
    printf 'render_diagram.sh: publication interrupted; recovery retained at: %s and %s\n' "$backup_dir" "$publish_dir" >&2
    recovery_reported=1
  fi
  set -e
}

publication_failed() {
  local reason=$1
  recover_outputs
  fail "$reason; recovery files were retained"
}

cleanup() {
  if ((transaction_active == 1)); then
    recover_outputs
  fi
  [[ -z "$tmp_dir" ]] || rm -r "$tmp_dir" 2>/dev/null || true
  if ((transaction_active == 0)); then
    [[ -z "$publish_dir" ]] || rm -r "$publish_dir" 2>/dev/null || true
    [[ -z "$backup_dir" ]] || rm -r "$backup_dir" 2>/dev/null || true
  fi
  if ((review_reserved == 1 && keep_review == 0)); then
    review_cleanup_target=${review_cleanup_root:-$review_dir}
    [[ -z "$review_cleanup_target" ]] || rm -r "$review_cleanup_target" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if ((review_images == 1)); then
  if [[ -z "$review_dir" ]]; then
    review_reserved=1
    reserve_temp_directory review_dir "${TMPDIR:-/tmp}/diagram-review.XXXXXX" || fail "cannot reserve a temporary review directory"
    review_cleanup_root=$review_dir
  else
    review_dir=$(lexical_absolute_path "$review_dir")
    review_dir_future=$(prospective_directory_path "$review_dir") || fail "review directory parent is not a directory: $review_dir"
    if review_conflicts_with_final "$review_dir_future" "$svg_output_abs" || review_conflicts_with_final "$review_dir_future" "$png_output_abs"; then
      fail "review directory must not equal, contain, or sit beneath a final output path: $review_dir"
    fi
    [[ ! -e "$review_dir" && ! -L "$review_dir" ]] || fail "review directory already exists: $review_dir"
    review_cleanup_root=$(first_missing_directory "$review_dir") || fail "cannot identify the review directory allocation root: $review_dir"
    allocation_status=0
    mask_allocation_signals
    if mkdir -m 0700 "$review_cleanup_root"; then
      review_reserved=1
      if [[ "$review_cleanup_root" != "$review_dir" ]]; then
        if mkdir -p "$(dirname "$review_dir")"; then
          mkdir "$review_dir" || allocation_status=$?
        else
          allocation_status=$?
        fi
      fi
    else
      allocation_status=$?
    fi
    restore_allocation_signals
    ((allocation_status == 0)) || fail "cannot create review directory: $review_dir (status $allocation_status)"
  fi
  if directory_contains_native "$review_dir" "$output_dir" \
    || review_ancestor_aliases_final "$review_dir" "$svg_output" \
    || review_ancestor_aliases_final "$review_dir" "$png_output"; then
    fail "review directory overlaps a final output path on this filesystem: $review_dir"
  fi
fi

reserve_temp_directory tmp_dir "${TMPDIR:-/tmp}/diagram-render.XXXXXX" || fail "cannot reserve a render directory"

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

png_verification=$(node "$png_verifier" "$tmp_dir/render.png") || fail "rendered PNG failed full decode verification"
read -r png_width png_height _ <<<"$png_verification"

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

  node "$png_verifier" "$review_stage"/*.png >/dev/null \
    || fail "one or more review images failed full decode verification"
fi

reserve_temp_directory publish_dir "$output_dir/.diagram-publish.XXXXXX" || fail "cannot reserve an output staging directory"
install -m 0644 "$tmp_dir/render.svg" "$publish_dir/render.svg"
install -m 0644 "$tmp_dir/render.png" "$publish_dir/render.png"

if ((review_images == 1)); then
  for review_file in "$review_stage"/*; do
    install -m 0644 "$review_file" "$review_dir/$(basename "$review_file")"
  done
fi

for output in "$svg_output" "$png_output"; do
  if [[ -L "$output" ]] || [[ -e "$output" && ! -f "$output" ]]; then
    fail "output target changed during rendering and is no longer a regular file or absent: $output"
  fi
done
reserve_temp_directory backup_dir "$output_dir/.diagram-backup.XXXXXX" || fail "cannot reserve an output backup directory"
for output in "$svg_output" "$png_output"; do
  if [[ -L "$output" ]] || [[ -e "$output" && ! -f "$output" ]]; then
    fail "output target changed during backup allocation and is no longer a regular file or absent: $output"
  fi
done
path_exists "$svg_output" && had_svg=1
path_exists "$png_output" && had_png=1
transaction_active=1
if ((had_svg == 1)); then
  atomic_rename "$svg_output" "$backup_dir/render.svg" || publication_failed "could not preserve existing SVG"
  [[ -f "$backup_dir/render.svg" && ! -L "$backup_dir/render.svg" ]] || publication_failed "SVG target changed type during publication"
fi
if ((had_png == 1)); then
  atomic_rename "$png_output" "$backup_dir/render.png" || publication_failed "could not preserve existing PNG"
  [[ -f "$backup_dir/render.png" && ! -L "$backup_dir/render.png" ]] || publication_failed "PNG target changed type during publication"
fi
atomic_link "$publish_dir/render.svg" "$svg_output" || publication_failed "could not publish SVG"
atomic_link "$publish_dir/render.png" "$png_output" || publication_failed "could not publish PNG"
transaction_active=0
keep_review=1

aspect_ratio=$(awk -v width="$png_width" -v height="$png_height" 'BEGIN { printf "%.2f", width / height }')
printf 'Render: D2 %s; theme=%s; layout=%s; pad=%s; zoom=%s\n' "$(d2 --version)" "$theme" "$layout" "$pad" "$zoom"
printf 'Dimensions: PNG %sx%s; width/height=%s\n' "$png_width" "$png_height" "$aspect_ratio"
printf 'SVG: %s\nPNG: %s\n' "$output_base.svg" "$output_base.png"
if ((review_images == 1)); then
  printf 'Review directory: %s\n' "$review_dir"
  printf 'Preview (%spx): %s/preview-%s.png\n' "$preview_width" "$review_dir" "$preview_width"
  printf 'Native crops: %s file(s), max %sx%s with %spx overlap\n' "$crop_count" "$crop_size" "$crop_size" "$crop_overlap"
fi
