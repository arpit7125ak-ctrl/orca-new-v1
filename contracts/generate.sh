#!/usr/bin/env bash
# contracts/generate.sh
#
# Generates one Pydantic model per contracts/**/*.json into ai-service/schemas/,
# mirroring the contracts/ folder structure exactly (see
# ORCA_Backend_AIService_Complete_Structure.md for the target file list).
#
# This is the fix for open item #5: until this script exists and runs in CI,
# contracts/*.json (Ajv, backend) and ai-service/schemas/*.py (Pydantic, AI
# service) are two independently-maintained type systems for the same wire
# data — exactly the kind of drift that caused the Day 1 restart, just on the
# backend<->AI-service boundary instead of frontend<->backend.
#
# Requires: pip install datamodel-code-generator --break-system-packages
#
# Usage:
#   bash contracts/generate.sh
#   bash contracts/generate.sh --check   # CI mode: fail if generated output differs from what's committed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$SCRIPT_DIR"
SCHEMAS_DIR="$SCRIPT_DIR/../ai-service/schemas"
CHECK_MODE=false

if [[ "${1:-}" == "--check" ]]; then
  CHECK_MODE=true
  TMP_DIR="$(mktemp -d)"
  echo "CI check mode: generating into $TMP_DIR, will diff against $SCHEMAS_DIR"
fi

if ! command -v datamodel-codegen &> /dev/null; then
  echo "ERROR: datamodel-codegen not found. Run: pip install datamodel-code-generator --break-system-packages" >&2
  exit 1
fi

# PascalCase -> snake_case, e.g. AnalysisRequest -> analysis_request
to_snake_case() {
  echo "$1" | sed -E 's/([a-z0-9])([A-Z])/\1_\2/g; s/([A-Z]+)([A-Z][a-z])/\1_\2/g' | tr '[:upper:]' '[:lower:]'
}

generate_one() {
  local input_file="$1"
  local output_file="$2"

  mkdir -p "$(dirname "$output_file")"

  echo "  $input_file -> $output_file"
  datamodel-codegen \
    --input "$input_file" \
    --input-file-type jsonschema \
    --output "$output_file" \
    --output-model-type pydantic_v2.BaseModel \
    --use-schema-description \
    --use-field-description \
    --enum-field-as-literal all \
    --disable-timestamp
}

count=0

echo "Generating root-level contracts..."
for f in "$CONTRACTS_DIR"/*.json; do
  [[ -e "$f" ]] || continue
  base="$(basename "$f" .json)"
  out="$SCHEMAS_DIR/$(to_snake_case "$base").py"
  [[ "$CHECK_MODE" == true ]] && out="$TMP_DIR/$(to_snake_case "$base").py"
  generate_one "$f" "$out"
  ((count++))
done

for subdir in shared api db; do
  echo "Generating contracts/$subdir/..."
  for f in "$CONTRACTS_DIR/$subdir"/*.json; do
    [[ -e "$f" ]] || continue
    base="$(basename "$f" .json)"
    out="$SCHEMAS_DIR/$subdir/$(to_snake_case "$base").py"
    [[ "$CHECK_MODE" == true ]] && out="$TMP_DIR/$subdir/$(to_snake_case "$base").py"
    generate_one "$f" "$out"
    ((count++))
  done
done

echo ""
echo "Generated $count Pydantic models."

if [[ "$CHECK_MODE" == true ]]; then
  if diff -r "$TMP_DIR" "$SCHEMAS_DIR" > /dev/null 2>&1; then
    echo "OK: ai-service/schemas/ matches contracts/ — no drift."
    rm -rf "$TMP_DIR"
    exit 0
  else
    echo "FAIL: ai-service/schemas/ is out of sync with contracts/. Run 'bash contracts/generate.sh' and commit the result." >&2
    diff -rq "$TMP_DIR" "$SCHEMAS_DIR" || true
    rm -rf "$TMP_DIR"
    exit 1
  fi
fi
