# Production alerting (Uptrace)

Alert rules for the two production EC2 servers, kept as code in [`alerts.yml`](alerts.yml)
(Uptrace YAML monitor format).

```
core server        core-engine (Spring Boot + OTel Java agent)  ─┐
                   mail-worker (Bun)                              ├─► otel-collector ─► Uptrace (otlp/uptrace)
processing server  admin-backend (Django)                         │   (Docker/<server>/otel-collector-config.yaml)
                   audio-processing (Bun + Inngest + FFmpeg)     ─┘
```

Every signal also carries `server_role` (`core` / `processing`) and
`deployment_environment=production`, added by the `resource/server` processor
in each collector config. Use them in notification-channel routing conditions.

> **Notification channel: not chosen yet.** Until you connect one, alerts only
> appear in the Uptrace UI. See [Connecting a channel](#connecting-a-channel).

## Signals these alerts use

| Metric (Uptrace name) | Type | Attributes | Emitted by |
|---|---|---|---|
| `uptrace_tracing_spans` | span-derived histogram | `service_name`, `_type`, `_status_code` | Uptrace, from all traces |
| `http_server_request_duration` (s) | histogram | `http_route`, `http_response_status_code` | OTel Java agent in coreEngine |
| `audio_processing_runs` | counter | `function`, `outcome` = success\|failure | `audioProcessing/lib/jobMetrics.ts` |
| `audio_processing_steps` | counter | `function`, `step`, `outcome` = success\|retry\|failure | `audioProcessing/lib/jobMetrics.ts` |
| `audio_processing_heartbeats_received` | counter | `status` | `adminBackend/admin/core/services/system_health_service.py` |
| `mail_sent` | counter | – | `workers/mailEvents/telemetry.ts` |
| `mail_send_failures` | counter | `disposition` = retry\|dlq | `workers/mailEvents/telemetry.ts` |
| `mail_dlq_pushed` | counter | `reason` = auth\|max_retries | `workers/mailEvents/telemetry.ts` |
| `mail_queue_length` | gauge | `queue` = mail_queue\|mail_queue_dlq | `workers/mailEvents/telemetry.ts` |

`failure` on the audio counters means Inngest exhausted its retries (`retries: 3`
on `transcode-song`); a single failed attempt is `retry`.

## The alerts

### HTTP 5xx rate > 2% (5m)
**Means:** for 5 straight minutes more than 2% of HTTP requests to `core-engine` or
`admin-backend` returned 5xx (fires per service).
**Likely cause:** a bad deploy (Watchtower pulls `:latest` on every push to `main`),
the database or Redis is unreachable, or a third party (Algolia, Recombee, S3) is failing.
**Check first:** Uptrace → Traces, filter `service_name` = the alerting service and
`_status_code = error`, group by `_name` to see which route breaks, then open one
trace for the exception. If it started right after a deploy, see what Watchtower
pulled (`docker logs watchtower` on that server).
**Note:** with very low traffic, one error out of a handful of requests can trip
it. If that gets noisy, raise `max_value` or add a minimum-volume condition.

### Core home/recommendations p95 > 1.5s (10m)
**Means:** the 95th-percentile latency of `/api/home/stream` or
`/api/recommendations/*` (user, similar/{songId}, radio, radio/session) stayed
above 1.5s for 10 minutes (fires per route).
**Likely cause:** slow Recombee API, Postgres under load or missing indexes, a cold
or evicted Redis cache, or the core EC2 instance running out of CPU.
**Check first:** open a slow trace for that route and look at which child span
(HTTP to Recombee, SQL, Redis) takes the time.
**Note:** `/api/home/stream` is SSE. Its server span lasts until the whole home
feed has been sent, so it measures time-to-full-feed, not time-to-first-byte. If
it is always slow by design, give it its own monitor with a higher threshold.

### Audio processing job failed
**Means:** an Inngest function (`function` attribute, e.g. `transcode-song`,
`transcode-audio-task`, `finalize-song`) failed after all retries. The song is stuck
or was marked failed in coreEngine.
**Likely cause:** a corrupt or unsupported upload (FFmpeg error), an S3 or ImageKit
error, or the coreEngine/admin webhook being unreachable or rejecting the API key.
**Check first:** Inngest dashboard → Runs → filter Failed for that function. The error
and the failing step are on the run. In Uptrace, `audio_processing_steps{outcome="failure"}`
grouped by `step` shows which step failed. Then check `docker logs process` on the
processing server.

### Audio processing step retries > 10/min
**Means:** a step keeps failing and retrying. It is not a failure yet, but it often
becomes one.
**Likely cause:** a flaky dependency (S3 throttling, coreEngine down during a deploy).
**Check first:** the `step` attribute, then that dependency's status.

### No audio-processing heartbeat (3m)
**Means:** admin-backend received no `POST /api/telemetry/heartbeat` for 3 minutes.
audio-processing sends one every 10s.
**Likely cause:** the `process` container is down or crash-looping, admin-backend
is down, or the heartbeat is being rejected (`X-API-KEY` not matching
`APPLICATION_API_KEY`, which shows as 401s on that route).
**Check first:** on the processing server, `docker ps` (is `process` up, is it
restarting?), then `docker logs process | grep TELEMETRY`. If `admin-backend sent
no spans` fires at the same time, the problem is admin, not the worker.

### Mail moved to DLQ
**Means:** at least one email (usually an OTP) went to `mail_queue_dlq` and was
never delivered. `reason=auth` means SMTP rejected the login, so every email
is failing and the worker pauses 30s after each one. `reason=max_retries`
means one email failed 3 times.
**Likely cause:** an expired or revoked Gmail app password (`SMTP_PASS`), a Google
rate limit ("Too many login attempts"), or a bad recipient address.
**Check first:** `docker logs mail | grep -E "AUTH FAILURE|MAX RETRIES"` on the core
server. Replay DLQ items only after fixing the cause.

### Mail send failures > 5/min (5m)
**Means:** sends keep failing (retries plus DLQ moves) for 5 minutes.
**Likely cause:** same as above, or the SMTP host or network is unreachable.
**Check first:** the mail container logs and the `disposition` breakdown.

### Mail queue backlog > 50 (10m)
**Means:** more than 50 jobs have sat in `mail_queue` for 10 minutes. Users are not
getting OTPs in time.
**Likely cause:** the worker is stuck in the auth-failure pause loop, or there is a
sign-up burst. Gmail's rate limit is about 1 mail/s with the current transporter.
**Check first:** whether `Mail moved to DLQ` is firing too, then the mail logs.

### core-engine / admin-backend sent no spans (5m)
**Means:** Uptrace got no spans from that service for 5 minutes. Both always have
background traffic (Docker health checks, heartbeats), so silence means the
service is down, crash-looping, or cannot reach the collector.
**Check first:** `docker ps -a` on that server (STATUS shows `Restarting` or a recent
`Up` time), `docker logs <core|admin> --tail 200`, and `docker logs otel-collector`.

### Mail worker silent (5m)
**Means:** `mail_queue_length` (exported every 15s) stopped arriving, so the mail
worker is not running or cannot reach the collector.
**Check first:** `docker ps -a | grep mail` and `docker logs mail`.

## Container restarts

The collector does not collect actual container restart counts. That needs the Docker
socket mounted into the collector container and a `docker_stats` receiver, which is
a `docker-compose.yml` change (not made here):

1. In `Docker/<server>/docker-compose.yml`, under `otel-collector`, add the volume
   `/var/run/docker.sock:/var/run/docker.sock:ro` and run the container with a
   group that can read the socket.
2. In the collector config, add a receiver
   `docker_stats: {endpoint: unix:///var/run/docker.sock, collection_interval: 30s, metrics: {container.restarts: {enabled: true}}}`
   and put it in the metrics pipeline.
3. Monitor: `increase($restarts)` on `container_restarts` grouped by `container_name`, `max_value: 0`.

Until then, the "sent no spans" and "silent" monitors catch crashed and
crash-looping services, and the heartbeat monitor covers audio-processing.

## Importing into Uptrace

1. Uptrace → **Alerting → Monitors → New monitor → From YAML**.
2. Paste one entry from `alerts.yml` at a time (each item under `monitors:`),
   save, and repeat for all 11. If your Uptrace version accepts a full list, paste
   the whole file.
3. Wait about 15 minutes after the services that emit the new metrics have been
   deployed. Then open each monitor and check that its chart shows data. A
   monitor whose metric does not exist yet shows "no data".
4. If the editor rejects a field (`min_breach_points`, `min_value`, `default`),
   set the same thing in the monitor form instead: the threshold, "check the
   last N points", and treat missing values as 0.

## Connecting a channel

1. Uptrace → **Alerting → Notification channels → New** → Slack (webhook URL) or
   Email (self-hosted Uptrace only; Uptrace Cloud emails project members).
2. Optional routing condition: `attr("deployment_environment") == "production"`,
   or split by `attr("server_role")`.
3. Attach the channel to every monitor above (each monitor's
   **Notify** section).
4. Remove the `notification_channel: TODO_CHOOSE_EMAIL_OR_SLACK` placeholder
   comment in `alerts.yml` and write down which channel you chose.
