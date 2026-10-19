from decimal import Decimal
from urllib.parse import urlsplit

from rest_framework import serializers

from .models import PriceAlert, PriceObservation, Product, Watch
from .scrapers import PriceCheckError, canonicalize_url


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = [
            "id", "url", "store", "title", "image_url", "current_price", "currency",
            "availability", "offer_label", "status", "last_checked_at", "last_attempted_at", "next_check_at", "last_error",
        ]
        read_only_fields = fields


class WatchSerializer(serializers.ModelSerializer):
    url = serializers.URLField(write_only=True, max_length=2048, required=True)
    product = ProductSerializer(read_only=True)
    alerts_enabled = serializers.BooleanField(required=False, default=True)
    target_price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"), required=False, allow_null=True)

    class Meta:
        model = Watch
        fields = ["id", "url", "product", "target_price", "alerts_enabled", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_url(self, value):
        try:
            canonical, _ = canonicalize_url(value)
        except PriceCheckError as exc:
            raise serializers.ValidationError(str(exc)) from exc
        if urlsplit(canonical).query:
            raise serializers.ValidationError("Seller/variant URL parameters are not supported yet; use the base product URL.")
        if self.instance and canonical != self.instance.product.url:
            raise serializers.ValidationError("Remove this watch and create a new one to change its product.")
        return canonical

    def create(self, validated_data):
        url = validated_data.pop("url")
        product, _ = Product.objects.get_or_create(url=url, defaults={"store": canonicalize_url(url)[1]})
        watch, created = Watch.objects.get_or_create(
            user=self.context["request"].user, product=product, defaults=validated_data,
        )
        if not created:
            raise serializers.ValidationError({"url": "You already track this product."})
        return watch

    def update(self, instance, validated_data):
        validated_data.pop("url", None)
        return super().update(instance, validated_data)


class PriceObservationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceObservation
        fields = ["id", "price", "currency", "availability", "offer_label", "observed_at"]
        read_only_fields = fields


class PriceAlertSerializer(serializers.ModelSerializer):
    product = ProductSerializer(source="watch.product", read_only=True)

    class Meta:
        model = PriceAlert
        fields = ["id", "watch", "product", "previous_price", "price", "currency", "created_at", "read_at"]
        read_only_fields = fields
