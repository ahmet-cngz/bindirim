from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from pricing.views import AlertViewSet, WatchViewSet

router = DefaultRouter()
router.register("watches", WatchViewSet, basename="watch")
router.register("alerts", AlertViewSet, basename="alert")
urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/", include(router.urls)),
]
