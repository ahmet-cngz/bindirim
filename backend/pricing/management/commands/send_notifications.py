from collections import Counter

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from pricing.models import EmailNotification
from pricing.notifications import deliver_email
from pricing.services import available_lease


class Command(BaseCommand):
    help = "Send a batch of queued price-alert emails through Resend."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=25)

    def handle(self, *args, **options):
        if not 1 <= options["limit"] <= 1000:
            raise CommandError("--limit must be between 1 and 1000.")
        if not settings.RESEND_API_KEY or not settings.NOTIFICATION_FROM_EMAIL:
            self.stdout.write(
                "Email delivery is unconfigured; set RESEND_API_KEY "
                "and NOTIFICATION_FROM_EMAIL."
            )
            return
        now = timezone.now()
        ids = list(
            EmailNotification.objects.filter(
                available_lease(now),
                status="pending",
                next_attempt_at__lte=now,
            )
            .order_by("next_attempt_at", "pk")
            .values_list("pk", flat=True)[: options["limit"]]
        )
        counts = Counter(deliver_email(pk) for pk in ids)
        self.stdout.write(f"Email notifications: {dict(counts)}")
