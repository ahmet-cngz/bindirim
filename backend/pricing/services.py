import logging
import uuid
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .models import PriceAlert, PriceObservation, Product
from .notifications import queue_alert_email
from .scrapers import PriceCheckError, scrape_product

logger = logging.getLogger(__name__)


def available_lease(now):
    return Q(lease_until__isnull=True) | Q(lease_until__lte=now)


def check_product(product_id):
    """Claim one due product atomically; do network I/O outside transactions.

    Returns ok/error/skipped. Leases fence off late results from expired jobs.
    PostgreSQL is recommended when running multiple workers.
    """
    started = timezone.now()
    lease_id = uuid.uuid4()
    claimed = Product.objects.filter(
        available_lease(started),
        pk=product_id,
        next_check_at__lte=started,
    ).update(
        lease_id=lease_id,
        lease_until=started
        + timedelta(seconds=settings.PRICE_CHECK_LEASE_SECONDS),
        last_attempted_at=started,
    )
    if not claimed:
        return "skipped"
    product = Product.objects.get(pk=product_id)
    try:
        result = scrape_product(product.url)
    except Exception as exc:
        if isinstance(exc, PriceCheckError):
            message = str(exc)
        else:
            logger.exception(
                "Unexpected price check failure for product %s", product_id
            )
            message = "Unexpected price check failure. The tracker will retry."
        with transaction.atomic():
            locked = Product.objects.select_for_update().get(pk=product_id)
            if locked.lease_id != lease_id:
                return "skipped"
            locked.consecutive_failures += 1
            locked.status = Product.Status.ERROR
            locked.last_error = message[:300]
            # Retry after 15m, 30m, 1h, ... capped at the normal interval.
            delay = min(
                15 * 2 ** min(locked.consecutive_failures - 1, 10),
                settings.PRICE_CHECK_INTERVAL_MINUTES,
            )
            locked.next_check_at = timezone.now() + timedelta(minutes=delay)
            locked.lease_id = None
            locked.lease_until = None
            locked.save()
        return "error"

    with transaction.atomic():
        product = Product.objects.select_for_update().get(pk=product_id)
        if product.lease_id != lease_id:
            return "skipped"
        now = timezone.now()
        previous = product.current_price
        observation = PriceObservation.objects.create(
            product=product,
            price=result.price,
            currency=result.currency,
            availability=result.availability,
            observed_at=now,
            offer_key=result.offer_key,
            offer_label=result.offer_label,
        )
        # The first observation establishes a baseline. No initial-price alert.
        if (
            previous is not None
            and result.price is not None
            and result.price < previous
            and product.currency == result.currency
            and product.offer_key == result.offer_key
            and result.availability in {"in_stock", "unknown"}
        ):
            watches = product.watches.filter(
                alerts_enabled=True, created_at__lte=started
            ).filter(
                Q(target_price__isnull=True)
                | Q(target_price__gte=result.price, target_price__lt=previous)
            )
            alerts = PriceAlert.objects.bulk_create(
                [
                    PriceAlert(
                        watch=watch,
                        observation=observation,
                        previous_price=previous,
                        price=result.price,
                        currency=result.currency,
                    )
                    for watch in watches
                ]
            )
            for alert in alerts:
                queue_alert_email(alert, result.title or product.title)
        product.title = result.title or product.title
        product.image_url = result.image_url or product.image_url
        # An unavailable item retains its last known price, with explicit
        # availability.
        if result.price is not None or product.offer_key != result.offer_key:
            product.current_price = result.price
        product.offer_key = result.offer_key
        product.offer_label = result.offer_label
        product.currency = result.currency
        product.availability = result.availability
        product.status = Product.Status.OK
        product.last_checked_at = now
        product.next_check_at = now + timedelta(
            minutes=settings.PRICE_CHECK_INTERVAL_MINUTES
        )
        product.last_error = ""
        product.consecutive_failures = 0
        product.lease_id = None
        product.lease_until = None
        product.save()
    return "ok"
