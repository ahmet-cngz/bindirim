import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


class Product(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        OK = "ok", "OK"
        ERROR = "error", "Error"

    url = models.URLField(max_length=2048, unique=True)
    store = models.CharField(max_length=32)
    title = models.CharField(max_length=500, blank=True)
    image_url = models.URLField(max_length=2048, blank=True)
    current_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default="TRY")
    availability = models.CharField(max_length=16, default="unknown")
    offer_key = models.CharField(max_length=64, blank=True)
    offer_label = models.CharField(max_length=300, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    last_checked_at = models.DateTimeField(null=True, blank=True)
    last_attempted_at = models.DateTimeField(null=True, blank=True)
    next_check_at = models.DateTimeField(default=timezone.now, db_index=True)
    consecutive_failures = models.PositiveIntegerField(default=0)
    last_error = models.CharField(max_length=300, blank=True)
    lease_id = models.UUIDField(null=True, blank=True, editable=False)
    lease_until = models.DateTimeField(null=True, blank=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.CheckConstraint(
            condition=Q(current_price__isnull=True) | Q(current_price__gt=0), name="product_price_positive",
        )]

    def __str__(self):
        return self.title or self.url


class Watch(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="watches")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="watches")
    target_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    alerts_enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-pk"]
        constraints = [
            models.UniqueConstraint(fields=["user", "product"], name="unique_user_product_watch"),
            models.CheckConstraint(condition=Q(target_price__isnull=True) | Q(target_price__gt=0), name="target_price_positive"),
        ]


class PriceObservation(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="observations")
    price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3)
    availability = models.CharField(max_length=16)
    offer_key = models.CharField(max_length=64, blank=True)
    offer_label = models.CharField(max_length=300, blank=True)
    observed_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-observed_at", "-pk"]
        indexes = [models.Index(fields=["product", "-observed_at"])]
        constraints = [models.CheckConstraint(
            condition=Q(price__isnull=True) | Q(price__gt=0), name="observation_price_positive",
        )]


class PriceAlert(models.Model):
    watch = models.ForeignKey(Watch, on_delete=models.CASCADE, related_name="alerts")
    observation = models.ForeignKey(PriceObservation, on_delete=models.CASCADE)
    previous_price = models.DecimalField(max_digits=12, decimal_places=2)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-pk"]
        constraints = [models.UniqueConstraint(fields=["watch", "observation"], name="unique_watch_observation_alert")]


class EmailNotification(models.Model):
    """Durable outbox, created in the same transaction as a price alert."""

    alert = models.OneToOneField(PriceAlert, on_delete=models.CASCADE, related_name="email_notification")
    key = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    payload = models.JSONField(default=dict)
    status = models.CharField(max_length=16, default="pending", db_index=True,
                              choices=[("pending", "Pending"), ("sent", "Sent"), ("skipped", "Skipped"), ("failed", "Failed")])
    attempts = models.PositiveIntegerField(default=0)
    next_attempt_at = models.DateTimeField(default=timezone.now, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    provider_id = models.CharField(max_length=100, blank=True)
    last_error = models.CharField(max_length=100, blank=True)
    lease_id = models.UUIDField(null=True, blank=True, editable=False)
    lease_until = models.DateTimeField(null=True, blank=True, editable=False)
