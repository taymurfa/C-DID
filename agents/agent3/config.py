"""Agent 3 (Outreach / GTM Sequences) — configuration.

Agent 3 owns the GTM Mongo database (`speaker_signal_gtm` by default). It can
read an `events` collection with embedded qualified speakers (automation path)
or accept dashboard `lead` + `conference` payloads via the compat API.
"""
from __future__ import annotations

import os

try:  # python-dotenv is in requirements; degrade gracefully if it's missing.
    from dotenv import load_dotenv

    load_dotenv()
except ModuleNotFoundError:
    pass

# --- Mongo ------------------------------------------------------------------
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
# Prefer Compose's MONGODB_DB; keep MONGODB_DB_NAME as a back-compat alias.
MONGODB_DB_NAME = (
    os.getenv("MONGODB_DB")
    or os.getenv("MONGODB_DB_NAME")
    or "speaker_signal_gtm"
)

# Collections: events (input / materialised) + sequences/emails (owned).
COLL_EVENTS = os.getenv("COLL_EVENTS", "events")  # speakers are embedded in each event document
COLL_SEQUENCES = os.getenv(
    "MONGODB_SEQUENCES_COLLECTION",
    os.getenv("COLL_SEQUENCES", "sequences"),
)
COLL_EMAILS = os.getenv("COLL_EMAILS", "emails")

# --- OpenAI (optional — service degrades to deterministic templates without a key) -------
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# --- Outreach identity (who the drafted emails are from) --------------------------------
SENDER_NAME = os.getenv("SENDER_NAME", "Kirill Cheldishkin")
SENDER_COMPANY = os.getenv("SENDER_COMPANY", "Candid")
SENDER_EMAIL = os.getenv("SENDER_EMAIL") or os.getenv("SMTP_FROM") or "info@jobersteadt.com"
OPT_OUT_LINE = os.getenv(
    "OPT_OUT_LINE",
    "If you'd rather not hear from me, just reply \"no thanks\" and I'll close the loop.",
)

# --- Email delivery ---------------------------------------------------------------------
# SEND_MODE: "mock" logs and flips the flag (nothing leaves the machine);
#            "real" actually sends via SMTP (Zoho by default; needs SMTP_PASSWORD).
SEND_MODE = os.getenv("SEND_MODE", "mock").strip().lower()
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.zoho.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip().strip("\"'")
SMTP_FROM = os.getenv("SMTP_FROM", "").strip() or SENDER_EMAIL

# --- Send timing ------------------------------------------------------------------------
# Each cadence step is scheduled at this UTC time on its offset day (minute precision).
SEND_HOUR = int(os.getenv("SEND_HOUR", "9"))
SEND_MINUTE = int(os.getenv("SEND_MINUTE", "0"))

# --- Automation loop intervals (seconds) ------------------------------------------------
GENERATE_INTERVAL_SEC = int(os.getenv("GENERATE_INTERVAL_SEC", "30"))  # scan for new events
SEND_INTERVAL_SEC = int(os.getenv("SEND_INTERVAL_SEC", "15"))          # send due emails

# --- Service ----------------------------------------------------------------------------
# GTM_PORT matches docker-compose / prior gtm-service; AGENT3_PORT is an alias.
PORT = int(os.getenv("GTM_PORT") or os.getenv("AGENT3_PORT") or "8003")
CORS_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://localhost:3001",
    ).split(",")
    if o.strip()
]
