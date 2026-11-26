# =========================================================
# Stage 1: Build (tests CI workflow me chalte hain, yahan nahi)
# =========================================================
FROM oven/bun:1-debian AS builder

WORKDIR /app

# Dependencies install (lockfile ke bilkul hisaab se)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# App ka source code copy
COPY . .

# TypeScript ko ./dist me ek production bundle me compile karo
RUN bun run build

# entrypoint.sh wala Secrets Manager loader (bundle - runtime pe node_modules nahi chahiye)
RUN bun build load-secrets.ts --outfile ./dist/load-secrets.js --target bun


# =========================================================
# Stage 2: Chhota runtime image
# =========================================================
FROM oven/bun:1-debian AS runner

WORKDIR /app

# Runtime tools: FFmpeg (encoding), curl (healthcheck), ca-certificates (HTTPS)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Shaka Packager install (HLS / DASH chunks banata hai) - x86_64 aur arm64 dono ke liye
ARG SHAKA_VERSION=3.9.3
RUN ARCH=$(dpkg --print-architecture) && \
    if [ "$ARCH" = "arm64" ]; then \
        PACKAGER_ARCH="arm64"; \
    else \
        PACKAGER_ARCH="x64"; \
    fi && \
    curl -L \
        "https://github.com/shaka-project/shaka-packager/releases/download/v${SHAKA_VERSION}/packager-linux-${PACKAGER_ARCH}" \
        -o /usr/local/bin/packager \
    && chmod +x /usr/local/bin/packager

# Check ki tools sach me chal rahe hain (warna build yahin fail)
RUN ffmpeg -version && packager --version && bun --version

# Builder se SIRF dist bundle aur package.json - source code nahi
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --chmod=755 entrypoint.sh /app/entrypoint.sh

# Environment variables (INNGEST_DEV=0 = asli Inngest cloud, dev server nahi)
ENV NODE_ENV=production
ENV INNGEST_DEV=0

EXPOSE 5010

# Container health check (har 30 second /health)
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
    CMD curl -f http://localhost:5010/health || exit 1

# SECRET_IDS ho to secrets lao, phir compiled bundle chalao
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["bun", "run", "start"]