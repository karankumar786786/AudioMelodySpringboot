"""Admin API (Django project) ki saari settings: database, Redis, S3, Algolia, Recombee, Inngest, cookies, CORS...
Zyadatar values environment variables se aati hain (production me AWS Secrets Manager se).
Django settings ki poori list: https://docs.djangoproject.com/en/6.1/ref/settings/
"""

import os
from pathlib import Path
from dotenv import load_dotenv
import dj_database_url

# Project ke andar paths aise banao: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# .env file se environment variables (na ho to koi baat nahi)
load_dotenv(BASE_DIR.parent / ".env")
load_dotenv(BASE_DIR.parent.parent / "coreEngine" / ".env")
load_dotenv(BASE_DIR.parent.parent / ".env")

import secrets
import sys
from django.core.exceptions import ImproperlyConfigured

# Debug BAND rehta hai jab tak khud on na karo (DJANGO_DEBUG=true sirf local development me).
DEBUG = os.getenv("DJANGO_DEBUG", "false").strip().lower() in ("true", "1", "yes")
_RUNNING_TESTS = "test" in sys.argv

# Local development aur tests ke alawa SECRET_KEY environment se hi aani chahiye.
# Asli key kabhi commit mat karo; aise banao:
#   python -c "import secrets; print(secrets.token_urlsafe(64))"
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "").strip()
if not SECRET_KEY:
    if DEBUG or _RUNNING_TESTS:
        # Har process ki faltu key: dev/tests ke liye theek, restart ke baad bekaar.
        SECRET_KEY = "django-insecure-dev-" + secrets.token_urlsafe(48)
    else:
        raise ImproperlyConfigured(
            "DJANGO_SECRET_KEY is not set. Set it in the environment, or set DJANGO_DEBUG=true for local development."
        )

JWT_SECRET = os.getenv("JWT_SECRET", "")

# Comma-separated, e.g. "api-admin-one-melody.one-org.me,admin,localhost". Defaults to any host
# kyunki public traffic Caddy sambhalta hai aur andar ki services is container ko naam se call karti hain.
ALLOWED_HOSTS = [
    h.strip() for h in os.getenv("DJANGO_ALLOWED_HOSTS", "*").split(",") if h.strip()
]

# Apps ki list
INSTALLED_APPS = [
    # Hamare apps (pehle rakhe hain taaki createsuperuser jaise apne commands Django wale se pehle chalein)
    "core.apps.CoreConfig",
    "accounts.apps.AccountsConfig",
    "catalog.apps.CatalogConfig",
    "jobs.apps.JobsConfig",
    "dashboard.apps.DashboardConfig",
    "webhooks.apps.WebhooksConfig",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Bahar ke apps (libraries)
    "rest_framework",
    "corsheaders",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "core.middleware.SecurityHeadersAndAuditMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# CORS: kaunsi websites browser se ye API call kar sakti hain
_cors_origins = os.getenv("CORS_ALLOWED_ORIGINS", "")
if _cors_origins:
    CORS_ALLOWED_ORIGINS = [origin.strip() for origin in _cors_origins.split(",") if origin.strip()]
    CORS_ALLOW_ALL_ORIGINS = False
else:
    CORS_ALLOWED_ORIGINS = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]
    CORS_ALLOW_ALL_ORIGINS = DEBUG

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
]
CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
    "x-api-key",
    "x-application-api-key",
    "api-key",
    "x-temp-token",
    "x-session-id",
    "x-admin-session",
    "session-id",
    "x-admin-client",
]

# Security headers aur cookie rules
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = "Lax"

if not DEBUG:
    # Caddy ke peeche HTTPS pe chalta hai: uske bheje scheme pe bharosa karo aur cookies sirf HTTPS pe bhejo.
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

ROOT_URLCONF = "admin.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "admin.wsgi.application"

# Database setting (dj-database-url se)
# DB_URL, DATABASE_URL, DB_USER, DB_PASSWORD - core API (Spring Boot) jaise hi env naam
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

raw_db_url = os.getenv("DB_URL", os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/melody"))
if raw_db_url.startswith("jdbc:postgresql://"):
    raw_db_url = raw_db_url.replace("jdbc:postgresql://", "postgresql://")

_parsed = urlparse(raw_db_url)
_qs = parse_qs(_parsed.query)
_valid_params = {"sslmode", "connect_timeout", "options", "keepalives", "sslcert", "sslkey", "sslrootcert"}
_filtered_qs = {k: v for k, v in _qs.items() if k.lower() in _valid_params}
_cleaned_db_url = urlunparse(_parsed._replace(query=urlencode(_filtered_qs, doseq=True)))

from typing import Any, Dict

_db_config: Dict[str, Any] = dict(dj_database_url.parse(_cleaned_db_url))
_db_user = os.getenv("DB_USER")
if not _db_config.get("USER") and _db_user:
    _db_config["USER"] = _db_user
_db_password = os.getenv("DB_PASSWORD")
if not _db_config.get("PASSWORD") and _db_password:
    _db_config["PASSWORD"] = _db_password

_db_config["CONN_MAX_AGE"] = 600
_db_config["CONN_HEALTH_CHECKS"] = True

if _RUNNING_TESTS:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }
else:
    DATABASES = {
        "default": _db_config
    }

# Database schema sirf Flyway (migration service) badalta hai.
# Is admin API me Django kabhi migrations na banaye na chalaye.
MIGRATION_MODULES = {
    "core": None,
    "accounts": None,
    "catalog": None,
    "jobs": None,
    "dashboard": None,
    "webhooks": None,
    "api": None,
}

# Django REST Framework ki setting
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "core.authentication.AdminSessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "core.authentication.IsAdminUserPermission",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/minute",
        "user": "600/minute",
    },
    "UNAUTHENTICATED_USER": None,
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Language aur timezone
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, images)
STATIC_URL = "static/"

# Bahar ki services ki settings
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None) or None
REDIS_SSL = os.getenv("REDIS_SSL_ENABLED", "false").lower() in ("true", "1", "yes")
REDIS_AUDIO_PROCESSING_QUEUE = os.getenv("REDIS_AUDIO_PROCESSING_QUEUE", "audio_processing_queue")
REDIS_DELETE_QUEUE = os.getenv("REDIS_DELETE_QUEUE", "delete_event_queue")
REDIS_CANCEL_QUEUE = os.getenv("REDIS_CANCEL_QUEUE", "audio_cancel_queue")
REDIS_MAIL_QUEUE = os.getenv("REDIS_MAIL_QUEUE", "mail_queue")

# Event pipeline (core/services/outbox_service.py). LEGACY = pehle jaisa behaviour.
EVENTS_MODE = os.getenv("EVENTS_MODE", "LEGACY").upper()
# Redpanda HTTP proxy - sirf commit ke baad outboxRelay ko jagane ke liye.
KAFKA_REST_PROXY_URL = os.getenv("KAFKA_REST_PROXY_URL", "")
EVENTS_OTP_FALLBACK_SECONDS = float(os.getenv("EVENTS_OTP_FALLBACK_SECONDS", "30"))

# Admin sessions, refresh sessions aur blocks kahan se padhe jaayein.
# "redis": Redis hi asli source, saare gunicorn workers share karte hain; worker ki
#          memory copy sirf tab jab Redis na mile.
# "memory": sirf is process me. Tests ke liye, jo sessions seedha memory me daalte hain.
ADMIN_SESSION_STORE = os.getenv("ADMIN_SESSION_STORE", "memory" if _RUNNING_TESTS else "redis")

AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", os.getenv("ACCESS_KEY_ID", "default_access_key"))
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", os.getenv("SECRET_KEY", "default_secret_key"))
AWS_REGION = os.getenv("AWS_REGION", os.getenv("REGION", "ap-south-1"))
AWS_ENDPOINT = os.getenv("AWS_ENDPOINT", None) or None
S3_TEMP_BUCKET = os.getenv("S3_TEMP_BUCKET", os.getenv("TEMP_BUCKET_NAME", "audiomelodyspringboottemp"))
S3_PRODUCTION_BUCKET = os.getenv("S3_PRODUCTION_BUCKET", os.getenv("PRODUCTION_BUCKET_NAME", "audiomelodyspringboot"))

# Raw listening events ka S3 data lake (Parquet, Redpanda Connect likhta hai: infra/lake).
# Analytics pages DuckDB se padhte hain. LAKE_URI khaali = lake wale numbers nahi dikhenge.
# AWS pe instance role use hota hai; LAKE_S3_ENDPOINT sirf local S3 jaise stores ke liye.
LAKE_BUCKET = os.getenv("LAKE_BUCKET", "")
LAKE_URI = os.getenv("LAKE_URI", f"s3://{LAKE_BUCKET}/lake" if LAKE_BUCKET else "")
LAKE_S3_ENDPOINT = os.getenv("LAKE_S3_ENDPOINT", "")
LAKE_S3_URL_STYLE = os.getenv("LAKE_S3_URL_STYLE", "path")
LAKE_S3_USE_SSL = os.getenv("LAKE_S3_USE_SSL", "false")
LAKE_CREDENTIAL_CHAIN = os.getenv("LAKE_CREDENTIAL_CHAIN", "instance;env;config")
DUCKDB_EXTENSION_DIRECTORY = os.getenv("DUCKDB_EXTENSION_DIRECTORY", "")

IMAGEKIT_PUBLIC_KEY = os.getenv("IMAGEKIT_PUBLIC_KEY", "")
IMAGEKIT_PRIVATE_KEY = os.getenv("IMAGEKIT_PRIVATE_KEY", "")
IMAGEKIT_URL_ENDPOINT = os.getenv("IMAGEKIT_URL_ENDPOINT", "")

ALGOLIA_APP_ID = os.getenv("ALGOLIA_APP_ID", "")
ALGOLIA_API_KEY = os.getenv("ALGOLIA_API_KEY", "")
ALGOLIA_INDEX_NAME = os.getenv("ALGOLIA_INDEX_NAME", "one_melody_springboot")

RECOMBEE_DATABASE_ID = os.getenv("RECOMBEE_DATABASE_ID", "")
RECOMBEE_DATABASE_SECRET = os.getenv("RECOMBEE_DATABASE_SECRET", "")
RECOMBEE_DATABASE_REGION = os.getenv("RECOMBEE_DATABASE_REGION", "EU_WEST")

AUDIO_PROCESSING_URL = os.getenv("AUDIO_PROCESSING_URL", "http://localhost:5010")
AUDIO_PROCESSING_API_KEY = os.getenv("AUDIO_PROCESSING_API_KEY", "")
APPLICATION_API_KEY = os.getenv("APPLICATION_API_KEY", os.getenv("SPRING_APPLICATION_API_KEY", AUDIO_PROCESSING_API_KEY))
INNGEST_DEV = os.getenv("INNGEST_DEV", "0") in ("1", "true", "True")
# Inngest keys sirf environment se (production me Secrets Manager).
# Local Inngest dev server ko inki zaroorat nahi, isliye dev / debug / tests me na hon to chalega.
INNGEST_EVENT_KEY = os.getenv("INNGEST_EVENT_KEY", "").strip()
INNGEST_SIGNING_KEY = os.getenv("INNGEST_SIGNING_KEY", "").strip()
_missing_inngest = [
    name for name, value in (("INNGEST_EVENT_KEY", INNGEST_EVENT_KEY), ("INNGEST_SIGNING_KEY", INNGEST_SIGNING_KEY)) if not value
]
if _missing_inngest and not (INNGEST_DEV or DEBUG or _RUNNING_TESTS):
    raise ImproperlyConfigured(
        f"{', '.join(_missing_inngest)} not set. Set them in the environment, or set INNGEST_DEV=1 for local development."
    )
INNGEST_DEV_URL = os.getenv("INNGEST_DEV_URL", "http://localhost:8288")

SILENCED_SYSTEM_CHECKS = ["fields.W342"]

# Logging setting (har log me OpenTelemetry trace id)
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {
        "otel_context": {
            "()": "core.otel.OpenTelemetryContextFilter",
        },
    },
    "formatters": {
        "standard": {
            "format": "%(asctime)s [%(levelname)s] [%(otelServiceName)s,%(otelTraceID)s,%(otelSpanID)s] %(name)s: %(message)s",
            "datefmt": "%Y-%m-%dT%H:%M:%S%z",
        },
    },
    "handlers": {
        "console": {
            "level": "INFO",
            "class": "logging.StreamHandler",
            "filters": ["otel_context"],
            "formatter": "standard",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "django.server": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "django.request": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "core": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "catalog": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "accounts": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "jobs": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "api": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}




