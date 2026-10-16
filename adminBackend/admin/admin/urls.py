from django.urls import include, path

urlpatterns = [
    path("", include("dashboard.urls")),
    path("", include("accounts.urls")),
    path("", include("catalog.urls")),
    path("", include("jobs.urls")),
    path("", include("webhooks.urls")),
]
