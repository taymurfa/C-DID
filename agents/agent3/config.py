"""Agent 3 (Outreach / GTM Sequences) — configuration.

All agents share one MongoDB. Agent 3 reads the events + qualified speakers that Persons 1 & 2
produce, and writes back `sequences` + `sequence_steps` + funnel state. Nothing here is
OKR/legacy; this is a self-contained Person-3 service.
"""
from __future__ import annotations

import os

try:  # python-dotenv is in requirements; degrade gracefully if it's missing.
    from dotenv import load_dotenv

    load_dotenv()
except ModuleNotFoundError:
    pass

# --- Mongo (shared across all 4 agents) -------------------------------------------------
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "hackathon_db")

# Collections Persons 1 & 2 hand us (input) and we own (output). See README "Data contract".
COLL_EVENTS = os.getenv("COLL_EVENTS", "events")  # speakers are embedded in each event document
COLL_SEQUENCES = os.getenv("COLL_SEQUENCES", "sequences")
COLL_EMAILS = os.getenv("COLL_EMAILS", "emails")

# --- OpenAI (optional — service degrades to deterministic templates without a key) -------
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# --- Outreach identity (who the drafted emails are from) --------------------------------
SENDER_NAME = os.getenv("SENDER_NAME", "Kirill Cheldishkin")
SENDER_COMPANY = os.getenv("SENDER_COMPANY", "Candid")
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "kirill.cheldishkin@gmail.com")
OPT_OUT_LINE = os.getenv(
    "OPT_OUT_LINE",
    "If you'd rather not hear from me, just reply \"no thanks\" and I'll close the loop.",
)

# --- Email delivery ---------------------------------------------------------------------
# SEND_MODE: "mock" logs and flips the flag (nothing leaves the machine);
#            "real" actually sends via SMTP (needs SMTP_PASSWORD — a Gmail App Password).
SEND_MODE = os.getenv("SEND_MODE", "mock").strip().lower()
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", SENDER_EMAIL)          # gmail login = the From address
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()    # Gmail App Password (not your login pw)

# --- Send timing ------------------------------------------------------------------------
# Each cadence step is scheduled at this UTC time on its offset day (minute precision).
SEND_HOUR = int(os.getenv("SEND_HOUR", "9"))
SEND_MINUTE = int(os.getenv("SEND_MINUTE", "0"))

# --- Automation loop intervals (seconds) ------------------------------------------------
GENERATE_INTERVAL_SEC = int(os.getenv("GENERATE_INTERVAL_SEC", "30"))  # scan for new events
SEND_INTERVAL_SEC = int(os.getenv("SEND_INTERVAL_SEC", "15"))          # send due emails

# --- Service ----------------------------------------------------------------------------
PORT = int(os.getenv("AGENT3_PORT", "8003"))
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
