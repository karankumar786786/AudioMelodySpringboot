# =========================================================
# Stage 1: Build (code bundle karo)
# =========================================================
FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Ek bundled file /app/dist me banao
RUN bun run build

# entrypoint.sh wala Secrets Manager loader (bundled, to runtime pe node_modules nahi chahiye)
RUN bun build load-secrets.ts --outfile ./dist/load-secrets.js --target bun

# =========================================================
# Stage 2: Chhoti runtime image
# =========================================================
FROM oven/bun:1-slim AS runner

WORKDIR /app

# Builder se SIRF dist aur package.json copy karo
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --chmod=755 entrypoint.sh /app/entrypoint.sh

ENV NODE_ENV=production

# SECRET_IDS ho to secrets load karo, phir worker start
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["bun", "run", "dist/index.js"]