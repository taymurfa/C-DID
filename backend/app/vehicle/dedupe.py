"""VIN-first deduplication across marketplace sources."""

from __future__ import annotations

import hashlib
import re
from typing import Iterable

from app.vehicle.models import MergedListing, SourceRef, VehicleListing

_VIN_RE = re.compile(r"^[A-HJ-NPR-Z0-9]{17}$", re.I)


def _norm(s: str | None) -> str:
    return (s or "").strip().lower()


def _listing_key_no_vin(item: VehicleListing) -> str:
    parts = [
        str(item.year or ""),
        _norm(item.make),
        _norm(item.model),
        str(item.mileage or ""),
        str(item.price or ""),
        _norm(item.dealer),
    ]
    return hashlib.sha256("|".join(parts).encode()).hexdigest()[:16]


def _same_vehicle_fuzzy(a: VehicleListing, b: VehicleListing) -> bool:
    """Same year + make + model + mileage + price + dealer = likely duplicate."""
    if a.year and b.year and a.year != b.year:
        return False
    if _norm(a.make) and _norm(b.make) and _norm(a.make) != _norm(b.make):
        return False
    if _norm(a.model) and _norm(b.model) and _norm(a.model) != _norm(b.model):
        return False
    if a.mileage is not None and b.mileage is not None and a.mileage != b.mileage:
        return False
    if a.price is not None and b.price is not None and a.price != b.price:
        return False
    if _norm(a.dealer) and _norm(b.dealer) and _norm(a.dealer) != _norm(b.dealer):
        return False
    return bool(a.year and a.make and a.model and a.mileage is not None and a.price is not None and a.dealer)


def _same_photo_dealer(a: VehicleListing, b: VehicleListing) -> bool:
    if not a.photo_url or not b.photo_url:
        return False
    if a.photo_url.strip() != b.photo_url.strip():
        return False
    return bool(_norm(a.dealer) and _norm(a.dealer) == _norm(b.dealer))


def _merge_into(target: MergedListing, item: VehicleListing, seen_at: str | None) -> None:
    label = item.source_label
    if label not in target.sources:
        target.sources.append(label)
    if item.url and item.url not in target.urls:
        target.urls.append(item.url)
    target.source_refs.append(
        SourceRef(source_id=item.source_id, source_label=label, url=item.url, seen_at=seen_at)
    )
    target.source_count = len(target.sources)
    # Prefer richer fields from newer scrape
    for attr in (
        "trim",
        "engine",
        "drivetrain",
        "cab_style",
        "bed_length",
        "accident_status",
        "title_brand",
        "owner_count",
        "city",
        "state",
        "photo_url",
        "distance_miles",
    ):
        val = getattr(item, attr, None)
        if val and not getattr(target, attr, None):
            setattr(target, attr, val)
    if item.certified:
        target.certified = True
    if item.price and (target.price is None or item.price < target.price):
        target.price = item.price
    if item.mileage and (target.mileage is None or item.mileage < target.mileage):
        target.mileage = item.mileage


def _vehicle_to_merged(item: VehicleListing, listing_key: str) -> MergedListing:
    return MergedListing(
        vin=item.vin,
        listing_key=listing_key,
        title=item.title,
        year=item.year,
        make=item.make,
        model=item.model,
        trim=item.trim,
        price=item.price,
        mileage=item.mileage,
        dealer=item.dealer,
        city=item.city,
        state=item.state,
        certified=item.certified,
        engine=item.engine,
        drivetrain=item.drivetrain,
        cab_style=item.cab_style,
        bed_length=item.bed_length,
        accident_status=item.accident_status,
        title_brand=item.title_brand,
        owner_count=item.owner_count,
        photo_url=item.photo_url,
        distance_miles=item.distance_miles,
        sources=[item.source_label],
        urls=[item.url] if item.url else [],
        source_refs=[
            SourceRef(source_id=item.source_id, source_label=item.source_label, url=item.url)
        ],
        source_count=1,
    )


def dedupe_listings(items: Iterable[VehicleListing], seen_at: str | None = None) -> list[MergedListing]:
    """
    Priority:
    1. VIN exact match
    2. year + make + model + mileage + price + dealer
    3. same photo URL + same dealer
    """
    by_vin: dict[str, MergedListing] = {}
    by_key: dict[str, MergedListing] = {}
    merged_list: list[MergedListing] = []
    raw_items = list(items)

    for item in raw_items:
        vin = (item.vin or "").upper()
        if vin and _VIN_RE.match(vin):
            if vin in by_vin:
                _merge_into(by_vin[vin], item, seen_at)
                continue
            m = _vehicle_to_merged(item, listing_key=f"vin:{vin}")
            m.vin = vin
            by_vin[vin] = m
            merged_list.append(m)
            continue

        placed = False
        for existing in merged_list:
            # Find corresponding raw for fuzzy — compare against merged representative fields
            rep = VehicleListing(
                title=existing.title,
                url=existing.urls[0] if existing.urls else "",
                source_id="",
                source_label="",
                year=existing.year,
                make=existing.make,
                model=existing.model,
                price=existing.price,
                mileage=existing.mileage,
                dealer=existing.dealer,
                photo_url=existing.photo_url,
            )
            if _same_vehicle_fuzzy(item, rep):
                _merge_into(existing, item, seen_at)
                placed = True
                break
            if _same_photo_dealer(item, rep):
                _merge_into(existing, item, seen_at)
                placed = True
                break

        if placed:
            continue

        key = _listing_key_no_vin(item)
        if key in by_key:
            _merge_into(by_key[key], item, seen_at)
            continue
        m = _vehicle_to_merged(item, listing_key=key)
        by_key[key] = m
        merged_list.append(m)

    return merged_list
