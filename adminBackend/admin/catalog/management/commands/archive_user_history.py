"""
Moves old listening history out of Postgres into the S3 data lake.

    python manage.py archive_user_history                 # dry run: counts only
    python manage.py archive_user_history --execute       # copy, verify, then delete
    python manage.py archive_user_history --backfill --execute   # copy everything, delete nothing

Rows older than --days (default 180) are written with DuckDB straight from Postgres to
  <LAKE_URI>/user_history/dt=YYYY-MM-DD/archive-<uuid>.parquet
and are deleted from Postgres only after the lake holds at least as many rows for that
cutoff as were counted before the copy. total_streams lives in song_metadata, so stream
counts are unaffected.

Note: core's recommendation queries (top songs per user, mood radio) read user_history
without a time limit, so archiving changes what they see. Keep --days generous.
"""

import os
import uuid
from datetime import datetime, timedelta, timezone

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection

from core.services import lake_service

DELETE_BATCH = 5000


class Command(BaseCommand):
    help = "Archive user_history rows older than N days to the S3 data lake (Parquet), then delete them"

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=180, help="Keep this many days in Postgres (default 180)")
        parser.add_argument("--execute", action="store_true", help="Actually copy and delete (default: dry run)")
        parser.add_argument(
            "--backfill", action="store_true", help="Copy ALL history to the lake and delete nothing (one-time)"
        )

    def handle(self, *args, days: int, execute: bool, backfill: bool, **kwargs):
        if days < 30 and not backfill:
            raise CommandError("--days must be at least 30")
        uri = lake_service.lake_uri()
        if not uri:
            raise CommandError("LAKE_URI (or LAKE_BUCKET) is not set")

        cutoff = None if backfill else datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)
        with connection.cursor() as cur:
            if cutoff is None:
                cur.execute("SELECT COUNT(*) FROM user_history")
            else:
                cur.execute("SELECT COUNT(*) FROM user_history WHERE listened_at < %s", [cutoff])
            count = int(cur.fetchone()[0])

        scope = "all rows" if cutoff is None else f"rows before {cutoff:%Y-%m-%d %H:%M} UTC"
        self.stdout.write(f"user_history: {count} {scope}")
        if not execute:
            self.stdout.write("Dry run: nothing copied or deleted (pass --execute).")
            return
        if count == 0:
            self.stdout.write("Nothing to archive.")
            return

        run_id = uuid.uuid4().hex
        copied = self._copy(uri, cutoff, run_id)
        if copied < count:
            raise CommandError(f"Copied {copied} rows but expected {count}; nothing deleted")
        self.stdout.write(self.style.SUCCESS(f"Copied {copied} rows to {uri}/user_history (run {run_id})"))

        if cutoff is None:
            self.stdout.write("Backfill: rows kept in Postgres.")
            return
        deleted = self._delete(cutoff)
        self.stdout.write(self.style.SUCCESS(f"Deleted {deleted} archived rows from Postgres"))

    # DuckDB reads Postgres directly (postgres extension) and writes partitioned Parquet.
    def _copy(self, uri: str, cutoff, run_id: str) -> int:
        conn = lake_service._connect()
        db = settings.DATABASES["default"]
        sslmode = (db.get("OPTIONS") or {}).get("sslmode")
        if sslmode:
            os.environ.setdefault("PGSSLMODE", sslmode)
        conn.execute("INSTALL postgres; LOAD postgres;")
        conn.execute(
            "CREATE OR REPLACE SECRET melody_pg (TYPE postgres, HOST ?, PORT ?, DATABASE ?, USER ?, PASSWORD ?)",
            [
                db.get("HOST") or "localhost",
                int(db.get("PORT") or 5432),
                db.get("NAME") or "melody",
                db.get("USER") or "postgres",
                db.get("PASSWORD") or "",
            ],
        )
        conn.execute("ATTACH IF NOT EXISTS '' AS melody_pg (TYPE postgres, SECRET melody_pg, READ_ONLY)")
        where = ""
        params = []
        if cutoff is not None:
            where = "WHERE listened_at < ?"
            params.append(cutoff)
        target = f"{uri}/user_history".replace("'", "''")
        conn.execute(
            f"""COPY (
                  SELECT id, user_id, song_id, part, listened_at,
                         strftime(listened_at, '%Y-%m-%d') AS dt
                    FROM melody_pg.public.user_history {where}
                ) TO '{target}'
                (FORMAT parquet, COMPRESSION zstd, PARTITION_BY (dt),
                 FILENAME_PATTERN 'archive-{run_id}-{{i}}', OVERWRITE_OR_IGNORE)""",
            params,
        )
        # Verify by reading back what this run wrote.
        row = conn.execute(
            f"SELECT COUNT(*) FROM read_parquet('{target}/*/archive-{run_id}-*.parquet', hive_partitioning = true)"
        ).fetchone()
        return int(row[0]) if row else 0

    def _delete(self, cutoff) -> int:
        total = 0
        while True:
            with connection.cursor() as cur:
                cur.execute(
                    "DELETE FROM user_history WHERE id IN ("
                    "SELECT id FROM user_history WHERE listened_at < %s LIMIT %s)",
                    [cutoff, DELETE_BATCH],
                )
                n = cur.rowcount
            total += n
            if n < DELETE_BATCH:
                return total
