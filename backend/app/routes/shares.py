"""Shareable links: public resolve by token and revoke. Create/list live in okrs.py."""
import secrets
from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, jsonify
from app.db.mongodb import get_db
from app.routes.auth_backend import require_auth
from app.routes.okrs import _serialize_doc
from app.services.permissions import get_user_role, can_create_share_link
from bson import ObjectId

bp = Blueprint('shares', __name__)


def _now():
    return datetime.now(timezone.utc)


@bp.route('/shares/<token>', methods=['GET'])
def get_share_by_token(token):
    """Public: resolve share token to objective + key results. 404 if invalid or expired."""
    try:
        db = get_db()
        doc = db.share_links.find_one({'token': token})
        if not doc:
            return jsonify({'error': 'Share link not found'}), 404
        if doc.get('expiresAt') and doc['expiresAt'] < _now():
            return jsonify({'error': 'Share link expired'}), 410
        oid = doc.get('objectiveId')
        if not oid:
            return jsonify({'error': 'Invalid share link'}), 404
        obj = db.objectives.find_one({'_id': oid})
        if not obj:
            return jsonify({'error': 'Objective not found'}), 404
        krs = list(db.key_results.find({'objectiveId': oid}))
        out = {
            'objective': _serialize_doc(obj),
            'keyResults': [_serialize_doc(kr) for kr in krs],
        }
        scores = [kr.get('score') for kr in krs if kr.get('score') is not None]
        out['objective']['averageScore'] = round(sum(scores) / len(scores), 1) if scores else None
        return jsonify(out), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/share-links/<token>', methods=['DELETE'])
@require_auth
def revoke_share_link(token, user_id):
    """Revoke a share link. Creator or admin only."""
    try:
        db = get_db()
        doc = db.share_links.find_one({'token': token})
        if not doc:
            return jsonify({'error': 'Share link not found'}), 404
        if get_user_role(db, user_id) != 'admin' and doc.get('createdBy') != user_id:
            return jsonify({'error': 'Not allowed to revoke this link'}), 403
        db.share_links.delete_one({'token': token})
        return jsonify({'message': 'Share link revoked'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
