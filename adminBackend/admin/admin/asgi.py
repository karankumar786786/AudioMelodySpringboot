"""ASGI config (async server ke liye entry point). Module level ``application`` variable deta hai.
Details: https://docs.djangoproject.com/en/6.1/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'admin.settings')

application = get_asgi_application()
