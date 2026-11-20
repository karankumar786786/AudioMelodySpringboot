# Runtime secrets (AWS Secrets Manager)

One Melody's servers no longer get env files with secrets. Each secret is a **JSON object of
env-var keys** in AWS Secrets Manager (`ap-south-1`). Containers read their secrets at start-up
with the EC2 **instance role**, so there are no AWS keys on the servers.

- **Terraform** (`infra/modules/secrets`) creates the secret *containers* and the IAM roles.
  It never holds values, so values never reach Terraform state. You put values in by hand (below).
- **core (Spring)**: `SPRING_PROFILES_ACTIVE=aws` turns on
  `spring.config.import=aws-secretsmanager:${SECRET_IDS}` (`;`-separated). Without the profile,
  local `.env` loading works as before.
- **admin, process, mail**: `entrypoint.sh` reads `SECRET_IDS` (`,` or `;`-separated), exports
  the keys and `exec`s the app. If `SECRET_IDS` is unset it only runs the app, exactly as before.
- **compose** (`Docker/*/docker-compose.yml`) sets only non-secret settings plus `SECRET_IDS`.
  Keep each key in **one** place: in compose *or* in a secret. (For admin, process and mail a
  secret key overrides compose; for core, compose overrides the secret.)
- A secret that cannot be read stops the container instead of starting it with defaults.

## Secret names and who can read them

Names are `onemelody/{prod,staging,dev}/{db,redis,kafka,core,mail,admin,processing,streams}`.
Only `prod` is wired to the servers today; `staging` and `dev` are empty placeholders.

| Server (instance profile) | Containers | May read (`prod`) |
|---|---|---|
| core (`audiomelody-prod-core-server`) | core, mail | db, redis, kafka, core, mail |
| processing (`audiomelody-prod-processing-server`) | admin, process, streams, Redpanda | db, redis, admin, processing, kafka, streams |

| Container | `SECRET_IDS` |
|---|---|
| core | `onemelody/prod/db;onemelody/prod/redis;onemelody/prod/kafka;onemelody/prod/core` |
| mail | `onemelody/prod/redis,onemelody/prod/mail` |
| admin | `onemelody/prod/db,onemelody/prod/redis,onemelody/prod/admin` |
| process | `onemelody/prod/redis,onemelody/prod/processing` |
| streams | not yet: still reads `streams.env` (see Follow-ups) |

## Which keys go in which secret

Key names only, taken from the `Docker/**/*.env.example` files. Everything not listed here is a
non-secret setting and lives in the compose file.

| Secret | Keys | Copied from |
|---|---|---|
| `db` | `DB_URL` (jdbc form), `DB_USER`, `DB_PASSWORD` | `core/core.env` (admin uses the same values) |
| `redis` | `REDIS_HOST`, `REDIS_PASSWORD`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | `core/core.env` (same in every file) |
| `kafka` | `KAFKA_BOOTSTRAP_SERVERS`, `SCHEMA_REGISTRY_URL`, `KAFKA_SECURITY_PROTOCOL`, `KAFKA_SASL_MECHANISM`, `KAFKA_SASL_JAAS_CONFIG` | `core/core.env`; `{}` until Kafka is in use |
| `core` | `APPLICATION_API_KEY`, `JWT_SECRET`, `ADMIN_ID`, `ADMIN_NAME`, `ADMIN_EMAIL`, `ALGOLIA_APP_ID`, `ALGOLIA_API_KEY`, `ALGOLIA_SEARCH_API_KEY`, `RECOMBEE_DATABASE_ID`, `RECOMBEE_DATABASE_SECRET`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM`, `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT`, `AUDIO_PROCESSING_API_KEY` | `core/core.env` |
| `mail` | `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `MAIL_FROM`, `MAIL_PROVIDER`, `QUEUE_BLOCK_TIMEOUT_SECS`, `QUEUE_EMPTY_DELAY_MS`, `QUEUE_POLL_TIMEOUT_SECS`, `RESEND_API_KEY`, `SES_REGION`, `SES_CONFIGURATION_SET` | `core/mail.env` |
| `admin` | `APPLICATION_API_KEY`, `JWT_SECRET`, `ADMIN_ID`, `ADMIN_NAME`, `ADMIN_EMAIL`, `ALGOLIA_APP_ID`, `ALGOLIA_API_KEY`, `RECOMBEE_DATABASE_ID`, `RECOMBEE_DATABASE_SECRET`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM`, `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_URL`, `AUDIO_PROCESSING_API_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` | `admin/admin.env` |
| `processing` | `APPLICATION_API_KEY`, `AUDIO_PROCESSING_API_KEY`, `ACCESS_KEY_ID`, `SECRET_KEY`, `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `ALGOLIA_APP_ID`, `ALGOLIA_API_KEY`, `CONCURRENT_TRANSCODING_LIMIT`, `MAX_CONCURRENT_JOBS` | `admin/process.env` |
| `streams` | `RECOMBEE_DATABASE_ID`, `RECOMBEE_DATABASE_SECRET`, `ALGOLIA_APP_ID`, `ALGOLIA_API_KEY`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `MAIL_FROM`, `RESEND_API_KEY` (plus `db` for the database) | `admin/streams.env`; `{}` until streams switches over |

Core's old `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` are dropped on purpose: core never reads them.

## One-time setup (you run these)

All commands use **your own** AWS CLI credentials, from the repo root.

1. **Create the containers and roles.** Review the plan first. It should show only creates plus
   two in-place changes to `aws_instance.ec2` (attaching the instance profiles), and no replacements.
   ```bash
   cd infra/environments/production
   terraform plan
   terraform apply
   ```
2. **Rotate the leaked keys first** (see below), and put the new values in the env files.
3. **Copy the values in** from your local, git-ignored `Docker/core/*.env` and `Docker/admin/*.env`.
   The helper pipes each secret's JSON into `put-secret-value` on stdin, so values are never
   printed or put on a command line. Check the key names first:
   ```bash
   python3 infra/scripts/put-secrets.py --dry-run
   python3 infra/scripts/put-secrets.py
   ```
   To set one secret by hand instead, write the JSON to a file only you can read, then:
   ```bash
   aws secretsmanager put-secret-value --region ap-south-1 --secret-id onemelody/prod/core --secret-string file://core.json --query VersionId --output text
   ```
   Delete that file afterwards.
4. **Check the roles can read them** (prints names, not values):
   ```bash
   aws secretsmanager list-secrets --region ap-south-1 --filters Key=name,Values=onemelody/prod/ --query 'SecretList[].Name'
   ```
5. **Deploy** as usual (`Docker/deploy.sh all`). Watch `docker compose logs` on each server for
   `entrypoint: could not load secrets` or a Spring `ResourceNotFoundException`.
6. **Remove the old env files from the servers** once everything is healthy. Deploy warns while they remain:
   ```bash
   ssh -i infra/environments/production/audiomelody-ec2-key.pem ubuntu@<ip> 'rm ~/app/core.env ~/app/mail.env ~/app/watchtower.env'
   ```
   On the processing server remove `admin.env`, `process.env` and `watchtower.env`, but keep
   `streams.env` and `.env` (Redpanda addresses, no secrets).

## Rotate these

The Inngest event key and signing key used to be hardcoded defaults in
`adminBackend/admin/admin/settings.py`. They are in git history, so treat them as public:
create new ones in the Inngest dashboard, then put them in both `onemelody/prod/admin` and
`onemelody/prod/processing`. Admin now refuses to start without them (unless `INNGEST_DEV=1`).

## Changing a value later

Update the secret (`put-secret-value` or the console), then restart the container
(`docker compose up -d --force-recreate <service>`). Secrets are read only at start-up.

## Follow-ups

- **streams**: make the Spring `streams/` service import `onemelody/prod/db;onemelody/prod/kafka;onemelody/prod/streams`
  the way core does. Then move its non-secret settings into compose and stop copying `streams.env`.
- The app still uses static AWS keys for S3 (admin `AWS_*`, process `ACCESS_KEY_ID`/`SECRET_KEY`).
  If you grant the instance roles S3 access, those keys can be deleted and rotated away.
- `MAIL_PROVIDER=ses` would use the core server's instance role, which has no SES permission yet.
