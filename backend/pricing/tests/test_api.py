from datetime import timedelta
from decimal import Decimal
from io import StringIO
from unittest.mock import patch

from django.core.cache import cache
from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from accounts.models import User
from pricing.models import PriceAlert, PriceObservation, Product, Watch
from pricing.scrapers import PriceResult

URL = "https://www.hepsiburada.com/bedding-p-HBCV0000777WJ6"


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class AuthTests(APITestCase):
    def setUp(self):
        cache.clear()

    def test_register_login_logout_and_case_insensitive_email(self):
        response = self.client.post("/api/auth/register/", {"email": "Person@Example.com", "password": "A-fairly-strong-372-password"})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["user"]["email"], "person@example.com")
        self.assertNotIn("password", response.data["user"])
        self.assertNotEqual(User.objects.get().password, "A-fairly-strong-372-password")
        self.assertEqual(self.client.post("/api/auth/register/", {"email": "PERSON@example.com", "password": "Another-strong-937-password"}).status_code, 400)
        self.assertEqual(self.client.post("/api/auth/login/", {"email": "person@example.com", "password": "wrong"}).status_code, 400)
        response = self.client.post("/api/auth/login/", {"email": "PERSON@example.com", "password": "A-fairly-strong-372-password"})
        self.assertEqual(response.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {response.data['token']}")
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 200)
        self.assertEqual(self.client.post("/api/auth/logout/").status_code, 204)
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)

    def test_weak_password_rejected(self):
        response = self.client.post("/api/auth/register/", {"email": "p@example.com", "password": "12345678"})
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.exists())

    def test_account_delete_requires_password_and_removes_private_data(self):
        user = User.objects.create_user("p@example.com", "strong-password")
        product = Product.objects.create(url=URL, store="hepsiburada")
        Watch.objects.create(user=user, product=product)
        token = Token.objects.create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        self.assertEqual(self.client.delete("/api/auth/me/", {"password": "wrong"}, format="json").status_code, 400)
        self.assertEqual(self.client.delete("/api/auth/me/", {"password": "strong-password"}, format="json").status_code, 204)
        self.assertFalse(User.objects.exists())
        self.assertFalse(Watch.objects.exists())
        self.assertFalse(Token.objects.exists())
        self.assertTrue(Product.objects.exists())

    def test_login_throttle(self):
        for _ in range(20):
            self.client.post("/api/auth/login/", {"email": "p@example.com", "password": "wrong"})
        self.assertEqual(self.client.post("/api/auth/login/", {"email": "p@example.com", "password": "wrong"}).status_code, 429)

    def test_signup_watch_worker_history_and_discount_alert_flow(self):
        registered = self.client.post("/api/auth/register/", {
            "email": "flow@example.com", "password": "A-fairly-strong-372-password",
        })
        self.assertEqual(registered.status_code, 201)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {registered.data['token']}")
        saved = self.client.post("/api/watches/", {"url": URL, "target_price": "90.00"})
        self.assertEqual(saved.status_code, 201)
        self.assertTrue(saved.data["alerts_enabled"])
        watch_id = saved.data["id"]
        output = StringIO()
        with patch("pricing.services.scrape_product", return_value=PriceResult("Bedding", "", Decimal("100"), "TRY", "in_stock")):
            call_command("check_prices", stdout=output)
        self.assertEqual(self.client.get("/api/alerts/").data["count"], 0)
        Product.objects.update(next_check_at=timezone.now())
        with patch("pricing.services.scrape_product", return_value=PriceResult("Bedding", "", Decimal("80"), "TRY", "in_stock")):
            call_command("check_prices", stdout=output)
        current = self.client.get(f"/api/watches/{watch_id}/")
        self.assertEqual(current.data["product"]["current_price"], "80.00")
        self.assertEqual(self.client.get(f"/api/watches/{watch_id}/history/").data["count"], 2)
        alerts = self.client.get("/api/alerts/").data
        self.assertEqual(alerts["count"], 1)
        self.assertEqual(alerts["results"][0]["previous_price"], "100.00")
        self.assertEqual(alerts["results"][0]["price"], "80.00")


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class WatchAPITests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user("owner@example.com", "test-password")
        self.other = User.objects.create_user("other@example.com", "test-password")
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

    def test_watch_requires_authentication(self):
        self.client.credentials()
        self.assertEqual(self.client.get("/api/watches/").status_code, 401)
        self.assertEqual(self.client.post("/api/watches/", {"url": URL}).status_code, 401)

    @patch("pricing.scrapers.fetch_html")
    def test_save_deduplicates_product_and_does_not_fetch_in_request(self, fetch):
        response = self.client.post("/api/watches/", {"url": URL + "?utm_source=foo", "target_price": "1200.00"})
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["product"]["status"], "pending")
        self.assertEqual(response.data["product"]["url"], URL)
        self.assertEqual(self.client.post("/api/watches/", {"url": URL}).status_code, 400)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.post("/api/watches/", {"url": URL}).status_code, 201)
        self.assertEqual(Product.objects.count(), 1)
        self.assertEqual(Watch.objects.count(), 2)
        fetch.assert_not_called()

    def test_other_users_watch_history_refresh_and_alert_are_private(self):
        product = Product.objects.create(url=URL, store="hepsiburada")
        watch = Watch.objects.create(user=self.other, product=product)
        observation = PriceObservation.objects.create(product=product, price=80, currency="TRY", availability="in_stock")
        alert = PriceAlert.objects.create(watch=watch, observation=observation, previous_price=100, price=80, currency="TRY")
        self.assertEqual(self.client.get("/api/watches/").data["count"], 0)
        self.assertEqual(self.client.get("/api/alerts/").data["count"], 0)
        for suffix in ("", "history/"):
            self.assertEqual(self.client.get(f"/api/watches/{watch.pk}/{suffix}").status_code, 404)
        self.assertEqual(self.client.patch(f"/api/watches/{watch.pk}/", {"alerts_enabled": False}).status_code, 404)
        self.assertEqual(self.client.delete(f"/api/watches/{watch.pk}/").status_code, 404)
        self.assertEqual(self.client.post(f"/api/watches/{watch.pk}/refresh/").status_code, 404)
        self.assertEqual(self.client.post(f"/api/alerts/{alert.pk}/mark-read/").status_code, 404)

    def test_invalid_urls_and_targets_rejected_before_product_creation(self):
        for data in ({"url": "https://localhost/a-p-1"}, {"url": URL + "?merchantId=123"},
                     {"url": URL, "target_price": "0"}, {"url": URL, "target_price": "-1"}):
            with self.subTest(data=data):
                self.assertEqual(self.client.post("/api/watches/", data).status_code, 400)
        self.assertFalse(Product.objects.exists())

    def test_patch_preferences_history_and_delete(self):
        product = Product.objects.create(url=URL, store="hepsiburada")
        watch = Watch.objects.create(user=self.user, product=product)
        response = self.client.patch(f"/api/watches/{watch.pk}/", {"target_price": "50", "alerts_enabled": False})
        self.assertEqual(response.status_code, 200)
        watch.refresh_from_db()
        self.assertEqual(watch.target_price, Decimal("50"))
        self.assertFalse(watch.alerts_enabled)
        PriceObservation.objects.create(product=product, price=100, currency="TRY", availability="in_stock")
        self.assertEqual(self.client.get(f"/api/watches/{watch.pk}/history/").data["count"], 1)
        self.assertEqual(self.client.delete(f"/api/watches/{watch.pk}/").status_code, 204)
        self.assertTrue(Product.objects.exists())

    def test_refresh_queues_and_enforces_shared_cooldown(self):
        product = Product.objects.create(url=URL, store="hepsiburada", next_check_at=timezone.now() + timedelta(hours=1))
        watch = Watch.objects.create(user=self.user, product=product)
        self.assertEqual(self.client.post(f"/api/watches/{watch.pk}/refresh/").status_code, 202)
        product.refresh_from_db()
        self.assertLessEqual(product.next_check_at, timezone.now())
        product.last_attempted_at = timezone.now()
        product.save()
        self.assertEqual(self.client.post(f"/api/watches/{watch.pk}/refresh/").status_code, 429)

    def test_mark_alert_read(self):
        product = Product.objects.create(url=URL, store="hepsiburada")
        watch = Watch.objects.create(user=self.user, product=product)
        observation = PriceObservation.objects.create(product=product, price=80, currency="TRY", availability="in_stock")
        alert = PriceAlert.objects.create(watch=watch, observation=observation, previous_price=100, price=80, currency="TRY")
        response = self.client.post(f"/api/alerts/{alert.pk}/mark-read/")
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.data["read_at"])
