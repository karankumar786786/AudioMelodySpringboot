"""Project ka main URL file: saare apps ke urls.py yahan jodte hain."""
from django.urls import include, path

urlpatterns = [
    path("", include("dashboard.urls")),
    path("", include("accounts.urls")),
    path("", include("catalog.urls")),
    path("", include("jobs.urls")),
    path("", include("webhooks.urls")),
]
