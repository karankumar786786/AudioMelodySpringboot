# Migrations & Data Cleanup

This directory contains database schema migrations and data cleanup tools for the **One Melody** ecosystem (PostgreSQL, Algolia, Recombee, AWS S3, ImageKit).

---

## 🚀 Cloud & Storage Data Purge Migration (`index.ts`)

Clears old data across all cloud services (Algolia search records, Recombee recommendations & items, AWS S3 storage buckets, and ImageKit CDN assets).

### 1. Install Dependencies
```bash
bun install
```

### 2. Configure Environment (`.env`)
Ensure your `.env` contains the required credentials (see `.env.example`):
- `DB_URL`
- `ALGOLIA_APP_ID`, `ALGOLIA_API_KEY`, `ALGOLIA_INDEX_NAME`
- `RECOMBEE_DATABASE_ID`, `RECOMBEE_DATABASE_SECRET`, `RECOMBEE_DATABASE_REGION`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
- `S3_TEMP_BUCKET`, `S3_PRODUCTION_BUCKET`
- `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT`

### 3. Usage Commands

```bash
# Dry run — inspect object & file counts across all services without deleting:
bun run clear:dry

# Clear all cloud storage (Algolia, Recombee, S3 Temp + Prod, ImageKit):
bun run clear

# Full reset (Cloud storage + PostgreSQL media/job/history tables, preserving user accounts):
bun run clear:all

# Target individual services:
bun run clear:s3         # Clears S3 buckets only
bun run clear:algolia    # Clears Algolia search index only
bun run clear:recombee   # Resets Recombee DB only
bun run clear:imagekit   # Clears ImageKit CDN files only
bun run clear:db         # Clears PostgreSQL media & history tables only
```

---

## 🗃️ Database Schema Migrations

- `bun run migrate_db.ts`: Video migration schema changes
- `bun run migrate_delete_jobs.ts`: Cascade delete job tracking schema
- `bun run migrate_job_tracking.ts`: Job progress and error tracking tables
- `bun run migrate_search_history.ts`: Search history tracking tables
- `bun run sync_jobs_with_songs.ts`: Data alignment between songs and jobs
