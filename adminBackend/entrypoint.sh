#!/bin/sh
# Container entrypoint: load runtime secrets from AWS Secrets Manager, then exec the app.
#
# SECRET_IDS: comma- or semicolon-separated secret names, e.g.
#   SECRET_IDS=onemelody/prod/db,onemelody/prod/redis,onemelody/prod/admin
# Each secret is a JSON object of env-var keys. Keys are exported in order, so a later
# secret overrides an earlier one, and any secret key overrides the compose environment.
# Credentials come from the EC2 instance role (IMDSv2); no AWS keys are needed.
# When SECRET_IDS is unset or empty this only runs the command, exactly as before.
# Values are never printed: the loader writes shell-quoted exports to a pipe for eval.
set -eu

if [ -n "${SECRET_IDS:-}" ]; then
  if ! exports="$(python /app/load_secrets.py)"; then
    echo "entrypoint: could not load secrets from AWS Secrets Manager (SECRET_IDS=${SECRET_IDS})" >&2
    exit 1
  fi
  eval "$exports"
  unset exports
fi

exec "$@"
