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

# =========================================================
# Stage 2: Minimal Runtime Runner
# =========================================================
FROM oven/bun:1-slim AS runner

WORKDIR /app

# Copy ONLY dist build artifact and package.json from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

ENV NODE_ENV=production

CMD ["bun", "run", "dist/index.js"]