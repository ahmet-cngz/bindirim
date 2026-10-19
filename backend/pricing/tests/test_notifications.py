from datetime import timedelta
from decimal import Decimal
from unittest.mock import Mock, patch

import requests
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from pricing.models import EmailNotification, PriceAlert, Product, Watch
from pricing.notifications import deliver_email
from pricing.scrapers import PriceResult
from pricing.services import check_product


@override_settings(
    RESEND_API_KEY="test-key",
    NOTIFICATION_FROM_EMAIL="Bindirim <alerts@example.com>",
    PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"],
)
class NotificationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            "owner@example.com", "password", email_notifications_enabled=True
        )
        self.product = Product.objects.create(
            url="https://www.trendyol.com/brand/shirt-p-31341390",
            store="trendyol",
            current_price=100,
            title="Shirt",
        )
        self.watch = Watch.objects.create(user=self.user, product=self.product)
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def drop(self):
        with patch(
            "pricing.services.scrape_product",
            return_value=PriceResult(
                "Shirt", "", Decimal("80"), "TRY", "in_stock"
            ),
        ):
            check_product(self.product.pk)

    def retry_due(self, item):
        EmailNotification.objects.filter(pk=item.pk).update(
            next_attempt_at=timezone.now()
        )

    def test_opt_in_required_and_queue_is_atomic_with_alert(self):
        self.user.email_notifications_enabled = False
        self.user.save()
        self.drop()
        self.assertEqual(PriceAlert.objects.count(), 1)
        self.assertFalse(EmailNotification.objects.exists())

    def test_drop_queues_one_email_without_network_io(self):
        with patch("pricing.notifications.requests.post") as post:
            self.drop()
            self.assertEqual(EmailNotification.objects.count(), 1)
            self.product.refresh_from_db()
            Product.objects.filter(pk=self.product.pk).update(
                next_check_at=timezone.now()
            )
            self.drop()
            self.assertEqual(EmailNotification.objects.count(), 1)
            post.assert_not_called()

    def test_queue_failure_rolls_back_price_and_alert(self):
        with patch(
            "pricing.services.queue_alert_email",
            side_effect=RuntimeError("db failure"),
        ):
            with self.assertRaises(RuntimeError):
                self.drop()
        self.assertFalse(PriceAlert.objects.exists())
        self.product.refresh_from_db()
        self.assertEqual(self.product.current_price, 100)

    @patch("pricing.notifications.requests.post")
    def test_success_sent_once_and_provider_contract(self, post):
        self.drop()
        item = EmailNotification.objects.get()
        post.return_value = Mock(
            status_code=200, json=lambda: {"id": "message-id"}
        )
        self.assertEqual(deliver_email(item.pk), "sent")
        self.assertEqual(deliver_email(item.pk), "skipped")
        post.assert_called_once()
        args = post.call_args.kwargs
        self.assertEqual(
            args["headers"]["Idempotency-Key"], f"price-alert/{item.key}"
        )
        self.assertEqual(args["json"]["to"], [self.user.email])
        self.assertIn("100.00 → 80.00 TRY", args["json"]["text"])
        self.assertEqual(args["json"]["from"], "Bindirim <alerts@example.com>")
        item.refresh_from_db()
        self.assertEqual(item.provider_id, "message-id")
        self.assertIsNotNone(item.sent_at)

    @patch("pricing.notifications.requests.post")
    def test_timeout_retries_with_identical_payload_and_key(self, post):
        self.drop()
        item = EmailNotification.objects.get()
        post.side_effect = requests.Timeout()
        self.assertEqual(deliver_email(item.pk), "retry")
        first = post.call_args
        item.refresh_from_db()
        self.assertEqual(item.attempts, 1)
        self.assertEqual(item.status, "pending")
        self.assertGreater(item.next_attempt_at, timezone.now())
        self.retry_due(item)
        post.side_effect = None
        post.return_value = Mock(
            status_code=200, json=lambda: {"id": "recovered"}
        )
        with override_settings(NOTIFICATION_FROM_EMAIL="changed@example.com"):
            self.assertEqual(deliver_email(item.pk), "sent")
        self.assertEqual(first, post.call_args)

    @patch("pricing.notifications.requests.post")
    def test_rate_limit_retries_and_permanent_error_stops(self, post):
        self.drop()
        item = EmailNotification.objects.get()
        post.return_value = Mock(status_code=429)
        self.assertEqual(deliver_email(item.pk), "retry")
        self.retry_due(item)
        post.return_value = Mock(status_code=403)
        self.assertEqual(deliver_email(item.pk), "failed")
        item.refresh_from_db()
        self.assertEqual(item.last_error, "resend_http_403")

    @patch("pricing.notifications.requests.post")
    def test_expired_messages_and_disabled_watches_not_sent(self, post):
        self.drop()
        item = EmailNotification.objects.get()
        EmailNotification.objects.filter(pk=item.pk).update(
            created_at=timezone.now() - timedelta(hours=23)
        )
        self.assertEqual(deliver_email(item.pk), "skipped")
        EmailNotification.objects.filter(pk=item.pk).update(
            status="pending", created_at=timezone.now()
        )
        self.watch.alerts_enabled = False
        self.watch.save()
        self.assertEqual(deliver_email(item.pk), "skipped")
        post.assert_not_called()

    @patch("pricing.notifications.requests.post")
    def test_active_lease_prevents_second_worker(self, post):
        self.drop()
        item = EmailNotification.objects.get()
        EmailNotification.objects.filter(pk=item.pk).update(
            lease_until=timezone.now() + timedelta(minutes=1)
        )
        self.assertEqual(deliver_email(item.pk), "skipped")
        post.assert_not_called()

    @override_settings(RESEND_API_KEY="")
    @patch("pricing.notifications.requests.post")
    def test_unconfigured_keeps_pending(self, post):
        self.drop()
        item = EmailNotification.objects.get()
        self.assertEqual(deliver_email(item.pk), "unconfigured")
        item.refresh_from_db()
        self.assertEqual(item.status, "pending")
        self.assertFalse(
            self.client.get("/api/auth/me/").data[
                "email_notifications_available"
            ]
        )
        post.assert_not_called()

    def test_preferences_are_private_and_opt_out_cancels_queue(self):
        self.drop()
        other = User.objects.create_user("other@example.com", "password")
        response = self.client.patch(
            "/api/auth/me/",
            {"email_notifications_enabled": False, "email": other.email},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["email_notifications_enabled"])
        self.assertEqual(response.data["email"], self.user.email)
        self.assertEqual(EmailNotification.objects.get().status, "skipped")
        self.client.force_authenticate(None)
        self.assertEqual(
            self.client.patch(
                "/api/auth/me/",
                {"email_notifications_enabled": True},
                format="json",
            ).status_code,
            401,
        )

    @patch("pricing.notifications.requests.post")
    def test_management_command_drains_queue(self, post):
        self.drop()
        post.return_value = Mock(
            status_code=200, json=lambda: {"id": "message-id"}
        )
        call_command("send_notifications", limit=1)
        self.assertEqual(EmailNotification.objects.get().status, "sent")
