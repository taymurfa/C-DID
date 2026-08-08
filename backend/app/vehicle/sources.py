"""Inventory source registry — API, browser, aggregator, disabled."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

SourceMode = Literal["api", "browser", "aggregator", "dealer", "disabled"]


@dataclass(frozen=True)
class InventorySource:
    id: str
    label: str
    mode: SourceMode
    enabled: bool = True
    priority: int = 50
    notes: str = ""


# Existing base + expanded sources (user spec §1, §10).
INVENTORY_SOURCES: tuple[InventorySource, ...] = (
    # MCP/API-like
    InventorySource("cars_com", "Cars.com", "api", True, 80),
    InventorySource("autotrader", "Autotrader", "api", True, 80),
    InventorySource("kbb", "KBB", "api", True, 75),
    # Browser / Puppeteer-class (Serp + direct fetch until Playwright wired)
    InventorySource("craigslist", "Craigslist", "browser", True, 70),
    InventorySource("dealer_website", "Dealer Website", "dealer", True, 95),
    InventorySource("toyota_certified", "Toyota Certified Used", "dealer", True, 98),
    InventorySource("local_toyota_dealer", "Local Toyota Dealer", "dealer", True, 97),
    InventorySource("google_dealer_index", "Google Indexed Dealer Pages", "dealer", True, 90),
    InventorySource("truecar", "TrueCar", "browser", True, 65),
    InventorySource("edmunds", "Edmunds", "browser", True, 60),
    InventorySource("carsoup", "CarSoup", "browser", True, 55),
    # Aggregators
    InventorySource("autotempest", "AutoTempest", "aggregator", True, 85),
    InventorySource("cargurus", "CarGurus", "aggregator", True, 82),
    InventorySource("carvana", "Carvana", "aggregator", True, 70),
    InventorySource("carsdirect", "CarsDirect", "aggregator", True, 68),
    InventorySource("autonation", "AutoNation", "dealer", True, 88),
    InventorySource("lithia", "Lithia", "dealer", True, 86),
    InventorySource("sonic_echopark", "Sonic / EchoPark", "dealer", True, 84),
    InventorySource("enterprise_car_sales", "Enterprise Car Sales", "dealer", True, 72),
    InventorySource("hertz_car_sales", "Hertz Car Sales", "dealer", True, 70),
    InventorySource("driveway", "Driveway", "aggregator", True, 65),
    InventorySource("vroom", "Vroom / Online Retail", "aggregator", False, 40, "Disabled if inactive in region"),
    InventorySource("facebook_marketplace", "Facebook Marketplace", "disabled", False, 0, "Disabled per policy"),
)

SOURCE_BY_ID = {s.id: s for s in INVENTORY_SOURCES}


def enabled_sources(source_ids: list[str] | None = None) -> list[InventorySource]:
    if source_ids:
        return [SOURCE_BY_ID[sid] for sid in source_ids if sid in SOURCE_BY_ID and SOURCE_BY_ID[sid].enabled]
    return [s for s in INVENTORY_SOURCES if s.enabled]


def sources_by_mode() -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {"api": [], "browser": [], "aggregator": [], "dealer": [], "disabled": []}
    for s in INVENTORY_SOURCES:
        out[s.mode].append(
            {
                "id": s.id,
                "label": s.label,
                "enabled": s.enabled,
                "priority": s.priority,
                "notes": s.notes,
            }
        )
    return out
