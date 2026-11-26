"""WSGI config (Gunicorn yahi chalata hai). Module level ``application`` variable deta hai.
Details: https://docs.djangoproject.com/en/6.1/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'admin.settings')

try:
    from core.otel import setup_opentelemetry
    setup_opentelemetry()
except Exception as e:
    import logging
    logging.getLogger(__name__).warning("Failed to initialize OpenTelemetry: %s", e)

application = get_wsgi_application()
