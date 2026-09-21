# Pending Jobs / Migration Tasks

This file tracks things that are **fully coded but not yet applied** due to resource constraints (free DB tier limits, etc.).

---

## 🗃️ Database Migrations

These SQL statements must be run **before deploying** the code changes that depend on them.

### 1. Add `genre` column to `songs` table

**Needed by**: `SongsEntity.java`, `WebhookJobService.finalizeJob`, Recombee saveSong  
**Status**: Code is ready — column not yet added to DB

```sql
ALTER TABLE songs ADD COLUMN IF NOT EXISTS genre VARCHAR(100);
```

### 2. Add `genre` column to `jobs` table

**Needed by**: `JobsEntity.java`, `SongService.createSong`, `WebhookJobService.saveRecommendation`  
**Status**: Code is ready — column not yet added to DB

```sql
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS genre VARCHAR(100);
```

---

## 🔑 Recombee Schema

The following property registrations are handled automatically at app startup via `@PostConstruct` in `Recombee.java` — **no manual action needed**:

| Property | Type | Auto-registered? |
|---|---|---|
| `title` | string | ✅ Yes |
| `artistName` | string | ✅ Yes |
| `language` | string | ✅ Yes |
| `genre` | string | ✅ Yes |
| `duration` | int | ✅ Yes (NEW) |

Recombee silently ignores re-registering properties that already exist.

---

## 📋 Summary Table

| Task | File | Status | Blocking? |
|---|---|---|---|
| `ALTER TABLE songs ADD COLUMN genre` | `SongsEntity.java` | ⏳ Pending | Yes — app will fail if deployed before migration |
| `ALTER TABLE jobs ADD COLUMN genre` | `JobsEntity.java` | ⏳ Pending | Yes — app will fail if deployed before migration |
| Recombee `genre` property registration | `Recombee.configureSchema()` | ✅ Auto on startup | No |
| Recombee `duration` property registration | `Recombee.configureSchema()` | ✅ Auto on startup | No |
| Queue-add tracking (`AddBookmark`) | `InteractionApiController.java` | ✅ Implemented | No — no DB changes |
| Repeat play detection (1.0 rating) | `useAudioSync.ts` | ✅ Implemented | No — frontend only |
| Bulk reindex endpoint | `SongController.java` | ✅ Implemented | No — no DB changes |
| `RecommendNextItems` support | `Recombee.java` | ✅ Implemented | No — no DB changes |

---

## 🚀 Deploy Order

When ready to deploy:

1. Run both `ALTER TABLE` statements above on the production DB
2. Deploy the coreEngine backend
3. The `@PostConstruct` will auto-register `genre` + `duration` Recombee properties on first startup
4. Hit `POST /admin/song/reindex-recombee` to bulk-sync all song metadata (including duration) into Recombee

---

## ✅ Already Implemented (No Migration Needed)

| Feature | Notes |
|---|---|
| Search-click tracking (`AddDetailView`) | `POST /api/interaction/search-play` — no DB changes |
| Queue-add tracking (`AddBookmark`) | `POST /api/interaction/queue-add` — fired from frontend enqueue action |
| Queue-remove tracking (`DeleteBookmark` + `-0.4` rating) | `POST /api/interaction/queue-remove` — fired from frontend remove queue action |
| Repeat play detection | `useAudioSync.ts` fires 1.0 rating on repeat-one loop |
| `duration` in Recombee indexing | Wired through `saveSong()` and `reindexAll()` |
| `genre` field in Recombee indexing | Wired through job pipeline — just needs DB columns above |
| Playlist add/remove Recombee tracking | Already wired in `UserPlaylistApiService` |
| `RecommendNextItems` API | Sequential "what plays next" support in `Recombee.java` |
| Bulk Recombee reindex endpoint | `POST /admin/song/reindex-recombee` |
| Search Popularity & Frequency Ranking | Redis sorted sets (`search:popularity:*`, `search:query:*`) — no DB changes |
| Trending Search Queries API | `GET /api/search/trending` — powered by Redis |
