"""Vehicle listing and saved-search document shapes."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

ListingStatus = Literal["active", "sold", "removed"]


@dataclass
class SourceRef:
    source_id: str
    source_label: str
    url: str
    seen_at: str | None = None


@dataclass
class VehicleListing:
    """Normalized listing before persistence."""

    title: str
    url: str
    source_id: str
    source_label: str
    year: int | None = None
    make: str | None = None
    model: str | None = None
    trim: str | None = None
    price: int | None = None
    mileage: int | None = None
    vin: str | None = None
    dealer: str | None = None
    city: str | None = None
    state: str | None = None
    accident_status: str | None = None
    certified: bool = False
    engine: str | None = None
    drivetrain: str | None = None
    cab_style: str | None = None
    bed_length: str | None = None
    photo_url: str | None = None
    title_brand: str | None = None
    owner_count: int | None = None
    rental_fleet: bool = False
    commercial_use: bool = False
    carfax_status: str | None = None
    autocheck_status: str | None = None
    accident_count: int | None = None
    damage_reported: bool = False
    service_history_count: int | None = None
    raw_snippet: str | None = None
    distance_miles: float | None = None

    def to_dict(self) -> dict[str, Any]:
        return {k: v for k, v in self.__dict__.items() if v is not None and v is not False}


@dataclass
class MergedListing:
    """Deduped listing with multiple sources."""

    vin: str | None
    listing_key: str
    title: str
    year: int | None
    make: str | None
    model: str | None
    trim: str | None
    price: int | None
    mileage: int | None
    dealer: str | None
    city: str | None
    state: str | None
    certified: bool
    engine: str | None
    drivetrain: str | None
    cab_style: str | None
    bed_length: str | None
    accident_status: str | None
    title_brand: str | None
    owner_count: int | None
    sources: list[str] = field(default_factory=list)
    urls: list[str] = field(default_factory=list)
    source_refs: list[SourceRef] = field(default_factory=list)
    photo_url: str | None = None
    score: int = 0
    score_breakdown: dict[str, int] = field(default_factory=dict)
    pros: list[str] = field(default_factory=list)
    cons: list[str] = field(default_factory=list)
    rank: int = 0
    distance_miles: float | None = None
    status: ListingStatus = "active"
    first_seen_at: str | None = None
    last_seen_at: str | None = None
    price_history: list[dict[str, Any]] = field(default_factory=list)
    source_count: int = 0
    price_drop_amount: int | None = None

    def to_api_dict(self) -> dict[str, Any]:
        return {
            "rank": self.rank,
            "score": self.score,
            "scoreMax": 100,
            "title": self.title,
            "year": self.year,
            "trim": self.trim,
            "make": self.make,
            "model": self.model,
            "price": self.price,
            "mileage": self.mileage,
            "distanceMiles": self.distance_miles,
            "dealer": self.dealer,
            "city": self.city,
            "state": self.state,
            "vin": self.vin,
            "accidentTitleStatus": self.accident_status or self.title_brand,
            "certified": self.certified,
            "engine": self.engine,
            "drivetrain": self.drivetrain,
            "cabStyle": self.cab_style,
            "bedLength": self.bed_length,
            "ownerCount": self.owner_count,
            "pros": self.pros,
            "cons": self.cons,
            "whyRankedWell": self.pros[:3],
            "sources": self.sources,
            "urls": self.urls,
            "sourceCount": self.source_count,
            "scoreBreakdown": self.score_breakdown,
            "status": self.status,
            "firstSeenAt": self.first_seen_at,
            "lastSeenAt": self.last_seen_at,
            "priceHistory": self.price_history,
            "priceDropAmount": self.price_drop_amount,
        }
