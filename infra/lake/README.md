# Data lake

Raw listening and engagement events, kept forever as Parquet in S3 and queried with
DuckDB (or Athena later). Postgres keeps only what the app serves; the admin dashboard
reads small pre-computed tables for instant pages and the lake for everything else.

```
Kafka topics ──Redpanda Connect (lake-writer)──▶ s3://<lake-bucket>/lake/events/topic=<topic>/dt=YYYY-MM-DD/*.parquet
user_history (> 90 days) ──archive job──────────▶ s3://<lake-bucket>/lake/user_history/dt=YYYY-MM-DD/*.parquet
```

- **Writer:** `connect.yaml`. It runs as the `lake-writer` container on the processing server.
  - It decodes the Avro events, writes one row per event, and creates one file per topic and day on each flush (every 15 min or 50k events).
  - Offsets commit after the upload, so delivery is at least once; queries drop duplicates by `event_id`.
  - Events that can't be encoded go to `pipeline.dlq.v1`.
- **Columns:**
  - always present: `event_id`, `topic`, `occurred_at` (epoch ms), `received_at`, `source`, `dt`, `user_id`, `song_id`, `payload` (the whole event as JSON);
  - set when they apply: `entity_type`, `entity_id`, `action`, `listened_ratio`, `duration_ms`, `exit_ms`, `skipped`, `quality`, `platform`, `startup_ms`, `rebuffer_count`, `rebuffer_ms`, `listened_ms`, `flag`.
- **Bucket:** `infra/modules/lake` (private, SSE, Glacier Instant Retrieval after 365 days). Only the processing server's role can read or write it.
- **Query it:**
  ```sql
  INSTALL httpfs; LOAD httpfs;
  CREATE SECRET (TYPE s3, PROVIDER credential_chain);
  SELECT dt, count(DISTINCT event_id) AS plays
    FROM read_parquet('s3://onemelody-lake-production/lake/events/topic=listening.play.v1/*/*.parquet', hive_partitioning = true)
   WHERE dt >= current_date - 30
   GROUP BY dt ORDER BY dt;
  ```
- **Local:** `docker compose --profile lake up -d s3 lake-writer` (with Redpanda running) starts an S3 mock on `localhost:9090` with the `onemelody-lake-dev` bucket.
