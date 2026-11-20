/**
 * Print shell `export` lines for the JSON secrets named in SECRET_IDS.
 *
 * Built to dist/load-secrets.js and run only by entrypoint.sh, which evals the output.
 * Values go to stdout (a pipe), never to logs; errors name the secret and key, never a value.
 * Keep in sync with workers/mailEvents/load-secrets.ts and adminBackend/load_secrets.py.
 */
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function secretIds(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

export function toExports(secretId: string, payload: string): string[] {
  let data: unknown;
  try {
    data = JSON.parse(payload);
  } catch {
    throw new Error(`${secretId}: secret is not valid JSON`);
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error(`${secretId}: secret must be a JSON object of KEY: value pairs`);
  }
  return Object.entries(data as Record<string, unknown>).map(([key, value]) => {
    if (!KEY_RE.test(key)) {
      throw new Error(`${secretId}: key ${JSON.stringify(key)} is not a valid environment variable name`);
    }
    if (!["string", "number", "boolean"].includes(typeof value)) {
      throw new Error(`${secretId}: key ${key} must be a string, number or boolean`);
    }
    return `export ${key}=${shellQuote(String(value))}`;
  });
}

async function main(): Promise<number> {
  const ids = secretIds(process.env.SECRET_IDS);
  if (ids.length === 0) return 0;
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-south-1";
  const client = new SecretsManagerClient({ region });
  const lines: string[] = [];
  for (const secretId of ids) {
    let payload: string | undefined;
    try {
      const response = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
      payload = response.SecretString;
    } catch (err) {
      const name = (err as { name?: string })?.name ?? "Error";
      console.error(`load-secrets: cannot read ${secretId}: ${name}`);
      return 1;
    }
    if (payload === undefined) {
      console.error(`load-secrets: ${secretId} has no SecretString (binary secrets are not supported)`);
      return 1;
    }
    try {
      lines.push(...toExports(secretId, payload));
    } catch (err) {
      console.error(`load-secrets: ${(err as Error).message}`);
      return 1;
    }
  }
  if (lines.length) process.stdout.write(lines.join("\n") + "\n");
  return 0;
}

if (import.meta.main) {
  process.exit(await main());
}
