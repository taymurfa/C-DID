"""Base scraper interface."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.vehicle.models import VehicleListing


@dataclass
class ScrapeContext:
    year_min: int = 2012
    year_max: int = 2021
    max_price: int = 45000
    max_mileage: int = 75000
    require_crew_cab: bool = True
    max_results_per_source: int = 12
    dealer_mode: bool = True
    craigslist_territories: list[str] | None = None


class BaseScraper(ABC):
    source_id: str
    source_label: str

    @abstractmethod
    def scrape(self, ctx: ScrapeContext) -> list[VehicleListing]:
        pass
