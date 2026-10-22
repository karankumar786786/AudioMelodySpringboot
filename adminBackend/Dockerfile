# =========================================================
# Stage 1: Build & Test
# =========================================================
FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=0 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install uv package manager from official image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy dependency specifications first for Docker layer caching
COPY pyproject.toml uv.lock ./

# Install production dependencies directly into virtual environment
RUN uv sync --frozen --no-install-project --no-dev

# Copy application source code into builder stage
COPY . .

# Install application package
RUN uv sync --frozen --no-dev

# Compile all Python source code into bytecode (.pyc) and remove raw .py source files
RUN python -m compileall -b /app/admin && \
    find /app/admin -type f -name "*.py" ! -name "manage.py" -delete


# =========================================================
# Stage 2: Runtime Runner (Compiled Bytecode Only — No Source Code)
# =========================================================
FROM python:3.12-slim AS runner

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Install runtime dependencies: curl for healthcheck & ca-certificates for Neon SSL
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create non-root system user for security
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

# Copy ONLY virtual environment and compiled bytecode distribution (no raw .py source)
COPY --from=builder --chown=appuser:appgroup /app/.venv /app/.venv
COPY --from=builder --chown=appuser:appgroup /app/admin /app/admin
COPY --from=builder --chown=appuser:appgroup /app/pyproject.toml /app/pyproject.toml

# Switch to non-root user
USER appuser

# Switch to directory containing wsgi
WORKDIR /app/admin

# Expose Django backend port
EXPOSE 8000

# Container health check probe
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=15s \
    CMD curl -f http://localhost:8000/health || exit 1

# Start Gunicorn WSGI server
CMD ["gunicorn", "admin.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--threads", "2", "--timeout", "120", "--access-logfile", "-", "--error-logfile", "-"]
