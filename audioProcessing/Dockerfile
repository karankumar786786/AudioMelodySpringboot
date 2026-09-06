# ---------------------------------------------------------
# Base image
# ---------------------------------------------------------
FROM oven/bun:1-debian

WORKDIR /app

# ---------------------------------------------------------
# Install system dependencies
# ---------------------------------------------------------
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------
# Install Shaka Packager
# ---------------------------------------------------------
ARG SHAKA_VERSION=3.9.3

RUN curl -L \
    "https://github.com/shaka-project/shaka-packager/releases/download/v${SHAKA_VERSION}/packager-linux-x64" \
    -o /usr/local/bin/packager \
    && chmod +x /usr/local/bin/packager

# ---------------------------------------------------------
# Verify media tools
# ---------------------------------------------------------
RUN ffmpeg -version \
    && packager --version \
    && bun --version

# ---------------------------------------------------------
# Install dependencies
# ---------------------------------------------------------

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

# ---------------------------------------------------------
# Copy application
# ---------------------------------------------------------

COPY . .

# ---------------------------------------------------------
# Environment
# ---------------------------------------------------------

ENV NODE_ENV=production
ENV INNGEST_DEV=0

# Change this if your application uses another port
EXPOSE 5010

# ---------------------------------------------------------
# Start application
# ---------------------------------------------------------

CMD ["bun", "run", "start"]