#!/bin/sh
set -eu

experiment_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
output_dir="$experiment_root/dist"
version=$(node -p 'require(process.argv[1]).version' "$experiment_root/extension/manifest.json")
output_file="$output_dir/x-privacy-mask-v$version.zip"

mkdir -p "$output_dir"
(
  cd "$experiment_root/extension"
  zip -qr -FS "$output_file" . -x '*.DS_Store'
)
zip -qj "$output_file" "$experiment_root/README.md" "$experiment_root/LICENSE"
printf '已生成：%s\n' "$output_file"
