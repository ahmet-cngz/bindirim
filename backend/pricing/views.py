from datetime import timedelta

from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from .models import PriceAlert, Product, Watch
from .serializers import PriceAlertSerializer, PriceObservationSerializer, ProductSerializer, WatchSerializer
from .services import available_lease


class WatchViewSet(viewsets.ModelViewSet):
    serializer_class = WatchSerializer
    throttle_scope = None
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return Watch.objects.filter(user=self.request.user).select_related("product")

    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        watch = self.get_object()
        observations = watch.product.observations.all()
        page = self.paginate_queryset(observations)
        return self.get_paginated_response(PriceObservationSerializer(page, many=True).data)

    @action(detail=True, methods=["post"], throttle_classes=[ScopedRateThrottle], throttle_scope="refresh")
    def refresh(self, request, pk=None):
        watch = self.get_object()
        now = timezone.now()
        # Coalesce refresh requests and enforce a shared 15-minute fetch cooldown.
        product = watch.product
        if product.last_attempted_at and product.last_attempted_at > now - timedelta(minutes=15):
            return Response({"detail": "This product was checked recently. Try again after 15 minutes."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        Product.objects.filter(available_lease(now), pk=product.pk).update(next_check_at=now)
        product.refresh_from_db()
        return Response({"detail": "Price check queued; run the scheduled worker to process it.", "product": ProductSerializer(product).data}, status=status.HTTP_202_ACCEPTED)


class AlertViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = PriceAlertSerializer

    def get_queryset(self):
        return PriceAlert.objects.filter(watch__user=self.request.user).select_related("watch__product")

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        alert = self.get_object()
        if alert.read_at is None:
            alert.read_at = timezone.now()
            alert.save(update_fields=["read_at"])
        return Response(self.get_serializer(alert).data)
