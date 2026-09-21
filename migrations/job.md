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

The `genre` property registration is handled automatically at app startup via `@PostConstruct` in `Recombee.java` — **no manual action needed** for this. Recombee silently ignores re-registering properties that already exist.

---

## 📋 Summary Table

| Task | File | Status | Blocking? |
|---|---|---|---|
| `ALTER TABLE songs ADD COLUMN genre` | `SongsEntity.java` | ⏳ Pending | Yes — app will fail if deployed before migration |
| `ALTER TABLE jobs ADD COLUMN genre` | `JobsEntity.java` | ⏳ Pending | Yes — app will fail if deployed before migration |
| Recombee `genre` property registration | `Recombee.configureSchema()` | ✅ Auto on startup | No |

---

## 🚀 Deploy Order

When ready to deploy:

1. Run both `ALTER TABLE` statements above on the production DB
2. Deploy the coreEngine backend
3. The `@PostConstruct` will auto-register the `genre` Recombee property on first startup

---

## ✅ Already Implemented (No Migration Needed)

| Feature | Notes |
|---|---|
| Search-click tracking (`AddDetailView`) | New endpoint `POST /api/interaction/search-play` — no DB changes |
| `genre` field in Recombee indexing | Wired through job pipeline — just needs DB columns above |
| Playlist add/remove logging fix | Silent catches now log warnings |
