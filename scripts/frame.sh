#!/bin/sh
set -eu

usage() {
  echo "usage: pnpm frame [status | screen on|off | brightness 1-100 | volume 0-100" >&2
  echo "                  | screensaver on|off | night|dark on|off|HH:MM HH:MM | show calendar|music|weather|garden | reload | restart | screenshot]" >&2
  exit 2
}

switch() {
  case "${2:-}" in
    on) body="{\"type\":\"set\",\"settings\":{\"$1\":true}}" ;;
    off) body="{\"type\":\"set\",\"settings\":{\"$1\":false}}" ;;
    *) usage ;;
  esac
}

schedule() {
  case "$2" in
    on | off) switch "$1" "$2" ;;
    [0-2][0-9]:[0-5][0-9])
      case "$3" in
        [0-2][0-9]:[0-5][0-9]) ;;
        *) usage ;;
      esac
      body="{\"type\":\"set\",\"settings\":{\"$1\":true,\"$1Start\":\"$2\",\"$1End\":\"$3\"}}" ;;
    *) usage ;;
  esac
}

percent() {
  setting=$1 min=$2 value=${3:-}
  case "$value" in
    '' | *[!0-9]*) usage ;;
  esac
  [ "$value" -ge "$min" ] && [ "$value" -le 100 ] || usage
  if [ "$value" -eq 100 ]; then level=1; else level=$(printf '0.%02d' "$value"); fi
  body="{\"type\":\"set\",\"settings\":{\"$setting\":$level}}"
}

mtls="$HOME/.config/photo-frame/mtls"
url="${FRAME_URL:-https://photoframe.lochingpo.com}/api/control"

case "${1:-status}" in
  status) body= ;;
  screen) switch screenOn "${2:-}" ;;
  screensaver) switch screensaver "${2:-}" ;;
  night | dark) schedule "$1" "${2:-}" "${3:-}" ;;
  brightness) percent brightness 1 "${2:-}" ;;
  volume) percent volume 0 "${2:-}" ;;
  restart) body='{"type":"restart"}' ;;
  screenshot)
    out="$(dirname "$0")/../screenshots/frame-$(date +%Y%m%d-%H%M%S).jpg"
    mkdir -p "$(dirname "$out")"
    if ! curl -sS --fail-with-body --cert "$mtls/frame.crt" --key "$mtls/frame.key" \
      -o "$out" "$url/screenshot"; then
      cat "$out" >&2
      rm -f "$out"
      exit 1
    fi
    echo "$out"
    exit ;;
  show)
    case "${2:-}" in
      calendar | music | weather | garden) body="{\"type\":\"show\",\"screen\":\"$2\"}" ;;
      *) usage ;;
    esac ;;
  reload) body='{"type":"reload"}' ;;
  *) usage ;;
esac

if [ -z "$body" ]; then
  curl -sS --fail-with-body --cert "$mtls/frame.crt" --key "$mtls/frame.key" "$url"
else
  curl -sS --fail-with-body --cert "$mtls/frame.crt" --key "$mtls/frame.key" \
    -H 'Content-Type: application/json' -d "$body" "$url"
fi
echo
