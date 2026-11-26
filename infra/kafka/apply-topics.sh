#!/usr/bin/env bash
# topics.yaml ke missing topics banao aur configs match karo. Kabhi delete nahi karta.
# Kaise chalayein: apply-topics.sh [topics.yaml]   (env: RPK_BROKERS, REPLICATION_FACTOR)
set -euo pipefail

FILE="${1:-$(dirname "$0")/topics.yaml}"
RF="${REPLICATION_FACTOR:-1}"
BROKERS="${RPK_BROKERS:-localhost:9092}"

# Broker ke ready hone ka wait (init container uske saath hi start hota hai).
for i in $(seq 1 60); do
  if rpk topic list -X brokers="$BROKERS" >/dev/null 2>&1; then break; fi
  sleep 2
  if [ "$i" = 60 ]; then echo "Redpanda at $BROKERS not healthy" >&2; exit 1; fi
done

existing="$(rpk topic list -X brokers="$BROKERS" | awk 'NR>1 {print $1}')"

apply() {
  local name="$1" partitions="$2" config="$3"
  [ -z "$name" ] && return 0
  if grep -qx "$name" <<<"$existing"; then
    rpk topic alter-config "$name" --set "$config" -X brokers="$BROKERS" >/dev/null
    echo "ok      $name"
  else
    rpk topic create "$name" -p "$partitions" -r "$RF" -c "$config" -X brokers="$BROKERS" >/dev/null
    echo "created $name"
  fi
}

name="" partitions="3" config=""
while IFS= read -r line; do
  line="${line%%#*}"
  case "$line" in
    *"- name:"*)
      apply "$name" "$partitions" "$config"
      name="$(echo "${line#*name:}" | xargs)"; partitions="3"; config="" ;;
    *"partitions:"*) partitions="$(echo "${line#*partitions:}" | xargs)" ;;
    *"config:"*) config="$(echo "${line#*config:}" | xargs)" ;;
  esac
done <"$FILE"
apply "$name" "$partitions" "$config"
