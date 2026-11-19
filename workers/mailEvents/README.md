# mail

Bun worker that consumes OTP mail jobs (`{ to, subject, otp }`) from a Redis list and sends them.

```bash
bun install
bun run index.ts   # dev
bun test           # unit tests; set MAIL_TEST_REDIS_URL=redis://127.0.0.1:6390 to also run the Redis store test
```

## Providers

Chosen with `MAIL_PROVIDER` (see `.env.example`):

| value | transport | required env |
|---|---|---|
| `smtp` (default) | nodemailer, Gmail SMTP | `SMTP_USER`, `SMTP_PASS` (+ `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`) |
| `ses` | AWS SDK v3 SESv2 `SendEmail` | `AWS_REGION` (or `SES_REGION`), AWS credentials, `MAIL_FROM` |
| `resend` | Resend HTTP API | `RESEND_API_KEY`, `MAIL_FROM` |

## Queues

- `MAIL_QUEUE` (default `mail_queue`): ready jobs, pushed by coreEngine and adminBackend.
- `<MAIL_QUEUE>_delayed`: sorted set of retries scored by their `notBefore` time; due entries are moved back to the ready list each loop, so a failing message never blocks the others.
- `<MAIL_QUEUE>_dlq`: jobs that hit 3 failed attempts or a provider auth error. Entries keep `to`, `subject`, `retries`, `error`, `reason`, `failedAt` and never the OTP.
