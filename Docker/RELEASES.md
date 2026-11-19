# Releasing to production

Production no longer deploys on every push to `main`.

| Tag | Who moves it | Used by |
|---|---|---|
| `:sha-<7 chars>` | CI, on every push to `main` that changes the service | Nothing directly. One per build, kept for rollbacks. |
| `:latest` | CI, on every push to `main` that changes the service | Nothing directly. The newest tested build. |
| `:stable` | You, with the **Promote to Production** workflow | The production compose files. Watchtower deploys it. |
| `:stable-previous` | The promote workflow, before it moves `:stable` | One-step rollback. |

Images: `core`, `mail` (core server) and `admin`, `audioprocessing` (processing server).

## Ship a change

1. Merge to `main`. CI tests the changed services and pushes `:latest` and `:sha-<sha>`.
2. In GitHub, open **Actions → Promote to Production → Run workflow**.
   - **services**: `all`, or one service.
   - **sha**: the 7-character commit SHA to ship. Leave it empty to ship the current `:latest`.
3. Watchtower on each server notices the new `:stable` within about 30 seconds and restarts that container.
   The workflow then checks the public health endpoints and fails if one doesn't recover.

A SHA only exists for services that changed in that commit. Promoting `all` with a SHA moves only those services; the others keep their current `:stable`.

## Roll back

Run **Promote to Production** again with the SHA of the last good build, for the affected service.
`git log --oneline -- <service folder>` lists candidate SHAs.

## One-time cutover (do these in order)

The compose files now say `:stable`, but no `:stable` tag exists on Docker Hub yet.
If the servers get the new compose files before that tag exists, the containers can't be pulled.

1. Merge this change to `main`.
2. Run **Promote to Production** with `services: all` and an empty `sha`.
   This copies today's `:latest` to `:stable` without changing what is running.
3. Copy the new compose files to both servers and restart them on `:stable`:
   ```bash
   ./Docker/core/deploy.sh
   ./Docker/admin/deploy.sh
   ```
   `deploy.sh` also copies each server's env files from this folder, so check they match the server's copies first.
4. From then on, pushes to `main` no longer change production until you promote.
