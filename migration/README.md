# 🚀 Melody Database Migration Service (Flyway)

This standalone Spring Boot service is the **centralized source of truth** for all relational database migrations across the One Melody ecosystem, serving:
- **`coreEngine`** (Java / Spring Boot 3 streaming & recommendation API)
- **`admin`** (Python / Django Admin control plane & moderation)
- **`workers`** & **`audioProcessing`** (Media transcoding & event processors)

---

## 📁 Migration Structure

Flyway SQL scripts reside in:
```
migration/src/main/resources/db/migration/
```

Naming convention:
`V<Version>__<Description>.sql` (e.g., `V1__initial_schema.sql`, `V2__add_new_feature.sql`).

### Current Migrations:
- **`V1__initial_schema.sql`**:
  - `users` (Consumer accounts)
  - `admin_users` (Administrative & moderator accounts)
  - `artists` (Artist profiles & discography)
  - `jobs` (Ingestion & transcoding tracking)
  - `songs` (Audio tracks & metadata)
  - `playlists` (Curated playlists)
  - `playlist_songs` (Playlist-Song join table)
  - `user_playlists` (User personal playlists)
  - `user_playlist_songs` (User playlist tracks)
  - `user_saved_playlists` (Saved / bookmarked playlists)
  - `user_favourite_songs` (User liked songs)
  - `user_history` (Playback history)
  - `user_search_history` (Search history)
  - `delete_jobs` (Multi-cloud cascade teardown jobs)
  - `pagination_metadata` (Fast entity counters & pagination metadata)

---

## 🛠️ How to Run Migrations

### 1. Run via Spring Boot CLI (Recommended)
Automatically connects using `.env` or system environment variables, runs all pending migrations, and prints a structured migration audit report:

```bash
cd migration
./mvnw spring-boot:run
```

### 2. Run via Flyway Maven Plugin
Executes migrations directly without starting the Spring application context:

```bash
cd migration
./mvnw flyway:migrate
```

### 3. Check Migration Status & History
View applied, pending, and current schema version:

```bash
cd migration
./mvnw flyway:info
```

### 4. Validate or Repair Migrations
Check checksums or repair baseline after manual interventions:

```bash
cd migration
./mvnw flyway:validate
./mvnw flyway:repair
```

---

## ⚙️ Environment Variables

The migration service automatically loads from `../coreEngine/.env` or `.env`. You can also supply them explicitly:

| Variable | Default | Description |
|---|---|---|
| `DB_URL` | `jdbc:postgresql://localhost:5432/melody` | JDBC connection string |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | `postgres` | Database password |

Example with custom credentials:
```bash
DB_URL="jdbc:postgresql://postgres.example.com:5432/melody" \
DB_USER="melody_admin" \
DB_PASSWORD="secret_password" \
./mvnw spring-boot:run
```
