"""Agent 3 HTTP API (Flask).

Thin layer over `service`. Person 4's dashboard calls these endpoints. All routes under /api.
Run: `python -m agents.agent3.api`  (or via app.py). Default port 5003.
"""
from __future__ import annotations

from flask import Flask, jsonify, request
from flask_cors import CORS

from . import automation, config, service, store
from .schemas import STAGES, STEP_KINDS


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app, origins=config.CORS_ORIGINS, supports_credentials=True)

    @app.errorhandler(service.NotFound)
    def _not_found(e):
        return jsonify({"error": str(e)}), 404

    @app.errorhandler(service.BadRequest)
    def _bad_request(e):
        return jsonify({"error": str(e)}), 400

    @app.get("/api/health")
    def health():
        return jsonify({"service": "agent3-outreach", "ok": True, "mongo": store.ping()})

    @app.get("/api/meta")
    def meta():
        """Expose the contract so Person 4 can render the funnel/cadence without hardcoding."""
        return jsonify({"stages": STAGES, "step_kinds": STEP_KINDS})

    # --- events + speakers we work from ---
    @app.get("/api/events")
    def events():
        return jsonify({"events": service.list_events()})

    @app.get("/api/events/<event_id>/speakers")
    def event_speakers(event_id):
        min_score = int(request.args.get("min_score", 0))
        return jsonify({"speakers": service.list_event_speakers(event_id, min_score=min_score)})

    # --- enrollment ---
    @app.post("/api/speakers/<speaker_id>/enroll")
    def enroll(speaker_id):
        body = request.get_json(silent=True) or {}
        return jsonify(service.enroll_speaker(speaker_id, regenerate=bool(body.get("regenerate"))))

    @app.post("/api/events/<event_id>/enroll-all")
    def enroll_all(event_id):
        min_score = int(request.args.get("min_score", 0))
        return jsonify(service.enroll_all_for_event(event_id, min_score=min_score))

    # --- sequences (Juicebox view) ---
    @app.get("/api/sequences")
    def sequences():
        return jsonify(service.list_sequences())

    @app.get("/api/sequences/<sequence_id>")
    def sequence(sequence_id):
        return jsonify(service.get_sequence(sequence_id))

    @app.post("/api/sequences/<sequence_id>/advance")
    def advance(sequence_id):
        return jsonify(service.advance_stage(sequence_id))

    @app.post("/api/sequences/<sequence_id>/stage")
    def set_stage(sequence_id):
        body = request.get_json(silent=True) or {}
        return jsonify(service.set_stage(sequence_id, body.get("stage", "")))

    @app.post("/api/emails/<email_id>/mark")
    def mark(email_id):
        body = request.get_json(silent=True) or {}
        return jsonify(service.mark_email(email_id, body.get("status", "")))

    # --- automation: generation + sending ---
    @app.post("/api/events/process")
    def process_events():
        """Run the generator once now: new events → sequences + scheduled emails."""
        return jsonify(automation.process_events())

    @app.get("/api/emails")
    def emails():
        """Email queue. Filters: ?sent=true|false&due=true&sequence_id=&event_id="""
        def _b(name):
            v = request.args.get(name)
            return None if v is None else v.lower() in ("1", "true", "yes")
        return jsonify(automation.list_emails(
            sent=_b("sent"), due=_b("due"),
            sequence_id=request.args.get("sequence_id"), event_id=request.args.get("event_id"),
        ))

    @app.post("/api/emails/<email_id>/send")
    def send_one(email_id):
        """Manually send ONE email now, ignoring its schedule."""
        return jsonify(automation.send_email(email_id))

    @app.post("/api/emails/send-due")
    def send_due():
        """Manually run one 'send all due emails' pass now."""
        return jsonify(automation.send_due())

    # --- funnel ---
    @app.get("/api/funnel")
    def funnel():
        return jsonify(service.funnel())

    return app


if __name__ == "__main__":
    create_app().run(host="0.0.0.0", port=config.PORT, debug=True)
