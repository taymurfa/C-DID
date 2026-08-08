"""SerpAPI / DuckDuckGo structured search for marketplace and dealer listings."""

from __future__ import annotations

import os
from typing import Any

import requests

from app.vehicle.extractors import parse_listing_from_serp
from app.vehicle.filters import build_search_queries, matches_tundra_aliases
from app.vehicle.models import VehicleListing
from app.vehicle.scrapers.base import BaseScraper, ScrapeContext


def _serpapi_organic(query: str, max_results: int = 10) -> list[dict[str, Any]]:
    api_key = os.getenv("SERPAPI_API_KEY") or os.getenv("SerpAPI")
    if not api_key or not str(api_key).strip():
        return _ddg_results(query, max_results)
    try:
        resp = requests.get(
            "https://serpapi.com/search",
            params={
                "engine": "google",
                "q": query.strip(),
                "api_key": api_key.strip(),
                "num": min(max_results, 20),
            },
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
        return [
            {
                "title": (r.get("title") or "").strip(),
                "link": (r.get("link") or "").strip(),
                "snippet": (r.get("snippet") or "").strip(),
            }
            for r in (data.get("organic_results") or [])[:max_results]
        ]
    except Exception:
        return _ddg_results(query, max_results)


def _ddg_results(query: str, max_results: int) -> list[dict[str, Any]]:
    try:
        from ddgs import DDGS

        rows = list(DDGS().text(query.strip(), max_results=max_results))
        return [
            {
                "title": (r.get("title") or "").strip(),
                "link": (r.get("href") or "").strip(),
                "snippet": (r.get("body") or "").strip(),
            }
            for r in rows
        ]
    except Exception:
        return []


class SerpMarketplaceScraper(BaseScraper):
    """Search via Google/Serp using site: filters for aggregators and marketplaces."""

    def __init__(self, source_id: str, source_label: str, site: str):
        self.source_id = source_id
        self.source_label = source_label
        self.site = site

    def scrape(self, ctx: ScrapeContext) -> list[VehicleListing]:
        out: list[VehicleListing] = []
        queries = build_search_queries(
            site_filter=self.site,
            year_min=ctx.year_min,
            year_max=ctx.year_max,
        )
        seen_urls: set[str] = set()
        for q in queries[:3]:
            for row in _serpapi_organic(q, ctx.max_results_per_source):
                url = row.get("link") or ""
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)
                title = row.get("title") or ""
                if ctx.require_crew_cab and not matches_tundra_aliases(title, require_crew_cab=True):
                    if "tundra" not in title.lower():
                        continue
                listing = parse_listing_from_serp(
                    title=title,
                    url=url,
                    snippet=row.get("snippet") or "",
                    source_id=self.source_id,
                    source_label=self.source_label,
                )
                if not listing:
                    continue
                if listing.price and listing.price > ctx.max_price:
                    continue
                if listing.mileage and listing.mileage > ctx.max_mileage:
                    continue
                if listing.year and (listing.year < ctx.year_min or listing.year > ctx.year_max):
                    continue
                out.append(listing)
        return out


class ToyotaCertifiedScraper(BaseScraper):
    source_id = "toyota_certified"
    source_label = "Toyota Certified Used"

    def scrape(self, ctx: ScrapeContext) -> list[VehicleListing]:
        out: list[VehicleListing] = []
        queries = [
            f"Toyota Tundra CrewMax site:toyota.com certified used {ctx.year_min}..{ctx.year_max}",
            f"Toyota Certified Used Tundra 5.7 site:toyotacertified.com",
        ]
        seen: set[str] = set()
        for q in queries:
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
                    listing.certified = True
                    out.append(listing)
        return out


class GoogleDealerIndexScraper(BaseScraper):
    source_id = "google_dealer_index"
    source_label = "Google Indexed Dealer Pages"

    def scrape(self, ctx: ScrapeContext) -> list[VehicleListing]:
        out: list[VehicleListing] = []
        queries = [
            f'Toyota Tundra CrewMax 4x4 inventory {ctx.year_min}..{ctx.year_max}',
            "Toyota Tundra SR5 5.7 used truck dealer inventory",
        ]
        seen: set[str] = set()
        for q in queries:
            for row in _serpapi_organic(q, ctx.max_results_per_source):
                url = row.get("link") or ""
                if not url or url in seen:
                    continue
                if any(
                    blocked in url
                    for blocked in ("facebook.com", "youtube.com", "wikipedia.org", "reddit.com")
                ):
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
                    out.append(listing)
        return out
