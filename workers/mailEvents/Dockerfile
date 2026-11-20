# =========================================================
# Stage 1: Build Stage
# =========================================================
FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Build bundled standalone output into /app/dist
RUN bun run build

# Secrets Manager loader used by entrypoint.sh (bundled, so no node_modules at runtime)
RUN bun build load-secrets.ts --outfile ./dist/load-secrets.js --target bun

# =========================================================
# Stage 2: Minimal Runtime Runner
# =========================================================
FROM oven/bun:1-slim AS runner

WORKDIR /app

# Copy ONLY dist build artifact and package.json from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --chmod=755 entrypoint.sh /app/entrypoint.sh

ENV NODE_ENV=production

# Load secrets when SECRET_IDS is set, then start the worker
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["bun", "run", "dist/index.js"]