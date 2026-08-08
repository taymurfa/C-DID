# Agent 3 — Outreach / GTM Sequences (Person 3)

Turns **qualified speakers** into **conference-date-anchored, personalized email sequences**, tracks
each lead through the **funnel**, and sends the emails on schedule. Standalone Python/Flask service
on the **shared MongoDB**. Runs on **port 8003**.

> The value is timing: reach the buyer at concept stage, before the RFP. The cadence is anchored to
> the event date so a rep shows up at the conference with meetings already booked.

## Run

```bash
cd agents/agent3
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # then edit .env (see "Real email" below)

# local Mongo (skip if pointing at the team's shared cluster)
docker-compose up -d

# load real conference data (events with embedded speakers)
python -m agents.agent3.mock.import_schedule     # run from repo root

# start the API (port 8003)
python -m agents.agent3.api
```

Without `OPENAI_API_KEY`, emails use deterministic, evidence-only templates (demo never breaks).
Set the key in `.env` for LLM-drafted copy.

### Automation worker (the background loop)
The API is a request/response server; automation runs as a separate process. In a **second terminal**:
```bash
python -m agents.agent3.worker          # loops forever:
                                        #  • every GENERATE_INTERVAL_SEC: unseen events -> emails
                                        #  • every SEND_INTERVAL_SEC:     send emails whose send_at passed
python -m agents.agent3.worker --once   # one generate + one send pass, then exit
```

## Data model

Speakers are **embedded in each event document** (no separate collection). Agent 3 writes two
collections of its own: `sequences` and `emails`.

### `events` (input) — one document per conference session, speakers embedded
```jsonc
{ "_id", "name", "conference", "url", "venue", "location",
  "start_date": ISODate,        // the cadence anchor
  "end_date", "day", "description", "tracks", "format", "status",
  "seen": false,                // set true once Agent 3 has generated its emails
  "processed_at",
  "speakers": [
    { "id": "<uuid hex>",       // stable id Agent 3 references
      "name", "title", "company", "company_type",
      "talk_title", "talk_topic",
      "icp_score": 0-100, "icp_reason", "evidence": ["..."],
      "email": "recipient", "qualified": true }
  ] }
```

### `sequences` (output)
```jsonc
{ "_id", "speaker_id": "<speaker.id>", "event_id": "<events._id>",
  "stage": "identified|contacted|replied|meeting|met|follow_up|conversation_booked",
  "created_at", "updated_at" }
```

### `emails` (output) — the send queue
```jsonc
{ "_id", "sequence_id", "speaker_id", "event_id",
  "kind": "t_minus_14|t_minus_7|t_minus_2|event_day|post_event", "label", "sort_order",
  "send_at": "2026-09-08T09:00:00+00:00",   // EXACT datetime (UTC, minute precision) — when to send
  "to_email", "subject", "body", "generated_by": "llm|template",
  "status": "draft|sending|sent|opened|replied|meeting",
  "sent": false,          // guard: flipped true on send so it never sends twice
  "sent_at", "send_mode", "last_error" }
```

Funnel stages + cadence live in `schemas.py` (source of truth). `GET /api/meta` exposes them.

## Cadence (anchored to the event's `start_date`, sent at `SEND_HOUR:SEND_MINUTE` UTC)
| kind | offset | intent |
|------|--------|--------|
| `t_minus_14` | −14d | first touch |
| `t_minus_7`  | −7d  | follow-up |
| `t_minus_2`  | −2d  | "let's meet at the event" nudge |
| `event_day`  | 0d   | meet in person |
| `post_event` | +3d  | follow-up to book a real conversation |

## Real email

Sending goes through `mailer.py`, controlled by `.env`:
- `SEND_MODE=mock` (default) — logs the email, sends nothing.
- `SEND_MODE=real` — sends via SMTP. Requires **`SMTP_PASSWORD` = a Gmail App Password**
  (`https://myaccount.google.com/apppasswords`, needs 2-Step Verification). Your normal Google
  password will NOT work. `SENDER_EMAIL`/`SMTP_USER` is the From address.

Double-send is impossible: the sender atomically claims each email (`sent != true`) before delivering;
on failure it releases the email (status back to `draft`) so it retries and is never lost.

## Endpoints (all under `/api`, port 8003)
| Method | Path | Purpose |
|--------|------|---------|
| GET  | `/health` | liveness + Mongo ping |
| GET  | `/meta` | funnel stages + cadence |
| GET  | `/events` | events, with speaker/enrolled counts + `seen` |
| GET  | `/events/<id>/speakers?min_score=` | embedded speakers, ranked by ICP score |
| POST | `/speakers/<id>/enroll` | create sequence + 5 scheduled drafted emails (`{regenerate:true}`) |
| POST | `/events/<id>/enroll-all?min_score=` | enroll a whole event |
| GET  | `/sequences` | Juicebox view: sequences + emails + open/reply/meeting rates |
| GET  | `/sequences/<id>` | one sequence, hydrated with speaker + event |
| POST | `/sequences/<id>/advance` · `/stage` | move / set funnel stage |
| POST | `/emails/<id>/mark` | set an email status `{status}` |
| GET  | `/funnel` | stage counts + conversion + drop-off |
| POST | `/events/process` | **generator**: unseen events → sequences + scheduled emails, mark `seen` |
| GET  | `/emails?sent=&due=&sequence_id=&event_id=` | inspect the send queue |
| POST | `/emails/<id>/send` | **manually send ONE email now**, ignoring schedule |
| POST | `/emails/send-due` | send all emails whose `send_at` has passed |

## Guardrails
Emails are personalized **only from real evidence** (talk, company, event) and carry an easy opt-out.
Real sending is opt-in via `SEND_MODE=real`; keep it `mock` unless you intend to actually email people.

## Layout
```
config.py     env + Mongo/OpenAI/identity/SMTP settings
store.py      Mongo access + embedded-speaker lookup + JSON serialization
schemas.py    funnel STAGES + cadence STEP_KINDS (source of truth)
cadence.py    event date → 5 steps with exact send_at datetimes
drafting.py   email drafting (OpenAI + deterministic fallback)
mailer.py     SMTP delivery (mock | real)
service.py    orchestration: enroll / generate / advance / mark / funnel
automation.py generator (unseen events → emails) + sender (send due, no double-send)
worker.py     background loop (generate + send on intervals)
api.py        Flask routes (thin)
mock/import_schedule.py + full_schedule.csv   real conference data → events w/ embedded speakers
docker-compose.yml   local MongoDB for dev
```
