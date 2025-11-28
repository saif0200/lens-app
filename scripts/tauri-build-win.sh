#!/usr/bin/env bash
set -euo pipefail

# Normalize Tauri signing key for Windows builds. Supports either:
# - TAURI_SIGNING_PRIVATE_KEY: key content (raw or base64)
# - TAURI_SIGNING_PRIVATE_KEY_FILE: path to a file with the key (raw or base64)
# Defaults to /tmp/signing-key.txt when present to ease local usage.

key_input=""

key_file="${TAURI_SIGNING_PRIVATE_KEY_FILE:-}"
if [[ -z "${key_file}" ]]; then
  default_key_file="/tmp/signing-key.txt"
  if [[ -f "${default_key_file}" ]]; then
    key_file="${default_key_file}"
  fi
fi

if [[ -n "${key_file}" ]]; then
  if [[ ! -f "${key_file}" ]]; then
    echo "Signing key file not found: ${key_file}" >&2
    exit 1
  fi
  key_input="$(<"${key_file}")"
elif [[ -n "${TAURI_SIGNING_PRIVATE_KEY:-}" ]]; then
  key_input="${TAURI_SIGNING_PRIVATE_KEY}"
else
  echo "No signing key provided; set TAURI_SIGNING_PRIVATE_KEY or TAURI_SIGNING_PRIVATE_KEY_FILE." >&2
  exit 1
fi

# If the key isn't in the expected format, try to base64-decode it.
if [[ "${key_input}" != untrusted\ comment:* ]]; then
  maybe_decoded="$(printf '%s' "${key_input}" | base64 -d 2>/dev/null || true)"
  if [[ "${maybe_decoded}" == untrusted\ comment:* ]]; then
    key_input="${maybe_decoded}"
  fi
fi

tmp_key_path="$(mktemp)"
chmod 600 "${tmp_key_path}"
printf '%s' "${key_input}" > "${tmp_key_path}"

export TAURI_SIGNING_PRIVATE_KEY="${tmp_key_path}"

exec tauri build "$@"
