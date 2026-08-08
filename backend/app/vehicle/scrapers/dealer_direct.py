"""Direct dealer page fetch + JSON-LD enrichment."""

from __future__ import annotations

import re

import requests

from app.vehicle.extractors import enrich_from_html, parse_listing_from_serp
from app.vehicle.models import VehicleListing
from app.vehicle.scrapers.base import BaseScraper, ScrapeContext
from app.vehicle.scrapers.serp import _serpapi_organic

_DEALER_INVENTORY_HINT = re.compile(r"/(inventory|vehicle|used|detail|vdp|stock)", re.I)
_USER_AGENT = (
    "Mozilla/5.0 (compatible; VehicleSearchBot/1.0; +https://localhost) "
    "AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
)


def fetch_dealer_page(url: str, timeout: int = 12) -> str | None:
    try:
        resp = requests.get(
            url,
            timeout=timeout,
            headers={"User-Agent": _USER_AGENT, "Accept": "text/html"},
        )
        if resp.status_code >= 400:
            return None
        return resp.text
    except Exception:
        return None


class DealerDirectScraper(BaseScraper):
    """Find dealer inventory URLs via search, then fetch pages for VIN/price/mileage."""

    source_id = "dealer_website"
    source_label = "Dealer Website"

    def scrape(self, ctx: ScrapeContext) -> list[VehicleListing]:
        if not ctx.dealer_mode:
            return []

        out: list[VehicleListing] = []
        queries = [
            f"Toyota Tundra CrewMax used site:autonation.com {ctx.year_min}..{ctx.year_max}",
            f"Toyota Tundra CrewMax used site:lithia.com",
            f"Toyota Tundra 5.7 used inventory dealer",
            f"Toyota Tundra CrewMax Legends Toyota OR Toyota dealer inventory",
        ]
        candidate_urls: list[tuple[str, str, str]] = []
        seen: set[str] = set()

        for q in queries:
            for row in _serpapi_organic(q, max_results=8):
                url = row.get("link") or ""
                if not url or url in seen:
                    continue
                if not _DEALER_INVENTORY_HINT.search(url) and "toyota" not in url.lower():
                    continue
                seen.add(url)
                candidate_urls.append((url, row.get("title") or "", row.get("snippet") or ""))

        for url, title, snippet in candidate_urls[: ctx.max_results_per_source]:
            listing = parse_listing_from_serp(
                title=title,
                url=url,
                snippet=snippet,
                source_id=self.source_id,
                source_label=self.source_label,
            )
            if not listing:
                continue
            html = fetch_dealer_page(url)
            if html:
                listing = enrich_from_html(html, listing)
            if listing.price and listing.price > ctx.max_price:
                continue
            if listing.mileage and listing.mileage > ctx.max_mileage:
                continue
            out.append(listing)
        return out


class DealerGroupScraper(BaseScraper):
    """Scrape large dealer group domains via site: search."""

    def __init__(self, source_id: str, source_label: str, domain: str):
        self.source_id = source_id
        self.source_label = source_label
        self.domain = domain

    def scrape(self, ctx: ScrapeContext) -> list[VehicleListing]:
        out: list[VehicleListing] = []
        q = f"Toyota Tundra CrewMax site:{self.domain} {ctx.year_min}..{ctx.year_max}"
        seen: set[str] = set()
        for row in _serpapi_organic(q, ctx.max_results_per_source):
            url = row.get("link") or ""
            if not url or url in seen:
                continue
            seen.add(url)
            listing = parse_listing_from_serp(
                title=row.get("title") or "",
                url=url,
                snippet=row.get("snippet") or "",
                source_id=self.source_id,
                source_label=self.source_label,
            )
            if listing:
                html = fetch_dealer_page(url)
                if html:
                    listing = enrich_from_html(html, listing)
                out.append(listing)
        return out
