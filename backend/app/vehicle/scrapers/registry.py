"""Scraper registry — maps source ids to adapter instances."""

from __future__ import annotations

from app.vehicle.scrapers.base import BaseScraper
from app.vehicle.scrapers.craigslist_regions import AutoTempestScraper, CraigslistRegionsScraper
from app.vehicle.scrapers.dealer_direct import DealerDirectScraper, DealerGroupScraper
from app.vehicle.scrapers.serp import GoogleDealerIndexScraper, SerpMarketplaceScraper, ToyotaCertifiedScraper

# site: filters for API-class marketplaces (Serp until official APIs wired).
_SITE_SCRAPERS: dict[str, str] = {
    "cars_com": "cars.com",
    "autotrader": "autotrader.com",
    "kbb": "kbb.com",
    "cargurus": "cargurus.com",
    "carvana": "carvana.com",
    "truecar": "truecar.com",
    "edmunds": "edmunds.com",
    "carsoup": "carsoup.com",
    "carsdirect": "carsdirect.com",
}

_DEALER_GROUP_SOURCES: dict[str, tuple[str, str]] = {
    "autonation": ("AutoNation", "autonation.com"),
    "lithia": ("Lithia", "lithia.com"),
    "sonic_echopark": ("Sonic / EchoPark", "echopark.com"),
    "enterprise_car_sales": ("Enterprise Car Sales", "enterprisecarsales.com"),
    "hertz_car_sales": ("Hertz Car Sales", "hertzcarsales.com"),
    "driveway": ("Driveway", "driveway.com"),
}


def get_scrapers(source_ids: list[str] | None = None) -> list[BaseScraper]:
    wanted = set(source_ids) if source_ids else None
    scrapers: list[BaseScraper] = []

    def add(scraper: BaseScraper) -> None:
        if wanted is None or scraper.source_id in wanted:
            scrapers.append(scraper)

    add(ToyotaCertifiedScraper())
    add(DealerDirectScraper())
    add(GoogleDealerIndexScraper())
    add(CraigslistRegionsScraper())
    add(AutoTempestScraper())

    for sid, site in _SITE_SCRAPERS.items():
        label = sid.replace("_", " ").title().replace(" Com", ".com").replace("Kbb", "KBB")
        if sid == "cars_com":
            label = "Cars.com"
        elif sid == "kbb":
            label = "KBB"
        add(SerpMarketplaceScraper(sid, label, site))

    for sid, (label, domain) in _DEALER_GROUP_SOURCES.items():
        add(DealerGroupScraper(sid, label, domain))

    # Local Toyota dealer pages — broad Google index
    if wanted is None or "local_toyota_dealer" in wanted:
        add(
            SerpMarketplaceScraper(
                "local_toyota_dealer",
                "Local Toyota Dealer",
                "toyota.com",
            )
        )

    return scrapers
