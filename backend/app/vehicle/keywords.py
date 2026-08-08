"""Tundra search aliases and Craigslist region groups."""

from __future__ import annotations

# §6 — keyword aliases for Toyota Tundra (CrewMax preferred over Double Cab).
TUNDRA_SEARCH_ALIASES: tuple[str, ...] = (
    "Toyota Tundra CrewMax 4WD",
    "Toyota Tundra CrewMax 4x4",
    "Toyota Tundra SR5 5.7",
    "Toyota Tundra Limited 5.7",
    "Toyota Tundra Platinum 5.7",
    "Toyota Tundra 1794 5.7",
    "Toyota Tundra TRD Off Road 5.7",
    "Toyota Tundra TRD Pro 5.7",
)

TUNDRA_CAB_PREFERRED = ("crewmax", "crew max", "crew cab")
TUNDRA_CAB_AVOID = ("double cab", "access cab", "regular cab")

# §7 — Craigslist regions by territory.
CRAIGSLIST_REGIONS: dict[str, list[dict[str, str]]] = {
    "midwest": [
        {"id": "kansascity", "label": "Kansas City", "site": "kansascity.craigslist.org"},
        {"id": "stlouis", "label": "St. Louis", "site": "stlouis.craigslist.org"},
        {"id": "omaha", "label": "Omaha", "site": "omaha.craigslist.org"},
        {"id": "desmoines", "label": "Des Moines", "site": "desmoines.craigslist.org"},
        {"id": "wichita", "label": "Wichita", "site": "wichita.craigslist.org"},
        {"id": "springfieldmo", "label": "Springfield MO", "site": "springfield.craigslist.org"},
        {"id": "tulsa", "label": "Tulsa", "site": "tulsa.craigslist.org"},
        {"id": "oklahomacity", "label": "OKC", "site": "oklahomacity.craigslist.org"},
    ],
    "texas": [
        {"id": "dallas", "label": "Dallas", "site": "dallas.craigslist.org"},
        {"id": "houston", "label": "Houston", "site": "houston.craigslist.org"},
        {"id": "austin", "label": "Austin", "site": "austin.craigslist.org"},
        {"id": "sanantonio", "label": "San Antonio", "site": "sanantonio.craigslist.org"},
    ],
    "south": [
        {"id": "nashville", "label": "Nashville", "site": "nashville.craigslist.org"},
        {"id": "memphis", "label": "Memphis", "site": "memphis.craigslist.org"},
        {"id": "littlerock", "label": "Little Rock", "site": "littlerock.craigslist.org"},
        {"id": "fayetteville", "label": "Fayetteville", "site": "fayetteville.craigslist.org"},
    ],
    "mountain_west": [
        {"id": "denver", "label": "Denver", "site": "denver.craigslist.org"},
        {"id": "phoenix", "label": "Phoenix", "site": "phoenix.craigslist.org"},
        {"id": "saltlakecity", "label": "Salt Lake City", "site": "saltlakecity.craigslist.org"},
    ],
}

CRAIGSLIST_QUERY_TERMS: tuple[str, ...] = (
    "Tundra CrewMax",
    "Tundra 4x4",
    "Tundra 5.7",
    "Toyota Tundra SR5",
    "Toyota Tundra Limited",
)

# Large dealer groups for direct dealer mode (§2).
DEALER_GROUP_DOMAINS: dict[str, list[str]] = {
    "toyota_dealers": [
        "toyota.com",
        "toyotacertified.com",
    ],
    "autonation": ["autonation.com"],
    "lithia": ["lithia.com", "lithiaauto.com"],
    "sonic_echopark": ["echopark.com", "sonicautomotive.com"],
    "enterprise": ["enterprisecarsales.com"],
    "hertz": ["hertzcarsales.com"],
    "driveway": ["driveway.com"],
}

DEFAULT_TUNDRA_CRITERIA = {
    "yearMin": 2012,
    "yearMax": 2021,
    "maxPrice": 45000,
    "maxMileage": 75000,
    "requireCrewCab": True,
    "require4x4": True,
    "preferEngine": "5.7",
    "make": "Toyota",
    "model": "Tundra",
}
