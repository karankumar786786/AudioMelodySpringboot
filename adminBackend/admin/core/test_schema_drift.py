"""
Django's models here are unmanaged: Flyway (migration/) owns the schema, and Django only
maps onto it. Nothing else checks that the mapping still matches, so a migration that
renames or drops a column the admin API uses would only fail at runtime, on the first
query that touches it. (The core API has the same protection built in, through
Hibernate's `ddl-auto: validate`.)

This test compares every unmanaged model with a real Postgres that Flyway has migrated:
each model's table, and each of its columns (including many-to-many link tables), must
exist. It runs when SCHEMA_CHECK_DB_URL points at that database (CI applies every
migration first) and is skipped otherwise, since the normal test run uses SQLite.

    SCHEMA_CHECK_DB_URL=postgresql://postgres:postgres@localhost:5432/melody \
        uv run python manage.py test core.test_schema_drift
"""

import os
import unittest

from django.apps import apps
from django.test import SimpleTestCase

SCHEMA_DB_URL = os.getenv("SCHEMA_CHECK_DB_URL")


def expected_columns():
    """{table: {column: "app.Model.field"}} for every unmanaged model and its link tables."""
    tables = {}
    for model in apps.get_models(include_auto_created=True):
        meta = model._meta
        if meta.managed or meta.proxy:
            continue
        cols = tables.setdefault(meta.db_table, {})
        for field in meta.local_concrete_fields:
            cols[field.column] = f"{meta.label}.{field.name}"
        for m2m in meta.local_many_to_many:
            through = m2m.remote_field.through._meta
            if through.auto_created:
                link = tables.setdefault(through.db_table, {})
                for f in through.local_concrete_fields:
                    link[f.column] = f"{meta.label}.{m2m.name} (link table)"
    return tables


def actual_columns(db_url):
    import psycopg2

    with psycopg2.connect(db_url) as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT table_name, column_name FROM information_schema.columns "
            "WHERE table_schema = current_schema()"
        )
        out = {}
        for table, column in cur.fetchall():
            out.setdefault(table, set()).add(column)
        return out


def drift(expected, actual):
    problems = []
    for table, cols in sorted(expected.items()):
        if table not in actual:
            owners = sorted({o.split(".")[0] + "." + o.split(".")[1] for o in cols.values()})
            problems.append(f"table {table!r} does not exist (used by {', '.join(owners)})")
            continue
        for column, owner in sorted(cols.items()):
            if column not in actual[table]:
                problems.append(f"column {table}.{column} does not exist (used by {owner})")
    return problems


class DriftDetectionTests(SimpleTestCase):
    """The comparison itself, without a database."""

    def test_reports_missing_tables_and_columns(self):
        expected = {"songs": {"id": "catalog.Song.id", "title": "catalog.Song.title"}, "gone": {"id": "x.Gone.id"}}
        actual = {"songs": {"id"}}
        self.assertEqual(
            drift(expected, actual),
            [
                "table 'gone' does not exist (used by x.Gone)",
                "column songs.title does not exist (used by catalog.Song.title)",
            ],
        )

    def test_every_app_model_is_unmanaged_and_checked(self):
        tables = expected_columns()
        self.assertIn("songs", tables)
        self.assertIn("jobs", tables)


@unittest.skipUnless(SCHEMA_DB_URL, "set SCHEMA_CHECK_DB_URL to a Flyway-migrated Postgres")
class UnmanagedModelsMatchFlywaySchemaTests(SimpleTestCase):
    def test_models_match_the_migrated_schema(self):
        problems = drift(expected_columns(), actual_columns(SCHEMA_DB_URL))
        self.assertFalse(
            problems,
            "Django models no longer match the Flyway schema. Update the model, or the "
            "migration, so they agree:\n  - " + "\n  - ".join(problems),
        )
