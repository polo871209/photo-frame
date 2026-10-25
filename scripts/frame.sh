#!/bin/sh
set -eu

usage() {
  echo "usage: pnpm frame [status | screen on|off | show calendar|music|weather | reload]" >&2
  exit 2
}

case "${1:-status}" in
  status) body= ;;
  screen)
    case "${2:-}" in
      on) body='{"type":"screen","on":true}' ;;
      off) body='{"type":"screen","on":false}' ;;
      *) usage ;;
    esac ;;
  show)
    case "${2:-}" in
      calendar | music | weather) body="{\"type\":\"show\",\"screen\":\"$2\"}" ;;
      *) usage ;;
    esac ;;
  reload) body='{"type":"reload"}' ;;
  *) usage ;;
esac

mtls="$HOME/.config/photo-frame/mtls"
url="${FRAME_URL:-https://photoframe.lochingpo.com}/api/control"
if [ -z "$body" ]; then
  curl -sS --fail-with-body --cert "$mtls/frame.crt" --key "$mtls/frame.key" "$url"
else
  curl -sS --fail-with-body --cert "$mtls/frame.crt" --key "$mtls/frame.key" \
    -H 'Content-Type: application/json' -d "$body" "$url"
fi
echo
