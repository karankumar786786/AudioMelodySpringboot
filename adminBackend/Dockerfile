# =========================================================
# Stage 1: Build (dependencies install aur code compile)
# =========================================================
FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=0 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# uv package manager official image se copy karo
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Pehle sirf dependency files copy - code badle par bhi ye Docker layer cache se mil jaati hai
COPY pyproject.toml uv.lock ./

# Production dependencies virtual environment (.venv) me install karo
RUN uv sync --frozen --no-install-project --no-dev

# Ab app ka source code copy karo
COPY . .

# App package bhi install karo
RUN uv sync --frozen --no-dev

# Data lake ke liye DuckDB extensions (S3 padhna, Postgres attach) build ke time hi install,
# taaki chalta hua container kabhi bahar se code download na kare.
RUN /app/.venv/bin/python -c "import duckdb; c = duckdb.connect(); c.execute(\"SET extension_directory = '/app/duckdb_extensions'\"); c.install_extension('httpfs'); c.install_extension('postgres')"

# Saara Python code bytecode (.pyc) me compile karo aur .py source files hata do
RUN python -m compileall -b /app/admin && \
    find /app/admin -type f -name "*.py" ! -name "manage.py" -delete


# =========================================================
# Stage 2: Runtime (sirf compiled bytecode - source code nahi)
# =========================================================
FROM python:3.12-slim AS runner

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Runtime ke liye: healthcheck ke liye curl aur database SSL ke liye ca-certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Security ke liye non-root user banao (root se app nahi chalate)
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

# Builder se SIRF .venv aur compiled bytecode copy karo (raw .py source nahi)
COPY --from=builder --chown=appuser:appgroup /app/.venv /app/.venv
COPY --from=builder --chown=appuser:appgroup /app/admin /app/admin
COPY --from=builder --chown=appuser:appgroup /app/pyproject.toml /app/pyproject.toml
COPY --from=builder --chown=appuser:appgroup /app/duckdb_extensions /app/duckdb_extensions
ENV DUCKDB_EXTENSION_DIRECTORY=/app/duckdb_extensions

# Secrets Manager loader: sirf tab chalta hai jab SECRET_IDS set ho (entrypoint.sh dekho)
COPY --chmod=755 entrypoint.sh /app/entrypoint.sh
COPY --chmod=644 load_secrets.py /app/load_secrets.py

# Non-root user pe switch
USER appuser

# Us folder me jao jahan wsgi hai
WORKDIR /app/admin

# Django backend ka port
EXPOSE 8000

# Container health check (har 30 second /health)
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=15s \
    CMD curl -f http://localhost:8000/health || exit 1

# Gunicorn WSGI server chalao (3 workers x 2 threads).
# --no-control-socket: gunicorn >=25.1 default me $HOME/.gunicorn me gunicornc control socket kholta hai;
# appuser ka home folder nahi hai, isliye "Control server error: Permission denied" log hota tha.
# Hum gunicornc use nahi karte.
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["gunicorn", "admin.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--threads", "2", "--timeout", "120", "--access-logfile", "-", "--error-logfile", "-", "--no-control-socket"]
