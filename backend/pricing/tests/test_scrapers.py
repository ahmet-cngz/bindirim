import json
import socket
from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from pricing.scrapers import (
    HepsiburadaAdapter,
    PriceCheckError,
    TrendyolAdapter,
    _validate_destination,
    canonicalize_url,
    fetch_html,
    parse_price,
    scrape_product,
)

TRENDYOL_URL = "https://www.trendyol.com/brand/shirt-p-31341390"
HEPSI_URL = "https://www.hepsiburada.com/bedding-p-HBCV0000777WJ6"


def product_html(price="2351.77", availability="InStock", **offer_fields):
    offer = {
        "@type": "Offer",
        "price": price,
        "priceCurrency": "TRY",
        "availability": f"https://schema.org/{availability}",
        "seller": {"name": "Chakra"},
    }
    offer.update(offer_fields)
    node = {
        "@context": "https://schema.org",
        "@type": "Product",
        "sku": "HBCV0000777WJ6",
        "name": "Bedding",
        "image": ["https://example.com/image.jpg"],
        "offers": offer,
    }
    return f'<script type="application/ld+json">{json.dumps(node)}</script>'


def trendyol_html(price=1299, item=123):
    node = {
        "product": {
            "id": 31341390,
            "name": "Shirt",
            "inStock": True,
            "images": ["https://example.com/shirt.jpg"],
            "merchantListing": {
                "merchant": {"id": 159, "name": "DS DAMAT"},
                "winnerVariant": {
                    "itemNumber": item,
                    "inStock": True,
                    "sellable": True,
                    "variantAttributes": [{"attributeValue": "M"}],
                    "price": {
                        "currency": "TRY",
                        "sellingPrice": {"value": price},
                        "discountedPrice": {"value": 1104.15},
                        "tyPlusCouponApplicablePrice": {"value": 883.32},
                    },
                },
            },
        }
    }
    return (
        f'<script>window["__envoy__SHARED_PROPS"]={json.dumps(node)}; '
        "window.unrelated=true;</script>"
    )


class ParserTests(SimpleTestCase):
    def test_hepsiburada_single_offer(self):
        result = HepsiburadaAdapter().parse(product_html())
        self.assertEqual(result.price, Decimal("2351.77"))
        self.assertEqual(result.availability, "in_stock")
        self.assertEqual(result.offer_label, "Chakra")

    def test_trendyol_uses_public_price_and_identifies_variant(self):
        result = TrendyolAdapter().parse(trendyol_html())
        self.assertEqual(result.price, Decimal("1299.00"))
        self.assertEqual(result.offer_label, "DS DAMAT · M")
        self.assertNotEqual(
            result.offer_key,
            TrendyolAdapter().parse(trendyol_html(item=456)).offer_key,
        )

    def test_out_of_stock_is_not_a_zero_price(self):
        result = HepsiburadaAdapter().parse(
            product_html(price="0", availability="OutOfStock")
        )
        self.assertIsNone(result.price)
        self.assertEqual(result.availability, "out_of_stock")

    def test_aggregate_offer_is_not_a_real_price(self):
        with self.assertRaises(PriceCheckError):
            HepsiburadaAdapter().parse(
                product_html(**{"@type": "AggregateOffer", "lowPrice": "50"})
            )

    def test_multiple_offers_fail(self):
        html = (
            '<script type="application/ld+json">'
            + json.dumps(
                {
                    "@type": "Product",
                    "offers": [{"price": "10"}, {"price": "20"}],
                }
            )
            + "</script>"
        )
        with self.assertRaises(PriceCheckError):
            HepsiburadaAdapter().parse(html)

    def test_multiple_products_fail(self):
        with self.assertRaises(PriceCheckError):
            HepsiburadaAdapter().parse(product_html() + product_html("1"))

    def test_jsonld_graph(self):
        node = json.loads(
            product_html().split(">", 1)[1].split("</script>")[0]
        )
        html = f'<script type="application/ld+json">{
            json.dumps({("@graph"): [node]})
        }</script>'
        self.assertEqual(
            HepsiburadaAdapter().parse(html).price, Decimal("2351.77")
        )

    def test_block_page_and_wrong_currency_fail(self):
        for html in (
            "<html>Please verify you are human</html>",
            product_html(priceCurrency="USD"),
        ):
            with self.subTest(html=html), self.assertRaises(PriceCheckError):
                HepsiburadaAdapter().parse(html)

    def test_localized_prices_are_decimal_and_invalid_prices_fail(self):
        for raw in ("1234.56", "1.234,56", "1,234.56", "1234,56"):
            self.assertEqual(parse_price(raw), Decimal("1234.56"))
        for raw in (
            "0",
            "-1",
            "NaN",
            "1.234",
            "1,234",
            "1e3",
            True,
            None,
            "1,2,3",
            "12.34,56",
            "9" * 40,
        ):
            with self.subTest(raw=raw), self.assertRaises(PriceCheckError):
                parse_price(raw)


class FetchSafetyTests(SimpleTestCase):
    def test_normalizes_only_tracking_parameters(self):
        url, store = canonicalize_url(
            TRENDYOL_URL.replace("www.", "") + "/?utm_source=test#details"
        )
        self.assertEqual(url, TRENDYOL_URL)
        self.assertEqual(store, "trendyol")

    def test_rejects_untrusted_urls(self):
        for url in (
            "http://www.trendyol.com/a-p-1",
            "https://localhost/a-p-1",
            "https://www.trendyol.com.evil.com/a-p-1",
            "https://user@www.trendyol.com/a-p-1",
            "https://www.trendyol.com:444/a-p-1",
            "https://www.trendyol.com/search",
            "https://127.0.0.1/a-p-1",
            "https://www.trendyol.com/a-p-1\n",
        ):
            with self.subTest(url=url), self.assertRaises(PriceCheckError):
                canonicalize_url(url)

    @patch("pricing.scrapers.fetch_html")
    def test_query_variants_not_silently_ignored(self, fetch):
        with self.assertRaises(PriceCheckError):
            scrape_product(TRENDYOL_URL + "?merchantId=123")
        fetch.assert_not_called()

    @patch(
        "pricing.scrapers.socket.getaddrinfo",
        return_value=[
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 443))
        ],
    )
    def test_private_dns_is_rejected(self, resolver):
        with self.assertRaises(PriceCheckError):
            _validate_destination(TRENDYOL_URL)

    @patch("pricing.scrapers._validate_destination")
    @patch("pricing.scrapers.requests.Session")
    def test_redirect_to_private_host_never_fetched(
        self, session_class, validate
    ):
        response = MagicMock()
        response.status_code = 302
        response.headers = {"Location": "https://127.0.0.1/a-p-1"}
        session = session_class.return_value.__enter__.return_value
        session.get.return_value.__enter__.return_value = response
        # Keep actual URL validation while avoiding public DNS calls.
        validate.side_effect = lambda url: canonicalize_url(url)
        with self.assertRaises(PriceCheckError):
            fetch_html(TRENDYOL_URL)
        self.assertEqual(session.get.call_count, 1)

    @patch("pricing.scrapers._validate_destination")
    @patch("pricing.scrapers.requests.Session")
    def test_size_and_http_errors(self, session_class, validate):
        session = session_class.return_value.__enter__.return_value
        response = session.get.return_value.__enter__.return_value
        response.status_code = 403
        with self.assertRaisesMessage(PriceCheckError, "HTTP 403"):
            fetch_html(TRENDYOL_URL)
        response.status_code = 200
        response.headers = {"Content-Type": "text/html"}
        response.iter_content.return_value = [b"12345"]
        with (
            patch("pricing.scrapers.MAX_BODY_BYTES", 4),
            self.assertRaisesMessage(PriceCheckError, "size limit"),
        ):
            fetch_html(TRENDYOL_URL)
