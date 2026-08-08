"""Negative filters and Tundra keyword matching."""

from __future__ import annotations

import re

from app.vehicle.keywords import TUNDRA_CAB_AVOID, TUNDRA_CAB_PREFERRED, TUNDRA_SEARCH_ALIASES

# §5 — exact phrase / token checks (avoid broad "damage" false positives).
NEGATIVE_EXACT_PHRASES: tuple[str, ...] = (
    "salvage",
    "rebuilt title",
    "branded title",
    "lemon",
    "theft recovery",
    "frame damage",
    "structural damage",
    "accident reported",
    "damage reported",
    "commercial use",
    "fleet use",
    "rental vehicle",
    "rental use",
    "salvage title",
    "rebuilt",
)

# Phrases that indicate clean history — do not reject if these appear without negatives.
CLEAN_HISTORY_PHRASES: tuple[str, ...] = (
    "no accidents or damage reported",
    "no accident",
    "no damage reported",
    "clean title",
    "one owner",
)


def _haystack(listing_text: str) -> str:
    return (listing_text or "").lower()


def matches_negative_filter(text: str) -> tuple[bool, str | None]:
    """Return (reject, reason). Uses exact phrase checks on combined title + snippet."""
    h = _haystack(text)
    for phrase in NEGATIVE_EXACT_PHRASES:
        if phrase in h:
            # "minor damage" alone is not in our reject list; "damage reported" is.
            if phrase == "damage reported" and "no accidents or damage reported" in h:
                continue
            if phrase == "accident reported" and "no accident" in h:
                continue
            return True, phrase
    return False, None


def matches_tundra_aliases(title: str, require_crew_cab: bool = True) -> bool:
    t = (title or "").lower()
    if "tundra" not in t and "toyota" not in t:
        return False
    if require_crew_cab:
        if any(a in t for a in TUNDRA_CAB_AVOID):
            return False
        if not any(p in t for p in TUNDRA_CAB_PREFERRED):
            # Allow alias match even if cab not in title
            if not any(a.lower() in t for a in TUNDRA_SEARCH_ALIASES):
                return False
    return True


def build_search_queries(
    base_alias: str | None = None,
    site_filter: str | None = None,
    year_min: int | None = None,
    year_max: int | None = None,
) -> list[str]:
    """Build Serp/web queries from Tundra aliases."""
    aliases = [base_alias] if base_alias else list(TUNDRA_SEARCH_ALIASES)
    queries: list[str] = []
    year_clause = ""
    if year_min and year_max:
        year_clause = f" {year_min}..{year_max}"
    for alias in aliases[:6]:
        q = f"{alias}{year_clause}"
        if site_filter:
            q = f"{q} site:{site_filter}"
        queries.append(q.strip())
    return queries


_VIN_RE = re.compile(r"\b([A-HJ-NPR-Z0-9]{17})\b", re.I)


def extract_vin(text: str) -> str | None:
    m = _VIN_RE.search(text or "")
    return m.group(1).upper() if m else None


_PRICE_RE = re.compile(r"\$[\s]*([\d,]+)")
_MILEAGE_RE = re.compile(r"([\d,]+)\s*(?:mi|miles|mile)\b", re.I)
_YEAR_RE = re.compile(r"\b(20[12]\d|2012)\b")


def extract_price(text: str) -> int | None:
    m = _PRICE_RE.search(text or "")
    if not m:
        return None
    try:
        return int(m.group(1).replace(",", ""))
    except ValueError:
        return None


def extract_mileage(text: str) -> int | None:
    m = _MILEAGE_RE.search(text or "")
    if not m:
        return None
    try:
        return int(m.group(1).replace(",", ""))
    except ValueError:
        return None


def extract_year(text: str) -> int | None:
    m = _YEAR_RE.search(text or "")
    if not m:
        return None
    try:
        return int(m.group(1))
    except ValueError:
        return None
