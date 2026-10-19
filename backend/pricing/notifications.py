"""Resend adapter and durable, leased price-alert email delivery."""
import logging
import uuid
from datetime import timedelta

import requests
from django.conf import settings
from django.db.models import F, Q
from django.utils import timezone

from .models import EmailNotification

logger = logging.getLogger(__name__)


def queue_alert_email(alert, title):
    user = alert.watch.user
    if not user.email_notifications_enabled or not user.is_active:
        return
    # Snapshot the content so retries always use the same idempotency payload.
    title = (title or "Takip ettiğin ürün").replace("\r", " ").replace("\n", " ")
    text = (
        f"{title}\n\nFiyat düştü: {alert.previous_price:.2f} → {alert.price:.2f} {alert.currency}\n"
        f"\nÜrünü görüntüle: {alert.watch.product.url}\n\n"
        "E-posta bildirimlerini Bindirim uygulamasındaki Ayarlar sayfasından kapatabilirsin."
    )
    EmailNotification.objects.create(alert=alert, payload={
        "to": [user.email], "subject": f"Bindirim: {title[:150]} için fiyat düştü", "text": text,
    })


def deliver_email(notification_id):
    """Return sent/retry/failed/skipped; 'sent' means accepted by Resend."""
    if not settings.RESEND_API_KEY or not settings.NOTIFICATION_FROM_EMAIL:
        return "unconfigured"
    now = timezone.now()
    lease_id = uuid.uuid4()
    claimed = EmailNotification.objects.filter(
        Q(lease_until__isnull=True) | Q(lease_until__lte=now),
        pk=notification_id, status="pending", next_attempt_at__lte=now,
    ).update(lease_id=lease_id, lease_until=now + timedelta(minutes=2))
    if not claimed:
        return "skipped"
    item = EmailNotification.objects.select_related("alert__watch__user").get(pk=notification_id)
    owned = EmailNotification.objects.filter(pk=item.pk, lease_id=lease_id)
    watch = item.alert.watch
    # Expire before Resend's 24-hour idempotency window can elapse.
    if (not watch.user.email_notifications_enabled or not watch.alerts_enabled
            or not watch.user.is_active or item.created_at <= now - timedelta(hours=23)):
        owned.update(status="skipped", lease_id=None, lease_until=None)
        return "skipped"
    if "from" not in item.payload:
        item.payload["from"] = settings.NOTIFICATION_FROM_EMAIL
        owned.update(payload=item.payload)
    owned.update(attempts=F("attempts") + 1)
    outcome = "retry"
    error = "network_error"
    provider_id = ""
    try:
        response = requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}",
                     "Idempotency-Key": f"price-alert/{item.key}"},
            json=item.payload, timeout=(5, 20), allow_redirects=False,
        )
        if 200 <= response.status_code < 300:
            data = response.json()
            provider_id = data.get("id", "") if isinstance(data, dict) else ""
            if not isinstance(provider_id, str):
                provider_id = ""
            if provider_id:
                outcome, error = "sent", ""
            else:
                error = "invalid_provider_response"
        else:
            error = f"resend_http_{response.status_code}"
            if response.status_code not in {408, 409, 429} and response.status_code < 500:
                outcome = "failed"
    except (requests.RequestException, ValueError):
        # Never store/log response bodies, recipient data, credentials, or payloads.
        pass
    owned.update(
        status="pending" if outcome == "retry" else outcome,
        provider_id=provider_id, last_error=error,
        sent_at=timezone.now() if outcome == "sent" else None,
        next_attempt_at=timezone.now() + timedelta(minutes=min(15 * 2 ** min(item.attempts, 4), 240)),
        lease_id=None, lease_until=None,
    )
    if error:
        logger.warning("Email notification %s: %s", item.pk, error)
    return outcome
