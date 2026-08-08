"""Incoming webhook: external systems POST to this URL with token for automation."""
from flask import Blueprint, request, jsonify
from app.db.mongodb import get_db

bp = Blueprint('webhooks', __name__)


@bp.route('/webhooks/incoming', methods=['POST', 'GET'])
def incoming_webhook():
    """
    Incoming webhook for automation (Zapier, Make, etc.). Requires ?token=<user_token>.
    GET: return 200 with usage hint. POST: accept JSON body; validate token; return 200.
    Payload schema (optional): { "action": "ping" } or { "objective": { "title": "...", "fiscalYear": 2024 } } to create.
    """
    token = request.args.get('token')
    if not token:
        return jsonify({'error': 'Missing token'}), 401
    db = get_db()
    doc = db.integration_configs.find_one({'incomingWebhookToken': token})
    if not doc:
        return jsonify({'error': 'Invalid token'}), 403
    user_id = doc['_id']

    if request.method == 'GET':
        return jsonify({
            'message': 'OK. POST JSON here with same token. Optional body: { "action": "ping" } or { "objective": { "title": "...", "fiscalYear": 2024 } }.',
        }), 200

    # POST
    try:
        data = request.get_json(silent=True) or {}
        action = data.get('action')
        if action == 'ping':
            return jsonify({'ok': True, 'message': 'pong'}), 200
        # Optional: create objective from payload
        if data.get('objective'):
            obj = data['objective']
            title = obj.get('title')
            fiscal_year = obj.get('fiscalYear')
            if not title or not fiscal_year:
                return jsonify({'error': 'objective.title and objective.fiscalYear required'}), 400
            from bson import ObjectId
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc)
            doc = {
                'title': title,
                'description': obj.get('description', ''),
                'ownerId': user_id,
                'level': obj.get('level', 'tactical'),
                'timeline': obj.get('timeline', 'quarterly'),
                'fiscalYear': int(fiscal_year),
                'quarter': obj.get('quarter'),
                'status': 'draft',
                'createdAt': now,
                'updatedAt': now,
            }
            result = db.objectives.insert_one(doc)
            doc['_id'] = result.inserted_id
            from app.routes.okrs import _serialize_doc
            return jsonify({'ok': True, 'objective': _serialize_doc(doc)}), 201
        return jsonify({'ok': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
