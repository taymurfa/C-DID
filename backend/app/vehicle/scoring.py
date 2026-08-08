"""Ranking score for Tundra search priorities (§4)."""

from __future__ import annotations

from app.vehicle.models import MergedListing


def _text_blob(m: MergedListing) -> str:
    parts = [m.title or "", m.trim or "", m.engine or "", m.drivetrain or "", m.cab_style or ""]
    return " ".join(parts).lower()


def score_listing(
    m: MergedListing,
    *,
    max_price: int = 45000,
    market_price: int | None = None,
) -> MergedListing:
    breakdown: dict[str, int] = {}
    pros: list[str] = []
    cons: list[str] = []
    score = 0
    blob = _text_blob(m)

    if m.mileage is not None and m.mileage < 40000:
        breakdown["low_mileage_40k"] = 40
        pros.append("Under 40k miles")
    elif m.mileage is not None and m.mileage < 75000:
        breakdown["mileage_ok"] = 15
        pros.append("Under 75k miles")

    if m.price is not None and m.price < 40000:
        breakdown["under_40k_price"] = 30
        pros.append("Under $40k")
    elif m.price is not None and m.price <= max_price:
        breakdown["under_budget"] = 15
        pros.append(f"Within ${max_price:,} budget")
    elif m.price is not None and m.price > max_price:
        breakdown["over_budget"] = -10
        cons.append("Above target budget")

    if m.certified:
        breakdown["toyota_certified"] = 25
        pros.append("Toyota Certified")

    accident = (m.accident_status or "").lower()
    title = (m.title_brand or "").lower()
    if "no accident" in accident or "clean" in title:
        breakdown["clean_history"] = 25
        pros.append("No accidents reported")
    if m.owner_count == 1:
        breakdown["one_owner"] = 20
        pros.append("One owner")

    if "crewmax" in blob or "crew max" in blob or (m.cab_style and "crew" in m.cab_style.lower()):
        breakdown["crewmax"] = 20
        pros.append("CrewMax / crew cab")
    elif "double cab" in blob:
        breakdown["double_cab"] = -15
        cons.append("Double Cab (smaller rear seat)")

    if "4x4" in blob or "4wd" in blob or (m.drivetrain and "4" in m.drivetrain):
        breakdown["four_by_four"] = 20
        pros.append("4x4 / 4WD")

    if "5.7" in blob or (m.engine and "5.7" in m.engine):
        breakdown["v8_57"] = 15
        pros.append("5.7L V8")

    if m.year and m.year >= 2020:
        breakdown["recent_year"] = 10
        pros.append(f"{m.year} model year")
    elif m.year and m.year >= 2012:
        breakdown["in_year_range"] = 5

    if "accident" in accident and "no accident" not in accident:
        breakdown["accident_reported"] = -50
        cons.append("Accident reported")
    if "damage reported" in accident:
        breakdown["damage_reported"] = -40
        cons.append("Damage reported")
    for bad in ("salvage", "rebuilt", "lemon"):
        if bad in title or bad in accident:
            breakdown["title_brand"] = -30
            cons.append(f"{bad.title()} title concern")
            break

    if market_price and m.price and m.price > market_price:
        breakdown["above_market"] = -20
        cons.append("Price above estimated market")

    if m.source_count >= 2:
        breakdown["multi_source"] = 5
        pros.append(f"Listed on {m.source_count} sources")

    score = max(0, min(100, sum(breakdown.values())))

    if m.price and m.price > max_price * 0.95:
        cons.append("Near top of budget")

    m.score = score
    m.score_breakdown = breakdown
    m.pros = pros
    m.cons = cons
    return m


def rank_listings(listings: list[MergedListing], **kwargs) -> list[MergedListing]:
    scored = [score_listing(m, **kwargs) for m in listings]
    scored.sort(key=lambda x: (-x.score, x.price or 999_999, x.mileage or 999_999))
    for i, m in enumerate(scored, start=1):
        m.rank = i
    return scored
