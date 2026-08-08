"""Parse listing fields from HTML snippets and JSON-LD."""

from __future__ import annotations

import json
import re

from app.vehicle.filters import (
    extract_mileage,
    extract_price,
    extract_vin,
    extract_year,
    matches_negative_filter,
)
from app.vehicle.models import VehicleListing

_JSONLD_RE = re.compile(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', re.I | re.S)
_DEALER_NAME_RE = re.compile(r'"seller"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"', re.I)
_CERTIFIED_RE = re.compile(r"toyota\s+certified|certified\s+used|cpo", re.I)
_4X4_RE = re.compile(r"4x4|4wd|four[- ]wheel", re.I)
_ENGINE_57_RE = re.compile(r"5\.7\s*l|5\.7l", re.I)
_CREWMAX_RE = re.compile(r"crew\s*max|crewmax", re.I)
_TRIM_RE = re.compile(
    r"\b(SR5|Limited|Platinum|1794|TRD Off[- ]Road|TRD Pro|Capstone)\b", re.I
)


def parse_listing_from_serp(
    *,
    title: str,
    url: str,
    snippet: str,
    source_id: str,
    source_label: str,
) -> VehicleListing | None:
    combined = f"{title}\n{snippet}"
    reject, _ = matches_negative_filter(combined)
    if reject:
        return None

    vin = extract_vin(combined)
    price = extract_price(combined)
    mileage = extract_mileage(combined)
    year = extract_year(combined) or extract_year(title)

    make = "Toyota" if "toyota" in combined.lower() else None
    model = "Tundra" if "tundra" in combined.lower() else None
    trim_m = _TRIM_RE.search(combined)
    trim = trim_m.group(1) if trim_m else None

    dealer = None
    if " | " in title:
        dealer = title.split("|")[-1].strip()
    elif " - " in title:
        parts = title.split(" - ")
        if len(parts) >= 2:
            dealer = parts[-1].strip()

    certified = bool(_CERTIFIED_RE.search(combined))
    engine = "5.7L V8" if _ENGINE_57_RE.search(combined) else None
    drivetrain = "4WD" if _4X4_RE.search(combined) else None
    cab_style = "CrewMax" if _CREWMAX_RE.search(combined) else None

    accident_status = None
    low = combined.lower()
    if "no accidents or damage reported" in low:
        accident_status = "no accidents or damage reported"
    elif "no accident" in low:
        accident_status = "no accidents reported"
    elif "accident reported" in low:
        accident_status = "accident reported"

    owner_count = 1 if "one owner" in low else None

    return VehicleListing(
        title=title.strip(),
        url=url.strip(),
        source_id=source_id,
        source_label=source_label,
        year=year,
        make=make,
        model=model,
        trim=trim,
        price=price,
        mileage=mileage,
        vin=vin,
        dealer=dealer,
        certified=certified,
        engine=engine,
        drivetrain=drivetrain,
        cab_style=cab_style,
        accident_status=accident_status,
        owner_count=owner_count,
        raw_snippet=snippet.strip() if snippet else None,
    )


def enrich_from_html(html: str, listing: VehicleListing) -> VehicleListing:
    """Extract JSON-LD Vehicle fields from dealer page HTML."""
    if not html:
        return listing

    for block in _JSONLD_RE.findall(html):
        try:
            data = json.loads(block.strip())
        except json.JSONDecodeError:
            continue
        nodes = data if isinstance(data, list) else [data]
        for node in nodes:
            if not isinstance(node, dict):
                continue
            typ = node.get("@type") or ""
            if isinstance(typ, list):
                typ = " ".join(typ)
            if "Vehicle" not in typ and "Car" not in typ:
                continue
            listing.vin = listing.vin or (node.get("vehicleIdentificationNumber") or node.get("sku"))
            if isinstance(listing.vin, str):
                listing.vin = listing.vin.upper()
            offers = node.get("offers") or {}
            if isinstance(offers, list):
                offers = offers[0] if offers else {}
            if isinstance(offers, dict) and not listing.price:
                price = offers.get("price")
                try:
                    listing.price = int(float(str(price).replace(",", "")))
                except (TypeError, ValueError):
                    pass
            if not listing.mileage and node.get("mileageFromOdometer"):
                odo = node["mileageFromOdometer"]
                if isinstance(odo, dict):
                    try:
                        listing.mileage = int(float(odo.get("value", 0)))
                    except (TypeError, ValueError):
                        pass
            if not listing.year and node.get("vehicleModelDate"):
                try:
                    listing.year = int(str(node["vehicleModelDate"])[:4])
                except (TypeError, ValueError):
                    pass
            listing.make = listing.make or node.get("brand", {}).get("name") if isinstance(node.get("brand"), dict) else node.get("brand")
            listing.model = listing.model or node.get("model")
            listing.trim = listing.trim or node.get("vehicleConfiguration")

    if not listing.dealer:
        dm = _DEALER_NAME_RE.search(html)
        if dm:
            listing.dealer = dm.group(1)

    # History hints from page text
    low = html.lower()
    if "carfax" in low and not listing.carfax_status:
        listing.carfax_status = "mentioned"
    if "autocheck" in low and not listing.autocheck_status:
        listing.autocheck_status = "mentioned"

    return listing
