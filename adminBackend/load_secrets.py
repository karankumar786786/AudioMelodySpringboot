"""Print shell `export` lines for the JSON secrets named in SECRET_IDS.

Used only by entrypoint.sh, which evals the output. Values go to stdout (a pipe),
never to logs; errors name the secret and key, never a value.
Keep in sync with audioProcessing/load-secrets.ts and workers/mailEvents/load-secrets.ts.
"""

import json
import os
import re
import sys

KEY_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def secret_ids(raw: str) -> list[str]:
    return [part.strip() for part in re.split(r"[,;]", raw) if part.strip()]


def shell_quote(value: str) -> str:
    return "'" + value.replace("'", "'\"'\"'") + "'"


def to_exports(secret_id: str, payload: str) -> list[str]:
    try:
        data = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise ValueError(f"{secret_id}: secret is not valid JSON") from exc
    if not isinstance(data, dict):
        raise ValueError(f"{secret_id}: secret must be a JSON object of KEY: value pairs")
    lines = []
    for key, value in data.items():
        if not KEY_RE.match(key):
            raise ValueError(f"{secret_id}: key {key!r} is not a valid environment variable name")
        if isinstance(value, (dict, list)) or value is None:
            raise ValueError(f"{secret_id}: key {key} must be a string, number or boolean")
        if isinstance(value, bool):
            value = "true" if value else "false"
        lines.append(f"export {key}={shell_quote(str(value))}")
    return lines


def main() -> int:
    ids = secret_ids(os.environ.get("SECRET_IDS", ""))
    if not ids:
        return 0
    import boto3  # imported late so the helpers above work without it

    region = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or "ap-south-1"
    client = boto3.client("secretsmanager", region_name=region)
    lines: list[str] = []
    for secret_id in ids:
        try:
            response = client.get_secret_value(SecretId=secret_id)
        except Exception as exc:  # noqa: BLE001 - report the AWS error code only
            code = getattr(exc, "response", {}).get("Error", {}).get("Code", type(exc).__name__)
            print(f"load_secrets: cannot read {secret_id}: {code}", file=sys.stderr)
            return 1
        payload = response.get("SecretString")
        if payload is None:
            print(f"load_secrets: {secret_id} has no SecretString (binary secrets are not supported)", file=sys.stderr)
            return 1
        try:
            lines.extend(to_exports(secret_id, payload))
        except ValueError as exc:
            print(f"load_secrets: {exc}", file=sys.stderr)
            return 1
    sys.stdout.write("\n".join(lines) + ("\n" if lines else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
