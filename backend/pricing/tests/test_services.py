import uuid
from datetime import timedelta
from decimal import Decimal
from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone

from accounts.models import User
from pricing.models import PriceAlert, PriceObservation, Product, Watch
from pricing.scrapers import PriceCheckError, PriceResult
from pricing.services import check_product

URL = "https://www.trendyol.com/brand/shirt-p-31341390"


class PriceCheckTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            "owner@example.com", "test-password"
        )
        self.product = Product.objects.create(url=URL, store="trendyol")
        self.watch = Watch.objects.create(user=self.user, product=self.product)

    def check(self, price="100.00", availability="in_stock", offer_key=""):
        Product.objects.filter(pk=self.product.pk).update(
            next_check_at=timezone.now() - timedelta(seconds=1)
        )
        result = PriceResult(
            "Shirt",
            "",
            Decimal(price) if price is not None else None,
            "TRY",
            availability,
            offer_key,
        )
        with patch("pricing.services.scrape_product", return_value=result):
            outcome = check_product(self.product.pk)
        self.product.refresh_from_db()
        return outcome

    def test_first_price_baseline_then_drop_creates_one_alert(self):
        self.assertEqual(self.check(), "ok")
        self.assertFalse(PriceAlert.objects.exists())
        self.check("80")
        alert = PriceAlert.objects.get()
        self.assertEqual(alert.previous_price, Decimal("100"))
        self.assertEqual(alert.price, Decimal("80"))
        self.check("80")
        self.check("90")
        self.assertEqual(PriceAlert.objects.count(), 1)
        self.assertEqual(PriceObservation.objects.count(), 4)

    def test_target_only_alerts_when_crossed(self):
        self.watch.target_price = Decimal("75")
        self.watch.save()
        self.check("100")
        self.check("80")
        self.assertFalse(PriceAlert.objects.exists())
        self.check("70")
        self.check("65")
        self.assertEqual(PriceAlert.objects.count(), 1)
        self.check("90")
        self.check("75")
        self.assertEqual(PriceAlert.objects.count(), 2)

    def test_disabled_watch_does_not_alert(self):
        self.watch.alerts_enabled = False
        self.watch.save()
        self.check("100")
        self.check("50")
        self.assertFalse(PriceAlert.objects.exists())

    def test_failure_preserves_last_good_price_and_backs_off(self):
        self.check()
        last_checked = self.product.last_checked_at
        Product.objects.filter(pk=self.product.pk).update(
            next_check_at=timezone.now()
        )
        with patch(
            "pricing.services.scrape_product",
            side_effect=PriceCheckError("Store returned HTTP 403."),
        ):
            self.assertEqual(check_product(self.product.pk), "error")
        self.product.refresh_from_db()
        self.assertEqual(self.product.current_price, Decimal("100"))
        self.assertEqual(self.product.last_checked_at, last_checked)
        self.assertEqual(self.product.status, "error")
        self.assertEqual(self.product.consecutive_failures, 1)
        self.assertGreater(
            self.product.next_check_at, timezone.now() + timedelta(minutes=14)
        )
        self.assertEqual(PriceObservation.objects.count(), 1)
        self.check("90")
        self.assertEqual(self.product.consecutive_failures, 0)
        self.assertEqual(self.product.last_error, "")

    def test_unavailable_retains_last_price_without_alert(self):
        self.check()
        self.check(None, "out_of_stock")
        self.assertEqual(self.product.current_price, Decimal("100"))
        self.assertEqual(self.product.availability, "out_of_stock")
        self.assertIsNone(PriceObservation.objects.first().price)
        self.assertFalse(PriceAlert.objects.exists())

    def test_offer_change_resets_comparison(self):
        self.check("100", offer_key="seller-a")
        self.check("50", offer_key="seller-b")
        self.assertFalse(PriceAlert.objects.exists())
        self.check("40", offer_key="seller-b")
        self.assertEqual(PriceAlert.objects.count(), 1)

    def test_new_unavailable_offer_does_not_reuse_other_offer_price(self):
        self.check("100", offer_key="seller-a")
        self.check(None, "out_of_stock", offer_key="seller-b")
        self.assertIsNone(self.product.current_price)
        self.check("40", offer_key="seller-b")
        self.assertFalse(PriceAlert.objects.exists())

    @patch("pricing.services.scrape_product")
    def test_due_time_and_active_lease_skip_network(self, scrape):
        Product.objects.filter(pk=self.product.pk).update(
            next_check_at=timezone.now() + timedelta(hours=1)
        )
        self.assertEqual(check_product(self.product.pk), "skipped")
        Product.objects.filter(pk=self.product.pk).update(
            next_check_at=timezone.now(),
            lease_until=timezone.now() + timedelta(minutes=2),
        )
        self.assertEqual(check_product(self.product.pk), "skipped")
        scrape.assert_not_called()

    def test_expired_lease_can_be_reclaimed(self):
        Product.objects.filter(pk=self.product.pk).update(
            lease_id=uuid.uuid4(),
            lease_until=timezone.now() - timedelta(minutes=1),
        )
        self.assertEqual(self.check(), "ok")

    @override_settings(PRICE_CHECK_INTERVAL_MINUTES=15)
    def test_fifteen_minute_success_and_failure_schedule(self):
        self.check()
        self.assertAlmostEqual(
            (
                self.product.next_check_at - self.product.last_checked_at
            ).total_seconds(),
            900,
        )
        Product.objects.filter(pk=self.product.pk).update(
            next_check_at=timezone.now(), consecutive_failures=3
        )
        before = timezone.now()
        with patch(
            "pricing.services.scrape_product",
            side_effect=PriceCheckError("Store unavailable."),
        ):
            self.assertEqual(check_product(self.product.pk), "error")
        self.product.refresh_from_db()
        self.assertLess(
            abs((self.product.next_check_at - before).total_seconds() - 900), 5
        )

    def test_expired_worker_cannot_overwrite_new_lease(self):
        def replace_lease(url):
            Product.objects.filter(pk=self.product.pk).update(
                lease_id=uuid.uuid4()
            )
            return PriceResult("Shirt", "", Decimal("100"), "TRY", "in_stock")

        with patch(
            "pricing.services.scrape_product", side_effect=replace_lease
        ):
            self.assertEqual(check_product(self.product.pk), "skipped")
        self.assertFalse(PriceObservation.objects.exists())

    @patch(
        "pricing.services.scrape_product",
        return_value=PriceResult(
            "Shirt", "", Decimal("100"), "TRY", "in_stock"
        ),
    )
    def test_command_fetches_shared_product_once_and_ignores_unwatched(
        self, scrape
    ):
        second_user = User.objects.create_user(
            "other@example.com", "test-password"
        )
        Watch.objects.create(user=second_user, product=self.product)
        Product.objects.create(
            url="https://www.trendyol.com/brand/other-p-2", store="trendyol"
        )
        output = StringIO()
        call_command("check_prices", stdout=output)
        self.assertEqual(scrape.call_count, 1)
        self.assertIn("Checked 1", output.getvalue())
