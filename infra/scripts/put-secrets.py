#!/usr/bin/env python3
"""Copy One Melody's runtime secrets from the old env files into AWS Secrets Manager.

One-time migration helper for infra/SECRETS.md. Values are read from the env files and
piped to `aws secretsmanager put-secret-value` on stdin: they are never printed,
logged or passed on a command line.

    python3 infra/scripts/put-secrets.py --dry-run          # key names per secret, nothing sent
    python3 infra/scripts/put-secrets.py                    # write every onemelody/prod/* secret
    python3 infra/scripts/put-secrets.py --only core,mail   # write just these

The env files default to Docker/core/{core,mail}.env and Docker/admin/{admin,process}.env.
Uses your own AWS CLI credentials (an admin user), not the servers' instance roles.
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]

# secret name -> (env file it is read from, keys). Keep in sync with infra/SECRETS.md.
# Non-secret settings (ports, queue names, bucket names, OTel, cookies, CORS for core)
# are set in Docker/*/docker-compose.yml instead and are deliberately not listed here.
SECRETS: dict[str, tuple[str, list[str]]] = {
    "db": ("core/core.env", ["DB_URL", "DB_USER", "DB_PASSWORD"]),
    "redis": ("core/core.env", ["REDIS_HOST", "REDIS_PASSWORD", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]),
    "core": ("core/core.env", [
        "APPLICATION_API_KEY", "JWT_SECRET",
        "ADMIN_ID", "ADMIN_NAME", "ADMIN_EMAIL",
        "ALGOLIA_APP_ID", "ALGOLIA_API_KEY", "ALGOLIA_SEARCH_API_KEY",
        "RECOMBEE_DATABASE_ID", "RECOMBEE_DATABASE_SECRET",
        "SMTP_USER", "SMTP_PASS", "SMTP_FROM",
        "MAIL_USERNAME", "MAIL_PASSWORD", "MAIL_FROM",
        "IMAGEKIT_PUBLIC_KEY", "IMAGEKIT_PRIVATE_KEY", "IMAGEKIT_URL_ENDPOINT",
        "AUDIO_PROCESSING_API_KEY",
    ]),
    "mail": ("core/mail.env", [
        "SMTP_USER", "SMTP_PASS", "SMTP_FROM", "MAIL_FROM", "MAIL_PROVIDER",
        "QUEUE_BLOCK_TIMEOUT_SECS", "QUEUE_EMPTY_DELAY_MS", "QUEUE_POLL_TIMEOUT_SECS",
        "RESEND_API_KEY", "SES_REGION", "SES_CONFIGURATION_SET",
    ]),
    "admin": ("admin/admin.env", [
        "APPLICATION_API_KEY", "JWT_SECRET",
        "ADMIN_ID", "ADMIN_NAME", "ADMIN_EMAIL",
        "ALGOLIA_APP_ID", "ALGOLIA_API_KEY",
        "RECOMBEE_DATABASE_ID", "RECOMBEE_DATABASE_SECRET",
        "SMTP_USER", "SMTP_PASS", "SMTP_FROM",
        "MAIL_USERNAME", "MAIL_PASSWORD", "MAIL_FROM",
        "IMAGEKIT_PUBLIC_KEY", "IMAGEKIT_PRIVATE_KEY", "IMAGEKIT_URL_ENDPOINT",
        "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "CLOUDINARY_URL",
        "AUDIO_PROCESSING_API_KEY",
        "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY",
        "INNGEST_EVENT_KEY", "INNGEST_SIGNING_KEY",
        "DJANGO_SECRET_KEY", "DJANGO_ALLOWED_HOSTS", "CORS_ALLOWED_ORIGINS",
    ]),
    "processing": ("admin/process.env", [
        "APPLICATION_API_KEY", "AUDIO_PROCESSING_API_KEY",
        "ACCESS_KEY_ID", "SECRET_KEY",
        "IMAGEKIT_PUBLIC_KEY", "IMAGEKIT_PRIVATE_KEY", "IMAGEKIT_URL_ENDPOINT",
        "INNGEST_EVENT_KEY", "INNGEST_SIGNING_KEY",
        "ALGOLIA_APP_ID", "ALGOLIA_API_KEY",
        "CONCURRENT_TRANSCODING_LIMIT", "MAX_CONCURRENT_JOBS",
    ]),
    # Kafka client settings for core (Redpanda on the processing server's private IP;
    # `terraform output kafka`) and the stream services. Written as {} while unset, so
    # core's required import of this secret still succeeds.
    "kafka": ("core/core.env", [
        "KAFKA_BOOTSTRAP_SERVERS", "SCHEMA_REGISTRY_URL",
        "KAFKA_SECURITY_PROTOCOL", "KAFKA_SASL_MECHANISM", "KAFKA_SASL_JAAS_CONFIG",
    ]),
    # streams/ still reads streams.env today; this prepares its secret for the switch.
    "streams": ("admin/streams.env", [
        "RECOMBEE_DATABASE_ID", "RECOMBEE_DATABASE_SECRET",
        "ALGOLIA_APP_ID", "ALGOLIA_API_KEY",
        "SMTP_USER", "SMTP_PASS", "SMTP_FROM", "MAIL_FROM", "RESEND_API_KEY",
    ]),
}

# Secrets whose env file may not exist yet; they are written as {} instead of failing.
MAY_BE_EMPTY = {"kafka", "streams"}

LINE_RE = re.compile(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$")


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text().splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        m = LINE_RE.match(raw)
        if not m:
            continue
        value = m.group(2).strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[m.group(1)] = value
    return values


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--env", default="prod", help="secret environment (prod, staging, dev)")
    parser.add_argument("--docker-dir", default=str(REPO / "Docker"), help="folder holding core/ and admin/ env files")
    parser.add_argument("--only", default="", help="comma-separated secret names to write")
    parser.add_argument("--region", default="ap-south-1")
    parser.add_argument("--dry-run", action="store_true", help="list key names per secret; send nothing")
    args = parser.parse_args()

    wanted = [s for s in args.only.split(",") if s] or list(SECRETS)
    unknown = set(wanted) - set(SECRETS)
    if unknown:
        print(f"unknown secret(s): {', '.join(sorted(unknown))}", file=sys.stderr)
        return 2

    docker = Path(args.docker_dir)
    failed = False
    for name in wanted:
        env_file, keys = SECRETS[name]
        path = docker / env_file
        if path.is_file():
            env = read_env(path)
        elif name in MAY_BE_EMPTY:
            env = {}
        else:
            print(f"{name}: {path} not found", file=sys.stderr)
            failed = True
            continue
        payload = {k: env[k] for k in keys if env.get(k, "") != ""}
        missing = [k for k in keys if k not in payload]
        secret_id = f"onemelody/{args.env}/{name}"
        print(f"{secret_id}: {len(payload)} keys: {', '.join(payload)}")
        if missing:
            print(f"  not set in {env_file} (skipped): {', '.join(missing)}")
        if args.dry_run:
            continue
        result = subprocess.run(
            ["aws", "secretsmanager", "put-secret-value", "--region", args.region,
             "--secret-id", secret_id, "--secret-string", "file:///dev/stdin",
             "--query", "VersionId", "--output", "text"],
            input=json.dumps(payload), text=True, capture_output=True,
        )
        if result.returncode != 0:
            # The AWS CLI error names the secret and the reason, never the value.
            print(f"  FAILED: {result.stderr.strip()}", file=sys.stderr)
            failed = True
        else:
            print(f"  written (version {result.stdout.strip()})")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
