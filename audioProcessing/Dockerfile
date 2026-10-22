# =========================================================
# Stage 1: Build Stage (Tests run in CI workflow)
# =========================================================
FROM oven/bun:1-debian AS builder

WORKDIR /app

# Install build dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy application source code into builder stage
COPY . .

# Compile TypeScript into optimized production bundle in ./dist
RUN bun run build


# =========================================================
# Stage 2: Minimal Runtime Runner
# =========================================================
FROM oven/bun:1-debian AS runner

WORKDIR /app

# Install runtime media tools: FFmpeg, curl (for healthchecks), ca-certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Shaka Packager (multi-arch: x86_64 and arm64)
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

# Verify media tools in runtime environment
RUN ffmpeg -version && packager --version && bun --version

# Copy ONLY compiled dist bundle and package.json from builder stage — NO source code
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Environment variables
ENV NODE_ENV=production
ENV INNGEST_DEV=0

EXPOSE 5010

# Health check probe
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
    CMD curl -f http://localhost:5010/health || exit 1

# Start the compiled bundle
CMD ["bun", "run", "start"]