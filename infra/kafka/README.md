# Event pipeline (Kafka)

```
 app ──POST /interaction/batch──▶ core API ──Avro──▶ Redpanda ──▶ streams/ (one JVM, profiles)
                                  │  (telemetry: play, skip, search, queue, feedback)      ├─ stats      → song_stats, song_daily_stats, artist_stats
 core API / admin API             │                                                       ├─ activity   → listening_sessions, user_history (+ total_streams)
   write change + outbox row ─────┘  outbox_events ──outbox-relay──▶ Redpanda            ├─ sync       → Recombee batch API, Algolia partial updates
   in one transaction                (favourites, follows, playlist songs,                └─ notification → SMTP / SES / Resend (+ retry topic, DLQ)
                                      sign-up, catalog, OTP emails)
```

- **Contracts:** Avro schemas in `communication/src/main/avro`, generated into Java for the
  core API and `streams/`. Topic names: `Topics.java` and `topics.yaml` (keep them in sync).
  `SchemaCompatibilityTest` enforces BACKWARD compatibility against
  `communication/src/test/resources/schema-snapshots`; after a compatible change run
  `./mvnw -pl communication test -Dschemas.update=true` and commit the snapshots.
- **Duplicates:** every event has an `event_id` (UUID v7). Kafka Streams dedupes for 24 h,
  `user_history` is keyed by it, stats sinks write absolute totals, sync and email keep a
  recent-ids cache. Resending is always safe.
- **No Postgres polling:** the relay sweeps when a writer sends a wake-up record
  (`outbox.wakeup.v1`; Django uses the Redpanda HTTP proxy), at start-up and every 6 h.
  Sinks keep no idle connections. Neon can still sleep.

## Modes (`EVENTS_MODE` on the core and admin APIs)

| Mode | Core API | Admin API | streams/ switches |
|---|---|---|---|
| `LEGACY` (default) | today's behaviour; no Kafka | Redis mail queue | n/a |
| `DUAL` | legacy path does the work, events are also sent; Kafka errors never fail a request | outbox | history + sync **off**; stats, sessions and email run |
| `KAFKA` | events only; telemetry answers 202, or 503 if Kafka can't take it (the app retries) | outbox | `STREAMS_HISTORY_SINK_ENABLED=true`, `STREAMS_SYNC_ENABLED=true` |

OTP emails: in `DUAL`/`KAFKA` they go through the outbox. If a row isn't published within
30 s, the API claims it and pushes it to the Redis mail queue, so login never waits on Kafka.
That fallback needs the Bun mail worker until it is replaced by a direct send.

## Rollout

1. `terraform apply` in `infra/environments/production` (security-group rules for 9092/8081
   within the instances' group, the 30 GB Kafka volume, the `kafka` output).
2. Apply migrations V15–V17 with the migration app (additive only).
3. Processing server: create `Docker/admin/streams.env` from the example, add
   `EVENTS_MODE=LEGACY` and `KAFKA_REST_PROXY_URL=http://redpanda:8082` to `admin.env`,
   then `Docker/admin/deploy.sh` (mounts `/mnt/kafka`, starts Redpanda, creates topics,
   starts `streams`).
4. Core server: add `KAFKA_BOOTSTRAP_SERVERS` and `SCHEMA_REGISTRY_URL` from
   `terraform output kafka` to `core.env`, and set `EVENTS_MODE=DUAL` on the core and admin APIs.
5. Watch for a week: `song_stats.qualified_streams` vs `song_metadata` stream growth, the
   `pipeline.dlq.v1` topic, and consumer lag (`rpk group list` / `rpk group describe`).
6. Cut over in one deploy: `EVENTS_MODE=KAFKA` (core and admin) and
   `STREAMS_HISTORY_SINK_ENABLED=true`, `STREAMS_SYNC_ENABLED=true` (streams).
7. After a week on KAFKA: remove `workers/mailEvents`, `MailQueue`'s Redis path,
   `TelemetryEventListener`, the unused `audioProcessing/jobseeker` workers and the
   `mail_queue` settings (give the OTP fallback a direct SMTP/SES send first).

Rollback at any step: set `EVENTS_MODE=LEGACY` (and the two streams switches to false).

## Local development

```bash
docker compose up -d redpanda redpanda-init        # Kafka localhost:19092, registry :18081
docker compose --profile console up -d console     # UI on http://localhost:8089
./mvnw -pl streams -am spring-boot:run              # with DB_URL etc. and MAIL_PROVIDER=log
```

## Not done yet

- SASL on Kafka. Today access is limited by the security group and the private-IP
  binding. Both apps already read `KAFKA_SECURITY_PROTOCOL`, `KAFKA_SASL_MECHANISM` and
  `KAFKA_SASL_JAAS_CONFIG`.
- Single broker: replication factor 1. On a managed cluster, set `REPLICATION_FACTOR=3`
  for `apply-topics.sh` and `KAFKA_REPLICATION_FACTOR=3` for `streams`.
