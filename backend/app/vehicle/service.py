"""Orchestrates multi-source scrape, dedupe, score, persist."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.vehicle.dedupe import dedupe_listings
from app.vehicle.filters import matches_negative_filter, matches_tundra_aliases
from app.vehicle.keywords import DEFAULT_TUNDRA_CRITERIA
from app.vehicle.models import VehicleListing
from app.vehicle.repository import get_listings, touch_saved_search, upsert_merged_listings
from app.vehicle.scoring import rank_listings
from app.vehicle.scrapers.base import ScrapeContext
from app.vehicle.scrapers.registry import get_scrapers
from app.vehicle.sources import enabled_sources, sources_by_mode


def run_vehicle_search(
    *,
    source_ids: list[str] | None = None,
    criteria: dict[str, Any] | None = None,
    search_id: str | None = None,
    persist: bool = True,
) -> dict[str, Any]:
    crit = {**DEFAULT_TUNDRA_CRITERIA, **(criteria or {})}
    ctx = ScrapeContext(
        year_min=int(crit.get("yearMin", 2012)),
        year_max=int(crit.get("yearMax", 2021)),
        max_price=int(crit.get("maxPrice", 45000)),
        max_mileage=int(crit.get("maxMileage", 75000)),
        require_crew_cab=bool(crit.get("requireCrewCab", True)),
        dealer_mode=bool(crit.get("dealerMode", True)),
        craigslist_territories=crit.get("craigslistTerritories"),
        max_results_per_source=int(crit.get("maxResultsPerSource", 10)),
    )

    enabled = enabled_sources(source_ids)
    scrapers = get_scrapers([s.id for s in enabled])

    raw: list[VehicleListing] = []
    source_stats: dict[str, int] = {}
    errors: list[str] = []

    for scraper in scrapers:
        try:
            batch = scraper.scrape(ctx)
            source_stats[scraper.source_id] = len(batch)
            raw.extend(batch)
        except Exception as e:
            errors.append(f"{scraper.source_id}: {e!s}")

    # Post-filter
    filtered: list[VehicleListing] = []
    for item in raw:
        blob = f"{item.title}\n{item.raw_snippet or ''}"
        reject, reason = matches_negative_filter(blob)
        if reject:
            continue
        if crit.get("requireCrewCab") and not matches_tundra_aliases(item.title, require_crew_cab=True):
            if item.model and item.model.lower() == "tundra":
                pass  # keep if model matched via extractor
            elif "tundra" not in (item.title or "").lower():
                continue
        filtered.append(item)

    seen_at = datetime.now(timezone.utc).isoformat()
    merged = dedupe_listings(filtered, seen_at=seen_at)
    ranked = rank_listings(merged, max_price=ctx.max_price)

    alerts: list[dict[str, Any]] = []
    if persist:
        ranked, alerts = upsert_merged_listings(search_id, ranked)
        if search_id:
            touch_saved_search(search_id)

    return {
        "criteria": crit,
        "sourcesRequested": [s.id for s in enabled],
        "sourceStats": source_stats,
        "rawCount": len(raw),
        "filteredCount": len(filtered),
        "dedupedCount": len(ranked),
        "listings": [m.to_api_dict() for m in ranked],
        "alerts": alerts,
        "errors": errors,
        "ranAt": seen_at,
    }


def get_source_layout() -> dict[str, Any]:
    return {
        "layout": sources_by_mode(),
        "defaultCriteria": DEFAULT_TUNDRA_CRITERIA,
        "prioritySources": [
            "toyota_certified",
            "dealer_website",
            "local_toyota_dealer",
            "google_dealer_index",
            "autotempest",
        ],
    }


def get_cached_listings(**kwargs) -> list[dict[str, Any]]:
    return get_listings(**kwargs)
