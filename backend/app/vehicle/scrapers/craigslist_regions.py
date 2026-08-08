"""Craigslist multi-region search via web index."""

from __future__ import annotations

from app.vehicle.extractors import parse_listing_from_serp
from app.vehicle.keywords import CRAIGSLIST_QUERY_TERMS, CRAIGSLIST_REGIONS
from app.vehicle.models import VehicleListing
from app.vehicle.scrapers.base import BaseScraper, ScrapeContext
from app.vehicle.scrapers.serp import _serpapi_organic


class CraigslistRegionsScraper(BaseScraper):
    source_id = "craigslist"
    source_label = "Craigslist"

    def scrape(self, ctx: ScrapeContext) -> list[VehicleListing]:
        territories = ctx.craigslist_territories or list(CRAIGSLIST_REGIONS.keys())
        out: list[VehicleListing] = []
        seen: set[str] = set()

        for territory in territories:
            regions = CRAIGSLIST_REGIONS.get(territory, [])
            for region in regions[:4]:
                site = region["site"]
                for term in CRAIGSLIST_QUERY_TERMS[:3]:
                    q = f'site:{site} "{term}" Toyota'
                    for row in _serpapi_organic(q, max_results=5):
                        url = row.get("link") or ""
                        if not url or url in seen or site not in url:
                            continue
                        seen.add(url)
                        listing = parse_listing_from_serp(
                            title=row.get("title") or "",
                            url=url,
                            snippet=row.get("snippet") or "",
                            source_id=self.source_id,
                            source_label=f"Craigslist ({region['label']})",
                        )
                        if not listing:
                            continue
                        listing.city = region.get("label")
                        if listing.price and listing.price > ctx.max_price:
                            continue
                        if listing.mileage and listing.mileage > ctx.max_mileage:
                            continue
                        out.append(listing)
        return out


class AutoTempestScraper(BaseScraper):
    source_id = "autotempest"
    source_label = "AutoTempest"

    def scrape(self, ctx: ScrapeContext) -> list[VehicleListing]:
        out: list[VehicleListing] = []
        queries = [
            f"site:autotempest.com Toyota Tundra CrewMax {ctx.year_min}..{ctx.year_max}",
            f"site:autotempest.com Tundra 4x4 5.7",
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
                    out.append(listing)
        return out
