from collections import Counter

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from pricing.models import Product
from pricing.services import available_lease, check_product


class Command(BaseCommand):
    help = "Check one batch of due, watched products. Schedule every minute; leases prevent overlapping checks."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=100)

    def handle(self, *args, **options):
        if not 1 <= options["limit"] <= 1000:
            raise CommandError("--limit must be between 1 and 1000.")
        now = timezone.now()
        ids = list(Product.objects.filter(
            available_lease(now), next_check_at__lte=now, watches__isnull=False,
        ).order_by("next_check_at", "pk").values_list("pk", flat=True).distinct()[:options["limit"]])
        counts = Counter()
        for product_id in ids:
            outcome = check_product(product_id)
            counts[outcome] += 1
            self.stdout.write(f"product={product_id} result={outcome}")
        self.stdout.write(f"Checked {counts['ok']}; errors {counts['error']}; skipped {counts['skipped']}.")

        call_command("send_notifications", limit=options["limit"], stdout=self.stdout)
