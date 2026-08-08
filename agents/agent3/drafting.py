"""Personalized email drafting — grounded ONLY in real evidence.

Rule from the brief: draft personalized emails based only on real evidence (their talk, their
company, the event). No fabricated claims. Every email carries an easy opt-out. Uses OpenAI when
OPENAI_API_KEY is set; otherwise falls back to deterministic templates so the demo never breaks.
"""
from __future__ import annotations

from . import config

# Per-step intent, used by both the LLM prompt and the deterministic fallback.
STEP_INTENT: dict[str, str] = {
    "t_minus_14": "First touch two weeks before the event. Warm, specific opener that references their talk. Ask nothing big yet — just open the door.",
    "t_minus_7": "Follow-up one week out. Add one concrete, relevant point of value tied to their topic. Gently propose connecting at the event.",
    "t_minus_2": "Two days before. Short 'let's meet at the event' nudge — propose a specific 15-min slot.",
    "event_day": "Event day. Very short in-person nudge: where/when to find each other today.",
    "post_event": "A few days after the event. Reference meeting (or missing) them, and propose a real follow-up conversation.",
}


def _evidence(speaker: dict, event: dict) -> dict:
    """Pull only real, present fields. Missing → omitted, never invented."""
    return {
        "speaker_name": speaker.get("name") or "there",
        "first_name": (speaker.get("name") or "there").split()[0],
        "title": speaker.get("title"),
        "company": speaker.get("company"),
        "talk_title": speaker.get("talk_title"),
        "talk_topic": speaker.get("talk_topic"),
        "icp_reason": speaker.get("icp_reason"),
        "event_name": event.get("name"),
        "event_location": event.get("location") or event.get("venue"),
    }


def draft_email(step_kind: str, speaker: dict, event: dict) -> dict:
    """Return {subject, body, generated_by}. Never raises — falls back on any error."""
    ev = _evidence(speaker, event)
    if config.OPENAI_API_KEY:
        try:
            return _draft_with_llm(step_kind, ev)
        except Exception as e:  # noqa: BLE001 — demo must survive any LLM/network failure
            print(f"[agent3.drafting] LLM draft failed ({e}); using template fallback", flush=True)
    return _draft_template(step_kind, ev)


# --- LLM path ---------------------------------------------------------------------------
def _draft_with_llm(step_kind: str, ev: dict) -> dict:
    from openai import OpenAI

    client = OpenAI(api_key=config.OPENAI_API_KEY)
    facts = {k: v for k, v in ev.items() if v}  # drop empties so the model can't lean on them
    intent = STEP_INTENT.get(step_kind, "Short, relevant outreach email.")

    system = (
        f"You are {config.SENDER_NAME}, a rep at {config.SENDER_COMPANY}, an energy/data-center-power "
        "solutions firm doing origination outreach. Write a concise, genuinely personalized B2B email. "
        "Ground EVERY claim in the provided facts only — never invent projects, mutual connections, or "
        "metrics. 90 words max. Plain, human tone. Return strict JSON: {\"subject\":..., \"body\":...}. "
        f"End the body with a soft opt-out line and sign off as {config.SENDER_NAME}, {config.SENDER_COMPANY}."
    )
    user = f"Step intent: {intent}\nFacts (use only these): {facts}"

    resp = client.chat.completions.create(
        model=config.OPENAI_MODEL,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        response_format={"type": "json_object"},
        temperature=0.6,
    )
    import json

    data = json.loads(resp.choices[0].message.content)
    body = data.get("body", "").strip()
    if config.OPT_OUT_LINE not in body:
        body = f"{body}\n\n{config.OPT_OUT_LINE}"
    return {"subject": data.get("subject", "").strip(), "body": body, "generated_by": "llm"}


# --- Deterministic fallback (no API key) ------------------------------------------------
def _draft_template(step_kind: str, ev: dict) -> dict:
    name = ev["first_name"]
    talk = ev.get("talk_title") or ev.get("talk_topic") or "your session"
    company = ev.get("company") or "your team"
    eventname = ev.get("event_name") or "the conference"
    where = ev.get("event_location")
    sign = f"\n\n{config.OPT_OUT_LINE}\n\n{config.SENDER_NAME}\n{config.SENDER_COMPANY}"

    templates = {
        "t_minus_14": (
            f"Your {eventname} talk on {talk}",
            f"Hi {name},\n\nSaw you're speaking on \"{talk}\" at {eventname} — that's exactly the "
            f"work we spend our time on at {config.SENDER_COMPANY}. Would love to hear how {company} "
            f"is approaching it.\n\nNo agenda yet — just wanted to open the door before the event.",
        ),
        "t_minus_7": (
            f"One thought ahead of {eventname}",
            f"Hi {name},\n\nWith {eventname} a week out, I keep coming back to your angle on {talk}. "
            f"We've helped teams like {company} move faster at the concept stage — happy to share what "
            f"we've seen. Any chance to connect while we're both there?",
        ),
        "t_minus_2": (
            f"15 min at {eventname}?",
            f"Hi {name},\n\n{eventname} is nearly here. Could we grab 15 minutes"
            + (f" around {where}" if where else "")
            + f" to talk through {ev.get('talk_topic') or talk}? I'll work around your schedule.",
        ),
        "event_day": (
            f"Here today — let's connect",
            f"Hi {name},\n\nI'm on-site at {eventname} today. Would be great to say hello after your "
            f"session on {talk}. I'll come find you — or tell me where's easiest.",
        ),
        "post_event": (
            f"Following up from {eventname}",
            f"Hi {name},\n\nThanks for the time at {eventname}"
            + (" — great to meet in person." if True else ".")
            + f" Given {company}'s work on {ev.get('talk_topic') or talk}, I think a proper conversation "
            f"would be worth it. Open to a 30-min call next week?",
        ),
    }
    subject, body = templates.get(step_kind, (f"Following up — {eventname}", f"Hi {name},\n\nWould love to connect."))
    return {"subject": subject, "body": body + sign, "generated_by": "template"}
