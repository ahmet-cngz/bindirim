"""Conservative public-page adapters.

Ambiguous offers fail instead of guessing a price.
"""

import hashlib
import ipaddress
import json
import re
import socket
import time
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit

import requests
from bs4 import BeautifulSoup


class PriceCheckError(Exception):
    """A safe message that can be exposed to the product's watchers."""


HOSTS = {
    "trendyol.com": "trendyol",
    "www.trendyol.com": "trendyol",
    "hepsiburada.com": "hepsiburada",
    "www.hepsiburada.com": "hepsiburada",
}
MAX_BODY_BYTES = 5 * 1024 * 1024


def canonicalize_url(raw_url):
    try:
        parts = urlsplit(raw_url.strip())
        host = parts.hostname
        if (
            parts.scheme != "https"
            or host not in HOSTS
            or parts.username
            or parts.password
            or parts.port not in (None, 443)
        ):
            raise ValueError
        if len(raw_url) > 2048 or any(
            c.isspace() or ord(c) < 32 for c in raw_url
        ):
            raise ValueError
    except (ValueError, AttributeError):
        raise PriceCheckError(
            "Use an HTTPS product URL from Trendyol or Hepsiburada."
        ) from None
    store = HOSTS[host]
    if store == "trendyol":
        is_product = re.search(r"-p-\d+/?$", parts.path)
    else:
        is_product = re.search(r"-p-[A-Za-z0-9]+/?$", parts.path)
    if not is_product:
        raise PriceCheckError("This URL is not a supported product page.")
    # Preserve offer/variant parameters; remove only known analytics
    # parameters.
    query = [
        (k, v)
        for k, v in parse_qsl(parts.query, keep_blank_values=True)
        if not k.lower().startswith("utm_")
        and k.lower() not in {"gclid", "fbclid"}
    ]
    url = urlunsplit(
        (
            "https",
            f"www.{store}.com",
            parts.path.rstrip("/"),
            urlencode(sorted(query)),
            "",
        )
    )
    if len(url) > 2048:
        raise PriceCheckError("Product URL is too long.")
    return url, store


def _validate_destination(url):
    # Both an exact host allowlist and public DNS checks are intentional. Never
    # expand this to arbitrary user-provided domains without a pinned-IP
    # transport.
    parts = urlsplit(url)
    canonicalize_url(url)
    try:
        addresses = socket.getaddrinfo(
            parts.hostname, 443, type=socket.SOCK_STREAM
        )
    except OSError as exc:
        raise PriceCheckError("Store DNS lookup failed.") from exc
    if not addresses or any(
        not ipaddress.ip_address(entry[4][0]).is_global for entry in addresses
    ):
        raise PriceCheckError("Store resolved to a non-public address.")


def fetch_html(url):
    original_store = canonicalize_url(url)[1]
    deadline = time.monotonic() + 40
    try:
        with requests.Session() as session:
            session.trust_env = False
            session.headers.update(
                {
                    "User-Agent": "BindirimPriceTracker/0.1",
                    "Accept": "text/html",
                    "Accept-Language": "tr-TR,tr;q=0.9",
                }
            )
            for _ in range(4):
                _validate_destination(url)
                if canonicalize_url(url)[1] != original_store:
                    raise PriceCheckError(
                        "Store redirected to a different retailer."
                    )
                if time.monotonic() > deadline:
                    raise PriceCheckError("Store request timed out.")
                with session.get(
                    url, timeout=(5, 10), allow_redirects=False, stream=True
                ) as response:
                    if response.status_code in {301, 302, 303, 307, 308}:
                        location = response.headers.get("Location")
                        if not location:
                            raise PriceCheckError(
                                "Store returned an invalid redirect."
                            )
                        url = urljoin(url, location)
                        continue
                    if response.status_code != 200:
                        raise PriceCheckError(
                            f"Store returned HTTP {response.status_code}."
                        )
                    if (
                        "text/html"
                        not in response.headers.get("Content-Type", "").lower()
                    ):
                        raise PriceCheckError(
                            "Store did not return an HTML product page."
                        )
                    body = bytearray()
                    for chunk in response.iter_content(chunk_size=65536):
                        body.extend(chunk)
                        if len(body) > MAX_BODY_BYTES:
                            raise PriceCheckError(
                                "Product page exceeded the size limit."
                            )
                        if time.monotonic() > deadline:
                            raise PriceCheckError("Store request timed out.")
                    return bytes(body).decode("utf-8", errors="replace")
    except requests.RequestException as exc:
        raise PriceCheckError(
            (
                "Could not fetch the store page; it may be "
                "unavailable or blocking automated access."
            )
        ) from exc
    raise PriceCheckError("Store returned too many redirects.")


@dataclass(frozen=True)
class PriceResult:
    title: str
    image_url: str
    price: Decimal | None
    currency: str
    availability: str
    offer_key: str = ""
    offer_label: str = ""


def _offer_key(*parts):
    return hashlib.sha256(
        json.dumps(parts, sort_keys=True).encode()
    ).hexdigest()


def parse_price(value):
    if isinstance(value, bool) or value is None:
        raise PriceCheckError("Store returned an invalid price.")
    raw = str(value).strip().replace("\u00a0", "").replace(" ", "")
    # JSON numbers use a dot; localized strings may use 1.234,56 or 1,234.56.
    if not re.fullmatch(r"\d+(?:[.,]\d+)*", raw):
        raise PriceCheckError("Store returned an invalid price.")
    if "," in raw and "." in raw:
        if raw.rfind(",") > raw.rfind("."):
            if not re.fullmatch(r"\d{1,3}(?:\.\d{3})*,\d{1,2}", raw):
                raise PriceCheckError("Store returned an ambiguous price.")
            raw = raw.replace(".", "").replace(",", ".")
        else:
            if not re.fullmatch(r"\d{1,3}(?:,\d{3})*\.\d{1,2}", raw):
                raise PriceCheckError("Store returned an ambiguous price.")
            raw = raw.replace(",", "")
    elif "," in raw:
        raw = raw.replace(",", ".")
    try:
        price = Decimal(raw)
        if (
            not price.is_finite()
            or price <= 0
            or price > Decimal("9999999999.99")
            or price != price.quantize(Decimal("0.01"))
        ):
            raise InvalidOperation
        return price.quantize(Decimal("0.01"))
    except InvalidOperation as exc:
        raise PriceCheckError(
            "Store returned an invalid or ambiguous price."
        ) from exc


def _has_type(node, name):
    types = node.get("@type", [])
    return name in (types if isinstance(types, list) else [types])


def _products(node):
    # Do not traverse recommendations or ItemLists and mistake them for the
    # product.
    if isinstance(node, list):
        for child in node:
            yield from _products(child)
    elif isinstance(node, dict):
        if _has_type(node, "Product"):
            yield node
        for key in ("@graph", "mainEntity"):
            if key in node:
                yield from _products(node[key])


def _availability(value):
    name = str(value or "").rstrip("/").split("/")[-1]
    if name == "InStock":
        return "in_stock"
    if name in {"OutOfStock", "SoldOut", "Discontinued"}:
        return "out_of_stock"
    if name in {"PreOrder", "PreSale", "BackOrder"}:
        return "unavailable"
    return "unknown"


def _safe_image(value):
    if isinstance(value, list):
        value = value[0] if value else ""
    if isinstance(value, dict):
        value = value.get("url", "")
    if (
        not isinstance(value, str)
        or len(value) > 2048
        or urlsplit(value).scheme != "https"
    ):
        return ""
    return value


class StructuredDataAdapter:
    def parse(self, html):
        soup = BeautifulSoup(html, "html.parser")
        products = []
        for script in soup.find_all(
            "script", attrs={"type": "application/ld+json"}
        ):
            try:
                products.extend(_products(json.loads(script.get_text())))
            except (ValueError, RecursionError):
                continue
        if len(products) > 1:
            raise PriceCheckError(
                (
                    "Page contains multiple products; variant "
                    "selection is not supported yet."
                )
            )
        if products:
            product = products[0]
            offers = product.get("offers")
            if isinstance(offers, list):
                if len(offers) != 1:
                    raise PriceCheckError(
                        "Page contains multiple offers; "
                        "seller/variant selection is not supported yet."
                    )
                offers = offers[0]
            if not isinstance(offers, dict) or _has_type(
                offers, "AggregateOffer"
            ):
                raise PriceCheckError(
                    "Page does not expose a single product offer."
                )
            currency = str(offers.get("priceCurrency", "")).upper()
            availability = _availability(offers.get("availability"))
            price = offers.get("price")
            title = str(product.get("name", ""))[:500]
            image = _safe_image(product.get("image", ""))
            seller = offers.get("seller", {})
            seller = (
                seller.get("name", "")
                if isinstance(seller, dict)
                else str(seller)
            )
            offer_key = _offer_key(
                product.get("sku", ""), product.get("productID", ""), seller
            )
            offer_label = str(seller)[:300]
        else:
            # Explicit product price metadata only, never arbitrary visible
            # numbers.
            def meta(name):
                tag = soup.find("meta", attrs={"property": name})
                return tag.get("content", "") if tag else ""

            price = meta("product:price:amount")
            currency = meta("product:price:currency").upper()
            availability = "unknown"
            title = meta("og:title")[:500]
            image = _safe_image(meta("og:image"))
            offer_key = ""
            offer_label = "Public page price"
        if currency != "TRY":
            raise PriceCheckError(
                "A reliable TRY price was not found on this page."
            )
        if availability in {"out_of_stock", "unavailable"}:
            return PriceResult(
                title,
                image,
                None,
                currency,
                availability,
                offer_key,
                offer_label,
            )
        return PriceResult(
            title,
            image,
            parse_price(price),
            currency,
            availability,
            offer_key,
            offer_label,
        )


class TrendyolAdapter(StructuredDataAdapter):
    def parse(self, html):
        # Current Trendyol pages expose a JSON assignment rather than JSON-LD.
        # Decode only the JSON value; never execute the surrounding JavaScript.
        marker = re.compile(r'window\["__envoy__SHARED_PROPS"\]\s*=\s*')
        for script in BeautifulSoup(html, "html.parser").find_all("script"):
            text = script.get_text()
            match = marker.search(text)
            if not match:
                continue
            try:
                data, _ = json.JSONDecoder().raw_decode(text[match.end() :])
                product = data["product"]
                listing = product["merchantListing"]
                winner = listing["winnerVariant"]
                price_data = winner["price"]
                currency = price_data["currency"]
                if currency != "TRY":
                    raise PriceCheckError(
                        "A reliable TRY price was not found on this page."
                    )
                # sellingPrice is the public listing price before basket/member
                # promotions; tyPlus and coupon prices are intentionally
                # excluded.
                price = parse_price(price_data["sellingPrice"]["value"])
                merchant = listing["merchant"]
                key = _offer_key(
                    product["id"], merchant["id"], winner["itemNumber"]
                )
                labels = [str(merchant.get("name", ""))]
                labels.extend(
                    str(a.get("attributeValue", ""))
                    for a in winner.get("variantAttributes", [])
                )
                available = (
                    product.get("inStock") is True
                    and winner.get("inStock") is True
                    and winner.get("sellable") is True
                )
                return PriceResult(
                    str(product["name"])[:500],
                    _safe_image(product.get("images", [])),
                    price if available else None,
                    currency,
                    "in_stock" if available else "out_of_stock",
                    key,
                    " · ".join(labels)[:300],
                )
            except (KeyError, TypeError, ValueError, RecursionError) as exc:
                raise PriceCheckError(
                    (
                        "Trendyol page data changed or is incomplete; "
                        "tracker needs an update."
                    )
                ) from exc
        return super().parse(html)


class HepsiburadaAdapter(StructuredDataAdapter):
    pass


ADAPTERS = {"trendyol": TrendyolAdapter(), "hepsiburada": HepsiburadaAdapter()}


def scrape_product(url):
    canonical, store = canonicalize_url(url)
    # Query-selected variants cannot safely be matched against generic page
    # data.
    if urlsplit(canonical).query:
        raise PriceCheckError(
            (
                "Seller/variant URL parameters are not "
                "supported yet; use the base product URL."
            )
        )
    return ADAPTERS[store].parse(fetch_html(canonical))
