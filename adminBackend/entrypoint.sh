#!/bin/sh
# Container ka entrypoint: pehle AWS Secrets Manager se secrets lao, phir app chalao (exec).
#
# SECRET_IDS: comma ya semicolon se alag secret naam, jaise
#   SECRET_IDS=onemelody/prod/db,onemelody/prod/redis,onemelody/prod/admin
# Har secret env-var keys ka ek JSON object hai. Keys order me export hoti hain, isliye baad wala
# secret pehle wale ko override karta hai, aur secret ki key compose ke environment ko override karti hai.
# Credentials EC2 instance role (IMDSv2) se aate hain; AWS keys ki zaroorat nahi.
# SECRET_IDS khaali ho to ye sirf command chalata hai, bilkul pehle jaisa.
# Values kabhi print nahi hoti: loader shell-quoted exports pipe me likhta hai, jise yahan eval karte hain.
set -eu

if [ -n "${SECRET_IDS:-}" ]; then
  if ! exports="$(python /app/load_secrets.py)"; then
    echo "entrypoint: could not load secrets from AWS Secrets Manager (SECRET_IDS=${SECRET_IDS})" >&2
    exit 1
  fi
  eval "$exports"  # exports ko isi shell me chalao taaki variables app tak pahunchein
  unset exports
fi

# exec: shell ki jagah app hi PID 1 ban jaata hai, taaki docker stop ka signal seedha app ko mile
exec "$@"
