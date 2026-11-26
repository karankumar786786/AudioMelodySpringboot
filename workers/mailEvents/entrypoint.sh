#!/bin/sh
# Container ka entrypoint: pehle AWS Secrets Manager se secrets load karo, phir app chalao.
#
# SECRET_IDS: comma ya semicolon se alag secret naam, jaise
#   SECRET_IDS=onemelody/prod/db,onemelody/prod/redis,onemelody/prod/admin
# Har secret env-var keys ka JSON object hai. Keys order me export hoti hain, to baad wala secret
# pehle wale ko override karta hai, aur koi bhi secret key compose ke environment ko.
# Credentials EC2 instance role (IMDSv2) se aate hain; AWS keys ki zaroorat nahi.
# SECRET_IDS khaali ho to bas command chalata hai, pehle jaisa.
# Values kabhi print nahi hoti: loader quoted exports pipe me likhta hai, jinhe eval karte hain.
set -eu

if [ -n "${SECRET_IDS:-}" ]; then
  if ! exports="$(bun /app/dist/load-secrets.js)"; then
    echo "entrypoint: could not load secrets from AWS Secrets Manager (SECRET_IDS=${SECRET_IDS})" >&2
    exit 1
  fi
  eval "$exports"
  unset exports
fi

exec "$@"
