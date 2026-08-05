# build stage
FROM node:20-slim AS build

# Install Bun globally
RUN npm install -g bun

WORKDIR /app

# Copy all source files
COPY . .

RUN bun install --frozen-lockfile

# Remove ALL native SWC binaries to force WASM fallback
RUN find node_modules -type d -name "@next" | xargs -I{} find {} -maxdepth 1 -name "swc-*" -type d | xargs rm -rf

# Disable telemetry and specifically enable WASM fallback
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_DISABLE_TURBOPACK=1
ENV NEXT_PRIVATE_LOCAL_SKIP_SWC_CHECK=1
ENV NEXT_OTEL_FETCH_DISABLED=1

ARG NEXT_PUBLIC_AUTH0_DOMAIN
ARG NEXT_PUBLIC_AUTH0_CLIENT_ID
ARG NEXT_PUBLIC_API_URL

ENV NEXT_PUBLIC_AUTH0_DOMAIN=$NEXT_PUBLIC_AUTH0_DOMAIN
ENV NEXT_PUBLIC_AUTH0_CLIENT_ID=$NEXT_PUBLIC_AUTH0_CLIENT_ID
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Run build
WORKDIR /app/audioFrontend
RUN bun run build

# runtime stage
FROM oven/bun:latest AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=build /app/audioFrontend/.next/standalone ./
COPY --from=build /app/audioFrontend/.next/static ./audioFrontend/.next/static
COPY --from=build /app/audioFrontend/public ./audioFrontend/public

EXPOSE 3000

CMD ["bun", "audioFrontend/server.js"]