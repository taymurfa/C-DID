from flask import Blueprint, request, jsonify
from app.db.mongodb import get_db
from app.routes.auth_backend import require_auth
from app.repositories.okr_repo_factory import get_okr_repository, is_postgres_okr_repository
from app.services.permissions import (
    get_user_role,
    ROLE_VIEW_ONLY,
    can_view_objective,
    build_objective_visibility_query,
    can_submit_for_review,
    can_approve_reject,
    can_resubmit,
    can_reopen,
    can_edit_kr,
    can_edit_objective,
    can_delete_objective,
    can_create_share_link,
    can_create_objective,
)
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from bson.errors import InvalidId
import secrets
import os
import uuid

bp = Blueprint('okrs', __name__)


def _now():
    return datetime.now(timezone.utc)


def _serialize_doc(doc, date_fields=None):
    """Convert MongoDB doc to JSON-serializable dict (ObjectId and datetime to string)."""
    if doc is None:
        return None
    date_fields = date_fields or [
        'createdAt', 'updatedAt', 'lastUpdatedAt', 'timestamp', 'recordedAt', 'uploadedAt', 'deletedAt',
    ]
    out = dict(doc)
    if '_id' in out:
        out['_id'] = str(out['_id'])
    for k in list(out.keys()):
        if k in ('parentObjectiveId', 'objectiveId', 'departmentId', 'keyResultId', 'attachmentId') and out.get(k) is not None:
            out[k] = str(out[k])
        elif k == 'relatedObjectiveIds' and out.get(k) is not None:
            out[k] = [str(x) for x in out[k]]
        elif k in date_fields and out.get(k) is not None and hasattr(out[k], 'isoformat'):
            out[k] = out[k].isoformat()
    return out


def _parse_object_id(value, param_name='id'):
    try:
        return ObjectId(value)
    except InvalidId:
        return None


def _using_postgres_repo():
    return is_postgres_okr_repository()


def _parse_uuid_objective_id(value):
    """Normalize a Postgres/UUID objective id string, or None if invalid."""
    if value is None or not isinstance(value, str):
        return None
    s = value.strip()
    if not s:
        return None
    try:
        return str(uuid.UUID(s))
    except (ValueError, TypeError):
        return None


def _postgres_objective_norm_or_error(user_id, objective_id):
    """Returns (norm_id, None) or (None, (jsonify_response, status_code))."""
    norm = _parse_uuid_objective_id(objective_id)
    if norm is None:
        return None, (jsonify({'error': 'Invalid objective ID'}), 400)
    repo = get_okr_repository()
    doc = repo.get_objective(user_id, norm)
    if not doc:
        return None, (jsonify({'error': 'Objective not found'}), 404)
    return norm, None


# ---- Departments (for dashboard display: name, color) ----

@bp.route('/departments', methods=['GET'])
@require_auth
def list_departments(user_id):
    """List all departments (id, name, color) for dashboard and cards."""
    try:
        repo = get_okr_repository()
        items = repo.list_departments(user_id)
        return jsonify(items or []), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/departments', methods=['POST'])
@require_auth
def create_department(user_id):
    """Create a department (Mongo OKR store only). Postgres uses POST /api/orgs/:orgId/departments."""
    if _using_postgres_repo():
        return jsonify(
            {'error': 'Use POST /api/orgs/:orgId/departments with your organization id (Postgres).'}
        ), 400
    try:
        data = request.get_json(silent=True) or {}
        name = (data.get('name') or '').strip()
        if not name:
            return jsonify({'error': 'name is required'}), 400
        db = get_db()
        now = _now()
        doc = {'name': name, 'createdAt': now, 'updatedAt': now}
        result = db.departments.insert_one(doc)
        out = {'_id': str(result.inserted_id), 'name': name}
        return jsonify(out), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---- Objectives ----

@bp.route('/objectives', methods=['GET'])
@require_auth
def list_objectives(user_id):
    """List objectives with optional filters: fiscalYear, level, division, parentObjectiveId."""
    try:
        repo = get_okr_repository()
        q = {}
        fiscal_year = request.args.get('fiscalYear', type=int)
        if fiscal_year is not None:
            q['fiscalYear'] = fiscal_year
        level = request.args.get('level')
        if level:
            q['level'] = level
        division = request.args.get('division')
        if division:
            q['division'] = division
        status = request.args.get('status')
        if status:
            q['status'] = status
        owner_id = request.args.get('ownerId')
        if owner_id:
            q['ownerId'] = owner_id
        department_id = request.args.get('departmentId')
        if department_id:
            q['departmentId'] = department_id
        parent_id = request.args.get('parentObjectiveId')
        if parent_id:
            if _using_postgres_repo():
                q['parentObjectiveId'] = parent_id
            else:
                oid = _parse_object_id(parent_id)
                if oid is None:
                    return jsonify({'error': 'Invalid parentObjectiveId'}), 400
                q['parentObjectiveId'] = oid
        elif parent_id is not None and parent_id == '':
            if _using_postgres_repo():
                q["__no_parent__"] = True
            else:
                q['$or'] = [{'parentObjectiveId': None}, {'parentObjectiveId': {'$exists': False}}]

        if not _using_postgres_repo():
            # Enforce visibility in Mongo mode (Postgres RBAC is introduced in the next step).
            db = get_db()
            vis = build_objective_visibility_query(db, user_id)
            if vis:
                q = {'$and': [q, vis]} if q else vis

        items = repo.list_objectives(user_id, q)
        return jsonify(items or []), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/stats', methods=['GET'])
@require_auth
def objectives_stats(user_id):
    """Lightweight counts for sidebar: strategic, functional, tactical, keyResults. Optional fiscalYear."""
    try:
        fiscal_year = request.args.get('fiscalYear', type=int)
        if fiscal_year is None:
            fiscal_year = datetime.now(timezone.utc).year
        department_id = request.args.get('departmentId')

        if _using_postgres_repo():
            from sqlalchemy import and_, false, func, select
            from app.db.postgres import pg_session
            from app.models_sql import Objective, KeyResult
            from app.repositories.okr_repo_postgres import resolve_department_id_for_filter

            with pg_session() as s:
                base_filters = [Objective.fiscal_year == fiscal_year]
                if department_id:
                    dept_resolved = resolve_department_id_for_filter(s, department_id)
                    if dept_resolved:
                        base_filters.append(Objective.department_id == dept_resolved)
                    else:
                        base_filters.append(false())
                no_parent = Objective.parent_objective_id.is_(None)

                def count_level(level: str, require_no_parent: bool):
                    parts = [Objective.level == level, *base_filters]
                    if require_no_parent:
                        parts.append(no_parent)
                    return s.execute(select(func.count()).select_from(Objective).where(and_(*parts))).scalar() or 0

                strategic = count_level('strategic', True)
                functional = count_level('functional', True)
                tactical = count_level('tactical', False)

                oids = s.execute(select(Objective.id).where(and_(*base_filters))).scalars().all()
                if oids:
                    kr_count = (
                        s.execute(
                            select(func.count()).select_from(KeyResult).where(KeyResult.objective_id.in_(oids))
                        ).scalar()
                        or 0
                    )
                else:
                    kr_count = 0

            return jsonify({
                'strategic': strategic,
                'functional': functional,
                'tactical': tactical,
                'keyResults': kr_count,
            }), 200

        db = get_db()
        base = {'fiscalYear': fiscal_year}
        if department_id:
            base['departmentId'] = department_id
        no_parent = {'$or': [{'parentObjectiveId': None}, {'parentObjectiveId': {'$exists': False}}]}
        strategic = db.objectives.count_documents({**base, 'level': 'strategic', **no_parent})
        functional = db.objectives.count_documents({**base, 'level': 'functional', **no_parent})
        tactical = db.objectives.count_documents({**base, 'level': 'tactical'})
        oids = [d['_id'] for d in db.objectives.find(base, {'_id': 1})]
        kr_count = db.key_results.count_documents({'objectiveId': {'$in': oids}}) if oids else 0
        return jsonify({
            'strategic': strategic,
            'functional': functional,
            'tactical': tactical,
            'keyResults': kr_count,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def _build_objectives_query():
    """Build the same query dict as list_objectives (from request args). Returns (q, error_response)."""
    q = {}
    fiscal_year = request.args.get('fiscalYear', type=int)
    if fiscal_year is not None:
        q['fiscalYear'] = fiscal_year
    level = request.args.get('level')
    if level:
        q['level'] = level
    division = request.args.get('division')
    if division:
        q['division'] = division
    status = request.args.get('status')
    if status:
        q['status'] = status
    owner_id = request.args.get('ownerId')
    if owner_id:
        q['ownerId'] = owner_id
    department_id = request.args.get('departmentId')
    if department_id:
        q['departmentId'] = department_id
    parent_id = request.args.get('parentObjectiveId')
    if parent_id:
        oid = _parse_object_id(parent_id)
        if oid is None:
            return None, (jsonify({'error': 'Invalid parentObjectiveId'}), 400)
        q['parentObjectiveId'] = oid
    elif parent_id is not None and parent_id == '':
        q['$or'] = [{'parentObjectiveId': None}, {'parentObjectiveId': {'$exists': False}}]
    return q, None


@bp.route('/objectives/export', methods=['GET'])
@require_auth
def export_objectives(user_id):
    """Export OKRs as JSON (API dump), Excel, or PDF. Same filters as list_objectives. view_only cannot export."""
    try:
        db = get_db()
        if get_user_role(db, user_id) == ROLE_VIEW_ONLY:
            return jsonify({'error': 'View-only users cannot export'}), 403
        fmt = request.args.get('format', 'json').lower()
        if fmt == 'json':
            q, err = _build_objectives_query()
            if err is not None:
                return err
            cursor = db.objectives.find(q).sort('createdAt', -1)
            objectives = list(cursor)
            tree_mode = request.args.get('tree', '').lower() in ('1', 'true', 'yes')
            if tree_mode:
                # Build trees: roots are objectives with no parent or parent not in result set
                id_set = {doc['_id'] for doc in objectives}
                roots = [d for d in objectives if not d.get('parentObjectiveId') or d.get('parentObjectiveId') not in id_set]

                def build_node(obj_doc):
                    node = _serialize_doc(obj_doc)
                    node_id = obj_doc['_id']
                    children = list(db.objectives.find({'parentObjectiveId': node_id}))
                    node['children'] = [build_node(c) for c in children]
                    krs = list(db.key_results.find({'objectiveId': node_id}))
                    node['keyResults'] = [_serialize_doc(kr) for kr in krs]
                    scores = [kr.get('score') for kr in krs if kr.get('score') is not None]
                    node['averageScore'] = round(sum(scores) / len(scores), 1) if scores else None
                    return node

                trees = [build_node(r) for r in roots]
                return jsonify({'trees': trees}), 200
            # Flat: objectives with keyResults each
            out = []
            for doc in objectives:
                ser = _serialize_doc(doc)
                krs = list(db.key_results.find({'objectiveId': doc['_id']}))
                ser['keyResults'] = [_serialize_doc(kr) for kr in krs]
                scores = [kr.get('score') for kr in krs if kr.get('score') is not None]
                ser['averageScore'] = round(sum(scores) / len(scores), 1) if scores else None
                out.append(ser)
            return jsonify({'objectives': out}), 200
        if fmt == 'xlsx':
            from flask import send_file
            import io
            try:
                from app.services.export_xlsx import build_okr_workbook
            except ImportError:
                return jsonify({'error': 'Excel export not available'}), 501
            q, err = _build_objectives_query()
            if err is not None:
                return err
            objectives = list(db.objectives.find(q).sort('createdAt', -1))
            buf = io.BytesIO()
            build_okr_workbook(db, objectives, buf)
            buf.seek(0)
            return send_file(buf, mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', as_attachment=True, download_name='okrs_export.xlsx')
        if fmt == 'pdf':
            from flask import send_file
            import io
            try:
                from app.services.export_pdf import build_okr_pdf
            except ImportError:
                return jsonify({'error': 'PDF export not available'}), 501
            q, err = _build_objectives_query()
            if err is not None:
                return err
            objectives = list(db.objectives.find(q).sort('createdAt', -1))
            buf = io.BytesIO()
            build_okr_pdf(db, objectives, buf)
            buf.seek(0)
            return send_file(buf, mimetype='application/pdf', as_attachment=True, download_name='okrs_export.pdf')
        return jsonify({'error': 'Unsupported format. Use json, xlsx, or pdf'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/export-pptx', methods=['POST'])
@require_auth
def export_objectives_pptx(user_id):
    """Export selected objectives as a PowerPoint file. Body: { objectiveIds: string[] }. view_only cannot export."""
    try:
        from flask import send_file
        import io
        db = get_db()
        if get_user_role(db, user_id) == ROLE_VIEW_ONLY:
            return jsonify({'error': 'View-only users cannot export'}), 403
        data = request.get_json() or {}
        objective_ids = data.get('objectiveIds') or []
        if not isinstance(objective_ids, list):
            objective_ids = []
        narrative = data.get('narrative')
        if narrative is not None and not isinstance(narrative, str):
            narrative = None
        try:
            from app.services.export_pptx import build_okr_pptx
        except ImportError:
            return jsonify({'error': 'PowerPoint export not available'}), 501
        buf = io.BytesIO()
        build_okr_pptx(db, objective_ids, buf, narrative=narrative)
        buf.seek(0)
        return send_file(
            buf,
            mimetype='application/vnd.openxmlformats-officedocument.presentationml.presentation',
            as_attachment=True,
            download_name='okr_presentation.pptx',
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/generate-presentation-story', methods=['POST'])
@require_auth
def generate_presentation_story(user_id):
    """Generate a professional OKR presentation narrative using OpenRouter. Body: { objectiveIds: string[] }."""
    try:
        import requests
        db = get_db()
        if get_user_role(db, user_id) == ROLE_VIEW_ONLY:
            return jsonify({'error': 'View-only users cannot use this feature'}), 403
        data = request.get_json() or {}
        objective_ids = data.get('objectiveIds') or []
        if not isinstance(objective_ids, list):
            objective_ids = []
        api_key = os.getenv('OPENROUTER_API_KEY')
        if not api_key:
            return jsonify({
                'error': 'OpenRouter API key is not configured. Set OPENROUTER_API_KEY to generate AI narratives.'
            }), 503

        # Build OKR summary text for the model
        parts = []
        for oid_str in objective_ids[:30]:  # cap for token safety
            oid = _parse_object_id(oid_str)
            if not oid:
                continue
            obj = db.objectives.find_one({'_id': oid})
            if not obj:
                continue
            krs = list(db.key_results.find({'objectiveId': oid}))
            title = (obj.get('title') or 'Untitled')[:500]
            desc = (obj.get('description') or '')[:300]
            status = obj.get('status') or 'draft'
            level = obj.get('level') or ''
            parts.append(f"Objective: {title}")
            if desc:
                parts.append(f"  Description: {desc}")
            parts.append(f"  Level: {level} | Status: {status}")
            for kr in krs[:8]:
                kr_title = (kr.get('title') or '')[:200]
                score = kr.get('score')
                pct = f" {int((score or 0) * 100)}%" if score is not None else " no score"
                parts.append(f"  - {kr_title}{pct}")
            parts.append('')

        if not parts:
            return jsonify({'error': 'No valid objectives found to summarize'}), 400

        summary = '\n'.join(parts).strip()
        system_prompt = (
            "You are an executive communications expert. Your task is to write a short, professional narrative "
            "for an OKR review presentation. Use the provided objectives and key results to tell a coherent story: "
            "highlight progress, themes, and outcomes in 2–4 concise paragraphs. Tone: confident, clear, and "
            "business-appropriate. Do not use bullet points; write flowing prose suitable for speaking or reading aloud."
        )
        payload = {
            'model': 'openai/gpt-4o-mini',
            'messages': [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': f"Write the OKR presentation narrative based on this summary:\n\n{summary}"},
            ],
        }
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}',
            'HTTP-Referer': request.headers.get('Origin', ''),
            'X-Title': 'OKR Presentation Story',
        }
        response = requests.post(
            'https://openrouter.ai/api/v1/chat/completions',
            headers=headers,
            json=payload,
            timeout=45,
        )
        if not response.ok:
            err = response.json() if response.content else {}
            err_obj = err.get('error')
            if isinstance(err_obj, dict):
                msg = err_obj.get('message', response.reason)
            else:
                msg = str(err_obj) if err_obj else response.reason
            return jsonify({'error': f'AI service error: {msg}'}), response.status_code
        result = response.json()
        if 'choices' not in result or not result['choices']:
            return jsonify({'error': 'No response from AI service'}), 502
        story = (result['choices'][0].get('message', {}) or {}).get('content', '').strip()
        if not story:
            return jsonify({'error': 'Empty narrative from AI'}), 502
        return jsonify({'story': story}), 200
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Network error: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/<objective_id>', methods=['GET'])
@require_auth
def get_objective(objective_id, user_id):
    """Get a single objective by ID. Optional ?since=ISO8601 returns 304-style unchanged if no updates."""
    try:
        repo = get_okr_repository()
        if _using_postgres_repo():
            doc = repo.get_objective(user_id, objective_id)
            if not doc:
                return jsonify({'error': 'Objective not found'}), 404
            return jsonify(doc), 200

        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        db = get_db()
        doc = db.objectives.find_one({'_id': oid})
        if not doc:
            return jsonify({'error': 'Objective not found'}), 404
        if not can_view_objective(db, user_id, doc):
            return jsonify({'error': 'Not allowed to view this objective'}), 403
        since = request.args.get('since')
        if since:
            try:
                since_dt = datetime.fromisoformat(since.replace('Z', '+00:00'))
                if since_dt.tzinfo is None:
                    since_dt = since_dt.replace(tzinfo=timezone.utc)
            except (ValueError, TypeError):
                since_dt = None
            if since_dt:
                def _as_utc(d):
                    if d is None or not hasattr(d, 'replace'):
                        return None
                    return d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d
                obj_updated = _as_utc(doc.get('updatedAt'))
                latest = obj_updated
                for kr in db.key_results.find({'objectiveId': oid}, {'lastUpdatedAt': 1}):
                    lu = _as_utc(kr.get('lastUpdatedAt'))
                    if lu and (latest is None or lu > latest):
                        latest = lu
                if latest is not None and latest <= since_dt:
                    return jsonify({'unchanged': True}), 200
        return jsonify(_serialize_doc(doc)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---- Presence (viewers) ----
PRESENCE_TTL_SECONDS = 60


def _get_recent_viewers(db, objective_oid):
    """Return list of presence docs for objective with lastSeenAt within PRESENCE_TTL_SECONDS."""
    from datetime import timedelta
    cutoff = _now() - timedelta(seconds=PRESENCE_TTL_SECONDS)
    cursor = db.presence.find({'objectiveId': objective_oid, 'lastSeenAt': {'$gte': cutoff}})
    return list(cursor)


@bp.route('/objectives/<objective_id>/view', methods=['POST'])
@require_auth
def post_view(objective_id, user_id):
    """Register or refresh presence for this user viewing this objective. Returns current viewers."""
    try:
        db = get_db()
        if _using_postgres_repo():
            norm, err = _postgres_objective_norm_or_error(user_id, objective_id)
            if err:
                return err
            oid = norm
        else:
            oid = _parse_object_id(objective_id)
            if oid is None:
                return jsonify({'error': 'Invalid objective ID'}), 400
            if not db.objectives.find_one({'_id': oid}):
                return jsonify({'error': 'Objective not found'}), 404
        data = request.get_json() or {}
        user_name = data.get('userName') or user_id
        now = _now()
        db.presence.update_one(
            {'objectiveId': oid, 'userId': user_id},
            {'$set': {'objectiveId': oid, 'userId': user_id, 'userName': user_name, 'lastSeenAt': now}},
            upsert=True
        )
        viewers = _get_recent_viewers(db, oid)
        out = [
            {'userId': v['userId'], 'userName': v.get('userName') or v['userId']}
            for v in viewers
        ]
        return jsonify({'viewers': out, 'count': len(out)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/<objective_id>/leave', methods=['POST'])
@require_auth
def post_leave(objective_id, user_id):
    """Remove this user's presence for this objective."""
    try:
        db = get_db()
        if _using_postgres_repo():
            norm, err = _postgres_objective_norm_or_error(user_id, objective_id)
            if err:
                return err
            oid = norm
        else:
            oid = _parse_object_id(objective_id)
            if oid is None:
                return jsonify({'error': 'Invalid objective ID'}), 400
        db.presence.delete_one({'objectiveId': oid, 'userId': user_id})
        return jsonify({'message': 'Left'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives', methods=['POST'])
@require_auth
def create_objective(user_id):
    """Create a new objective."""
    try:
        from app.services.permissions import can_create_objective

        db = get_db()
        if not can_create_objective(db, user_id):
            return jsonify({
                'error': (
                    'Creating objectives is disabled for your account. '
                    'Ask an administrator to update your access in User management.'
                ),
            }), 403

        repo = get_okr_repository()
        if _using_postgres_repo():
            data = request.get_json() or {}
            title = data.get('title')
            if not title:
                return jsonify({'error': 'Title is required'}), 400
            fiscal_year = data.get('fiscalYear')
            if fiscal_year is None:
                return jsonify({'error': 'fiscalYear is required'}), 400
            # orgId: accept body or bootstrap default org + membership (same as GET /api/orgs)
            if not (data.get("orgId") or data.get("org_id")):
                from app.services.org_bootstrap import ensure_user_default_org_id

                org_id = ensure_user_default_org_id(user_id)
                if org_id:
                    data = {**data, "orgId": org_id}
                else:
                    return jsonify({
                        'error': (
                            'orgId is required (Postgres is not configured or could not provision an organization).'
                        ),
                    }), 400
            created = repo.create_objective(user_id, data)
            return jsonify(created), 201

        data = request.get_json() or {}
        title = data.get('title')
        if not title:
            return jsonify({'error': 'Title is required'}), 400
        level = data.get('level', 'strategic')
        timeline = data.get('timeline', 'annual')
        fiscal_year = data.get('fiscalYear')
        if fiscal_year is None:
            return jsonify({'error': 'fiscalYear is required'}), 400

        parent_id = data.get('parentObjectiveId')
        parent_oid = None
        if parent_id:
            parent_oid = _parse_object_id(parent_id)
            if parent_oid is None:
                return jsonify({'error': 'Invalid parentObjectiveId'}), 400

        now = datetime.utcnow()
        doc = {
            'title': title,
            'description': data.get('description', ''),
            'ownerId': data.get('ownerId', user_id),
            'level': level,
            'timeline': timeline,
            'fiscalYear': fiscal_year,
            'quarter': data.get('quarter'),
            'parentObjectiveId': parent_oid,
            'division': data.get('division'),
            'status': data.get('status', 'draft'),
            'departmentId': data.get('departmentId'),
            'relatedObjectiveIds': [],
            'createdAt': now,
            'updatedAt': now,
        }
        if data.get('relatedObjectiveIds'):
            oids = [_parse_object_id(x) for x in data['relatedObjectiveIds'] if _parse_object_id(x)]
            doc['relatedObjectiveIds'] = oids
        result = db.objectives.insert_one(doc)
        doc['_id'] = result.inserted_id
        return jsonify(_serialize_doc(doc)), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/<objective_id>', methods=['PUT'])
@require_auth
def update_objective(objective_id, user_id):
    """Update an existing objective."""
    try:
        repo = get_okr_repository()
        if _using_postgres_repo():
            data = request.get_json() or {}
            updated = repo.update_objective(user_id, objective_id, data)
            if not updated:
                return jsonify({'error': 'Objective not found'}), 404
            return jsonify(updated), 200

        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        data = request.get_json() or {}
        db = get_db()
        existing = db.objectives.find_one({'_id': oid})
        if not existing:
            return jsonify({'error': 'Objective not found'}), 404
        if get_user_role(db, user_id) == 'view_only' or not can_edit_objective(db, user_id, existing):
            return jsonify({'error': 'Not allowed to edit this objective'}), 403

        update = {'updatedAt': _now()}
        for key in (
            'title', 'description', 'ownerId', 'level', 'timeline', 'fiscalYear', 'quarter', 'division', 'status',
            'departmentId', 'nextReviewDate', 'latestUpdateSummary',
        ):
            if key in data:
                update[key] = data[key]
        if 'relatedObjectiveIds' in data:
            ids = data['relatedObjectiveIds']
            if isinstance(ids, list):
                update['relatedObjectiveIds'] = [_parse_object_id(x) for x in ids if _parse_object_id(x)]
            else:
                update['relatedObjectiveIds'] = []
        if 'parentObjectiveId' in data:
            if data['parentObjectiveId'] is None or data['parentObjectiveId'] == '':
                update['parentObjectiveId'] = None
            else:
                poid = _parse_object_id(data['parentObjectiveId'])
                if poid is None:
                    return jsonify({'error': 'Invalid parentObjectiveId'}), 400
                update['parentObjectiveId'] = poid

        db.objectives.update_one({'_id': oid}, {'$set': update})
        updated = db.objectives.find_one({'_id': oid})
        return jsonify(_serialize_doc(updated)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/<objective_id>', methods=['DELETE'])
@require_auth
def delete_objective(objective_id, user_id):
    """Delete an objective and its key results."""
    try:
        repo = get_okr_repository()
        if _using_postgres_repo():
            ok = repo.delete_objective(user_id, objective_id)
            if not ok:
                return jsonify({'error': 'Objective not found'}), 404
            return jsonify({'message': 'Objective deleted'}), 200

        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        db = get_db()
        existing = db.objectives.find_one({'_id': oid})
        if not existing:
            return jsonify({'error': 'Objective not found'}), 404
        if not can_delete_objective(db, user_id, existing):
            return jsonify({'error': 'Not allowed to delete this objective'}), 403
        db.key_results.delete_many({'objectiveId': oid})
        db.objectives.delete_one({'_id': oid})
        return jsonify({'message': 'Objective deleted'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---- Share links ----

def _share_link_serialize(doc):
    out = _serialize_doc(doc, date_fields=['createdAt', 'expiresAt'])
    if out and 'objectiveId' in out:
        out['objectiveId'] = str(out['objectiveId'])
    return out


@bp.route('/objectives/<objective_id>/share-links', methods=['POST'])
@require_auth
def create_share_link(objective_id, user_id):
    """Create a shareable link for this objective. Body: { expiresInDays? }."""
    try:
        db = get_db()
        if _using_postgres_repo():
            repo = get_okr_repository()
            norm, err = _postgres_objective_norm_or_error(user_id, objective_id)
            if err:
                return err
            obj = repo.get_objective(user_id, norm)
            oid = norm
        else:
            oid = _parse_object_id(objective_id)
            if oid is None:
                return jsonify({'error': 'Invalid objective ID'}), 400
            obj = db.objectives.find_one({'_id': oid})
            if not obj:
                return jsonify({'error': 'Objective not found'}), 404
        if not can_create_share_link(db, user_id, obj):
            return jsonify({'error': 'Not allowed to create share link for this objective'}), 403
        data = request.get_json() or {}
        try:
            expires_in_days = int(data.get('expiresInDays') or 0) or None
        except (TypeError, ValueError):
            expires_in_days = None
        now = _now()
        expires_at = (now + timedelta(days=expires_in_days)) if expires_in_days else None
        token = secrets.token_urlsafe(24)
        frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000').rstrip('/')
        url = f'{frontend_url}/share/{token}'
        doc = {
            'token': token,
            'objectiveId': oid,
            'createdBy': user_id,
            'createdAt': now,
            'expiresAt': expires_at,
            'permission': 'view',
        }
        db.share_links.insert_one(doc)
        return jsonify({
            'token': token,
            'url': url,
            'expiresAt': expires_at.isoformat() if expires_at else None,
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/<objective_id>/share-links', methods=['GET'])
@require_auth
def list_share_links(objective_id, user_id):
    """List share links for this objective. Creator or admin only."""
    try:
        db = get_db()
        if _using_postgres_repo():
            repo = get_okr_repository()
            norm, err = _postgres_objective_norm_or_error(user_id, objective_id)
            if err:
                return err
            obj = repo.get_objective(user_id, norm)
            oid = norm
        else:
            oid = _parse_object_id(objective_id)
            if oid is None:
                return jsonify({'error': 'Invalid objective ID'}), 400
            obj = db.objectives.find_one({'_id': oid})
            if not obj:
                return jsonify({'error': 'Objective not found'}), 404
        if not can_create_share_link(db, user_id, obj):
            return jsonify({'error': 'Not allowed to list share links for this objective'}), 403
        cursor = db.share_links.find({'objectiveId': oid}).sort('createdAt', -1)
        items = [_share_link_serialize(d) for d in cursor]
        frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000').rstrip('/')
        for item in items:
            item['url'] = f"{frontend_url}/share/{item.get('token', '')}"
        return jsonify(items), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/<objective_id>/post-update', methods=['POST'])
@require_auth
def post_update_to_channel(objective_id, user_id):
    """Manual 'Post Update': send current objective summary to configured Slack/Teams webhook."""
    try:
        db = get_db()
        if _using_postgres_repo():
            repo = get_okr_repository()
            norm, err = _postgres_objective_norm_or_error(user_id, objective_id)
            if err:
                return err
            obj = repo.get_objective(user_id, norm)
        else:
            oid = _parse_object_id(objective_id)
            if oid is None:
                return jsonify({'error': 'Invalid objective ID'}), 400
            obj = db.objectives.find_one({'_id': oid})
            if not obj:
                return jsonify({'error': 'Objective not found'}), 404
        cfg = db.integration_configs.find_one({'_id': user_id})
        if not cfg or not cfg.get('webhookUrl'):
            return jsonify({'error': 'No Slack/Teams webhook configured. Add one in Integrations.'}), 400
        from app.services.notifications import post_okr_update_to_webhook, format_okr_update_message
        title = obj.get('title') or 'OKR'
        status = obj.get('status') or 'draft'
        payload = format_okr_update_message(title, status, actor_name='', event_type='manual')
        ok = post_okr_update_to_webhook(cfg['webhookUrl'], cfg.get('channelType') or 'slack', payload)
        if not ok:
            return jsonify({'error': 'Failed to send message to webhook'}), 502
        return jsonify({'message': 'Update posted to channel'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/<objective_id>/workflow-history', methods=['GET'])
@require_auth
def get_workflow_history(objective_id, user_id):
    """List workflow events for an objective (audit trail)."""
    try:
        db = get_db()
        if _using_postgres_repo():
            norm, err = _postgres_objective_norm_or_error(user_id, objective_id)
            if err:
                return err
            oid = norm
        else:
            oid = _parse_object_id(objective_id)
            if oid is None:
                return jsonify({'error': 'Invalid objective ID'}), 400
            if not db.objectives.find_one({'_id': oid}):
                return jsonify({'error': 'Objective not found'}), 404
        cursor = db.workflow_events.find({'objectiveId': oid}).sort('timestamp', -1)
        items = [_serialize_doc(d) for d in cursor]
        return jsonify(items), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def _objective_with_score(db, doc):
    """Return serialized objective with averageScore from key results."""
    out = _serialize_doc(doc)
    krs = list(db.key_results.find({'objectiveId': doc['_id']}))
    scores = [kr.get('score') for kr in krs if kr.get('score') is not None]
    out['averageScore'] = round(sum(scores) / len(scores), 2) if scores else None
    return out


def _dependency_health_get(health_map, target_oid):
    """Read float health (0–1) for a related objective id from a dependencyHealth subdocument."""
    if not health_map or target_oid is None:
        return None
    key = str(target_oid)
    if key in health_map:
        try:
            return float(health_map[key])
        except (TypeError, ValueError):
            return None
    for k, val in health_map.items():
        if str(k) == key:
            try:
                return float(val)
            except (TypeError, ValueError):
                return None
    return None


@bp.route('/objectives/<objective_id>/dependencies', methods=['GET'])
@require_auth
def get_dependencies(objective_id, user_id):
    """Return upstream (this relates to) and downstream (what depends on this) objectives."""
    try:
        if _using_postgres_repo():
            _, err = _postgres_objective_norm_or_error(user_id, objective_id)
            if err:
                return err
            return jsonify({'upstream': [], 'downstream': []}), 200

        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        db = get_db()
        obj = db.objectives.find_one({'_id': oid})
        if not obj:
            return jsonify({'error': 'Objective not found'}), 404
        related_ids = obj.get('relatedObjectiveIds') or []
        health = obj.get('dependencyHealth') or {}
        upstream = []
        for rid in related_ids:
            doc = db.objectives.find_one({'_id': rid})
            if doc:
                row = _objective_with_score(db, doc)
                lh = _dependency_health_get(health, rid)
                if lh is not None:
                    row['linkHealth'] = lh
                upstream.append(row)
        downstream_docs = list(db.objectives.find({'relatedObjectiveIds': oid}))
        downstream = []
        for d in downstream_docs:
            row = _objective_with_score(db, d)
            child_health = d.get('dependencyHealth') or {}
            lh = _dependency_health_get(child_health, oid)
            if lh is not None:
                row['linkHealth'] = lh
            downstream.append(row)
        return jsonify({'upstream': upstream, 'downstream': downstream}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/<objective_id>/dependency-health', methods=['PATCH'])
@require_auth
def patch_dependency_health(objective_id, user_id):
    """Set or clear subjective dependency health (0–1, one decimal) for a linked OKR."""
    try:
        if _using_postgres_repo():
            repo = get_okr_repository()
            norm, err = _postgres_objective_norm_or_error(user_id, objective_id)
            if err:
                return err
            db = get_db()
            owner = repo.get_objective(user_id, norm)
            if get_user_role(db, user_id) == 'view_only' or not can_edit_objective(db, user_id, owner):
                return jsonify({'error': 'Not allowed to edit this objective'}), 403
            return jsonify(owner), 200

        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        body = request.get_json() or {}
        related_raw = body.get('relatedObjectiveId')
        score = body.get('score')
        related_oid = _parse_object_id(related_raw) if related_raw else None
        if related_oid is None:
            return jsonify({'error': 'relatedObjectiveId is required'}), 400
        db = get_db()
        owner = db.objectives.find_one({'_id': oid})
        if not owner:
            return jsonify({'error': 'Objective not found'}), 404
        if get_user_role(db, user_id) == 'view_only' or not can_edit_objective(db, user_id, owner):
            return jsonify({'error': 'Not allowed to edit this objective'}), 403
        related_doc = db.objectives.find_one({'_id': related_oid})
        if not related_doc:
            return jsonify({'error': 'Related objective not found'}), 404
        owner_related = list(owner.get('relatedObjectiveIds') or [])
        child_related = list(related_doc.get('relatedObjectiveIds') or [])
        linked = (related_oid in owner_related) or (oid in child_related)
        if not linked:
            return jsonify({'error': 'Objectives are not linked as dependencies'}), 400

        now = _now()
        field_key = 'dependencyHealth.%s' % str(related_oid)
        if score is None:
            db.objectives.update_one(
                {'_id': oid},
                {'$unset': {field_key: ''}, '$set': {'updatedAt': now}},
            )
        else:
            try:
                s = float(score)
            except (TypeError, ValueError):
                return jsonify({'error': 'score must be a number between 0 and 1'}), 400
            s = max(0.0, min(1.0, s))
            s = round(s * 10) / 10.0
            db.objectives.update_one(
                {'_id': oid},
                {'$set': {field_key: s, 'updatedAt': now}},
            )
        updated = db.objectives.find_one({'_id': oid})
        return jsonify(_serialize_doc(updated)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def _workflow_transition(objective_id, user_id, from_status, to_status, reason=None):
    """Update objective status and log WorkflowEvent. Returns (response, status_code)."""
    db = get_db()
    if _using_postgres_repo():
        norm = _parse_uuid_objective_id(objective_id)
        if norm is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        repo = get_okr_repository()
        obj = repo.get_objective(user_id, norm)
        if not obj:
            return jsonify({'error': 'Objective not found'}), 404
        current = obj.get('status', 'draft')
        if current != from_status:
            return jsonify({'error': f'Objective is not in {from_status} state'}), 400
        now = _now()
        db.workflow_events.insert_one({
            'objectiveId': norm,
            'fromStatus': from_status,
            'toStatus': to_status,
            'actorId': user_id,
            'reason': reason,
            'timestamp': now,
        })
        updated = repo.update_objective(user_id, norm, {'status': to_status})
        try:
            cfg = db.integration_configs.find_one({'_id': user_id})
            if cfg and cfg.get('webhookUrl'):
                from app.services.notifications import post_okr_update_to_webhook, format_okr_update_message
                title = (updated or obj).get('title') or 'OKR'
                payload = format_okr_update_message(title, to_status, actor_name='', event_type='workflow')
                post_okr_update_to_webhook(cfg['webhookUrl'], cfg.get('channelType') or 'slack', payload)
        except Exception:
            pass
        return jsonify(updated or obj), 200

    oid = _parse_object_id(objective_id)
    if oid is None:
        return jsonify({'error': 'Invalid objective ID'}), 400
    obj = db.objectives.find_one({'_id': oid})
    if not obj:
        return jsonify({'error': 'Objective not found'}), 404
    current = obj.get('status', 'draft')
    if current != from_status:
        return jsonify({'error': f'Objective is not in {from_status} state'}), 400
    now = _now()
    db.workflow_events.insert_one({
        'objectiveId': oid,
        'fromStatus': from_status,
        'toStatus': to_status,
        'actorId': user_id,
        'reason': reason,
        'timestamp': now,
    })
    db.objectives.update_one({'_id': oid}, {'$set': {'status': to_status, 'updatedAt': now}})
    updated = db.objectives.find_one({'_id': oid})
    try:
        cfg = db.integration_configs.find_one({'_id': user_id})
        if cfg and cfg.get('webhookUrl'):
            from app.services.notifications import post_okr_update_to_webhook, format_okr_update_message
            title = updated.get('title') or 'OKR'
            payload = format_okr_update_message(title, to_status, actor_name='', event_type='workflow')
            post_okr_update_to_webhook(cfg['webhookUrl'], cfg.get('channelType') or 'slack', payload)
    except Exception:
        pass
    return jsonify(_serialize_doc(updated)), 200


@bp.route('/objectives/<objective_id>/submit', methods=['POST'])
@require_auth
def submit_objective(objective_id, user_id):
    """DRAFT -> IN_REVIEW. Allowed: owner, leader, admin."""
    try:
        db = get_db()
        if _using_postgres_repo():
            norm, err = _postgres_objective_norm_or_error(user_id, objective_id)
            if err:
                return err
            repo = get_okr_repository()
            obj = repo.get_objective(user_id, norm)
            if obj.get('status') != 'draft':
                return jsonify({'error': 'Objective is not in draft state'}), 400
            if not can_submit_for_review(db, user_id, obj):
                return jsonify({'error': 'Not allowed to submit for review'}), 403
            return _workflow_transition(objective_id, user_id, 'draft', 'in_review')

        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        obj = db.objectives.find_one({'_id': oid})
        if not obj:
            return jsonify({'error': 'Objective not found'}), 404
        if obj.get('status') != 'draft':
            return jsonify({'error': 'Objective is not in draft state'}), 400
        if not can_submit_for_review(db, user_id, obj):
            return jsonify({'error': 'Not allowed to submit for review'}), 403
        return _workflow_transition(objective_id, user_id, 'draft', 'in_review')
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/<objective_id>/approve', methods=['POST'])
@require_auth
def approve_objective(objective_id, user_id):
    """IN_REVIEW -> APPROVED. Allowed: leader (same dept), admin."""
    try:
        db = get_db()
        if _using_postgres_repo():
            norm, err = _postgres_objective_norm_or_error(user_id, objective_id)
            if err:
                return err
            repo = get_okr_repository()
            obj = repo.get_objective(user_id, norm)
            if obj.get('status') != 'in_review':
                return jsonify({'error': 'Objective is not in review'}), 400
            if not can_approve_reject(db, user_id, obj):
                return jsonify({'error': 'Not allowed to approve'}), 403
            return _workflow_transition(objective_id, user_id, 'in_review', 'approved')

        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        obj = db.objectives.find_one({'_id': oid})
        if not obj:
            return jsonify({'error': 'Objective not found'}), 404
        if obj.get('status') != 'in_review':
            return jsonify({'error': 'Objective is not in review'}), 400
        if not can_approve_reject(db, user_id, obj):
            return jsonify({'error': 'Not allowed to approve'}), 403
        return _workflow_transition(objective_id, user_id, 'in_review', 'approved')
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/<objective_id>/reject', methods=['POST'])
@require_auth
def reject_objective(objective_id, user_id):
    """IN_REVIEW -> REJECTED. Allowed: leader (same dept), admin. Body: { reason? }."""
    try:
        db = get_db()
        data = request.get_json() or {}
        reason = data.get('reason', '')
        if _using_postgres_repo():
            norm, err = _postgres_objective_norm_or_error(user_id, objective_id)
            if err:
                return err
            repo = get_okr_repository()
            obj = repo.get_objective(user_id, norm)
            if obj.get('status') != 'in_review':
                return jsonify({'error': 'Objective is not in review'}), 400
            if not can_approve_reject(db, user_id, obj):
                return jsonify({'error': 'Not allowed to reject'}), 403
            return _workflow_transition(objective_id, user_id, 'in_review', 'rejected', reason=reason)

        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        obj = db.objectives.find_one({'_id': oid})
        if not obj:
            return jsonify({'error': 'Objective not found'}), 404
        if obj.get('status') != 'in_review':
            return jsonify({'error': 'Objective is not in review'}), 400
        if not can_approve_reject(db, user_id, obj):
            return jsonify({'error': 'Not allowed to reject'}), 403
        return _workflow_transition(objective_id, user_id, 'in_review', 'rejected', reason=reason)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/<objective_id>/resubmit', methods=['POST'])
@require_auth
def resubmit_objective(objective_id, user_id):
    """REJECTED -> IN_REVIEW. Allowed: owner, admin."""
    try:
        db = get_db()
        if _using_postgres_repo():
            norm, err = _postgres_objective_norm_or_error(user_id, objective_id)
            if err:
                return err
            repo = get_okr_repository()
            obj = repo.get_objective(user_id, norm)
            if obj.get('status') != 'rejected':
                return jsonify({'error': 'Objective is not rejected'}), 400
            if not can_resubmit(db, user_id, obj):
                return jsonify({'error': 'Not allowed to resubmit'}), 403
            return _workflow_transition(objective_id, user_id, 'rejected', 'in_review')

        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        obj = db.objectives.find_one({'_id': oid})
        if not obj:
            return jsonify({'error': 'Objective not found'}), 404
        if obj.get('status') != 'rejected':
            return jsonify({'error': 'Objective is not rejected'}), 400
        if not can_resubmit(db, user_id, obj):
            return jsonify({'error': 'Not allowed to resubmit'}), 403
        return _workflow_transition(objective_id, user_id, 'rejected', 'in_review')
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/<objective_id>/reopen', methods=['POST'])
@require_auth
def reopen_objective(objective_id, user_id):
    """APPROVED or REJECTED -> DRAFT. Allowed: admin only. Body: { reason? }."""
    try:
        db = get_db()
        data = request.get_json() or {}
        reason = data.get('reason', '')
        if _using_postgres_repo():
            norm, err = _postgres_objective_norm_or_error(user_id, objective_id)
            if err:
                return err
            repo = get_okr_repository()
            obj = repo.get_objective(user_id, norm)
            status = (obj.get('status') or '').lower()
            if status not in ('approved', 'rejected'):
                return jsonify({'error': 'Objective can only be reopened from approved or rejected'}), 400
            if not can_reopen(db, user_id, obj):
                return jsonify({'error': 'Not allowed to reopen'}), 403
            return _workflow_transition(objective_id, user_id, status, 'draft', reason=reason)

        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        obj = db.objectives.find_one({'_id': oid})
        if not obj:
            return jsonify({'error': 'Objective not found'}), 404
        status = (obj.get('status') or '').lower()
        if status not in ('approved', 'rejected'):
            return jsonify({'error': 'Objective can only be reopened from approved or rejected'}), 400
        if not can_reopen(db, user_id, obj):
            return jsonify({'error': 'Not allowed to reopen'}), 403
        return _workflow_transition(objective_id, user_id, status, 'draft', reason=reason)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/<objective_id>/tree', methods=['GET'])
@require_auth
def get_objective_tree(objective_id, user_id):
    """Get objective with full tree of children (recursive) and key results. Roll-up view."""
    try:
        repo = get_okr_repository()
        if _using_postgres_repo():
            tree = repo.get_objective_tree(user_id, objective_id)
            if not tree:
                return jsonify({'error': 'Objective not found'}), 404
            return jsonify(tree), 200

        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objective ID'}), 400
        db = get_db()
        root = db.objectives.find_one({'_id': oid})
        if not root:
            return jsonify({'error': 'Objective not found'}), 404
        if not can_view_objective(db, user_id, root):
            return jsonify({'error': 'Not allowed to view this objective'}), 403

        def build_node(obj_doc):
            node = _serialize_doc(obj_doc)
            node_id = obj_doc['_id']
            children = list(db.objectives.find({'parentObjectiveId': node_id}))
            node['children'] = [build_node(c) for c in children]
            krs = list(db.key_results.find({'objectiveId': node_id}))
            node['keyResults'] = [_serialize_doc(kr) for kr in krs]
            scores = [kr.get('score') for kr in krs if kr.get('score') is not None]
            node['averageScore'] = round(sum(scores) / len(scores), 1) if scores else None
            return node

        tree = build_node(root)
        return jsonify(tree), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---- Key Results ----

@bp.route('/key-results', methods=['GET'])
@require_auth
def list_key_results(user_id):
    """List key results, optionally filtered by objectiveId."""
    try:
        objective_id = request.args.get('objectiveId')
        if not objective_id:
            return jsonify({'error': 'objectiveId query param is required'}), 400
        repo = get_okr_repository()
        if _using_postgres_repo():
            norm_oid = _parse_uuid_objective_id(objective_id)
            if norm_oid is None:
                return jsonify({'error': 'Invalid objectiveId'}), 400
            items = repo.list_key_results(user_id, norm_oid)
            return jsonify(items or []), 200

        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objectiveId'}), 400
        db = get_db()
        obj = db.objectives.find_one({'_id': oid})
        if not obj:
            return jsonify({'error': 'Objective not found'}), 404
        if not can_view_objective(db, user_id, obj):
            return jsonify({'error': 'Not allowed to view this objective'}), 403
        cursor = db.key_results.find({'objectiveId': oid})
        items = [_serialize_doc(d) for d in cursor]
        return jsonify(items), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/key-results/<kr_id>', methods=['GET'])
@require_auth
def get_key_result(kr_id, user_id):
    """Get a single key result by ID."""
    try:
        repo = get_okr_repository()
        if _using_postgres_repo():
            doc = repo.get_key_result(user_id, kr_id)
            if not doc:
                return jsonify({'error': 'Key result not found'}), 404
            return jsonify(doc), 200

        kid = _parse_object_id(kr_id)
        if kid is None:
            return jsonify({'error': 'Invalid key result ID'}), 400
        db = get_db()
        doc = db.key_results.find_one({'_id': kid})
        if not doc:
            return jsonify({'error': 'Key result not found'}), 404
        return jsonify(_serialize_doc(doc)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/key-results/<kr_id>/history', methods=['GET'])
@require_auth
def get_key_result_history(kr_id, user_id):
    """List score history for a key result (for trend charts)."""
    try:
        db = get_db()
        if _using_postgres_repo():
            kid = _parse_uuid_objective_id(kr_id)
            if kid is None:
                return jsonify({'error': 'Invalid key result ID'}), 400
            repo = get_okr_repository()
            if not repo.get_key_result(user_id, kid):
                return jsonify({'error': 'Key result not found'}), 404
            cursor = db.score_history.find({'keyResultId': kid}).sort('recordedAt', 1)
            items = [_serialize_doc(d) for d in cursor]
            return jsonify(items), 200

        kid = _parse_object_id(kr_id)
        if kid is None:
            return jsonify({'error': 'Invalid key result ID'}), 400
        if not db.key_results.find_one({'_id': kid}):
            return jsonify({'error': 'Key result not found'}), 404
        cursor = db.score_history.find({'keyResultId': kid}).sort('recordedAt', 1)
        items = [_serialize_doc(d) for d in cursor]
        return jsonify(items), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/key-results', methods=['POST'])
@require_auth
def create_key_result(user_id):
    """Create a new key result."""
    try:
        data = request.get_json() or {}
        objective_id = data.get('objectiveId')
        title = data.get('title')
        if not objective_id or not title:
            return jsonify({'error': 'objectiveId and title are required'}), 400
        repo = get_okr_repository()
        if _using_postgres_repo():
            created = repo.create_key_result(user_id, data)
            return jsonify(created), 201

        oid = _parse_object_id(objective_id)
        if oid is None:
            return jsonify({'error': 'Invalid objectiveId'}), 400
        db = get_db()
        if not db.objectives.find_one({'_id': oid}):
            return jsonify({'error': 'Objective not found'}), 404
        now = _now()
        doc = {
            'objectiveId': oid,
            'title': title,
            'target': data.get('target'),
            'currentValue': data.get('currentValue'),
            'unit': data.get('unit', ''),
            'score': data.get('score'),
            'targetScore': data.get('targetScore', 1.0),
            'ownerId': data.get('ownerId', user_id),
            'notes': data.get('notes', []),
            'createdAt': now,
            'lastUpdatedAt': now,
        }
        result = db.key_results.insert_one(doc)
        doc['_id'] = result.inserted_id
        return jsonify(_serialize_doc(doc)), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/key-results/<kr_id>', methods=['PUT'])
@require_auth
def update_key_result(kr_id, user_id):
    """Update a key result (including progress: currentValue, score, notes). Appends to score_history when score/notes change.
    Optional body field lastUpdatedAt: if sent and server has a newer lastUpdatedAt, returns 409 Conflict."""
    try:
        repo = get_okr_repository()
        if _using_postgres_repo():
            data = request.get_json() or {}
            updated = repo.update_key_result(user_id, kr_id, data)
            if not updated:
                return jsonify({'error': 'Key result not found'}), 404
            return jsonify(updated), 200

        kid = _parse_object_id(kr_id)
        if kid is None:
            return jsonify({'error': 'Invalid key result ID'}), 400
        data = request.get_json() or {}
        db = get_db()
        existing = db.key_results.find_one({'_id': kid})
        if not existing:
            return jsonify({'error': 'Key result not found'}), 404
        objective = db.objectives.find_one({'_id': existing['objectiveId']}) if existing.get('objectiveId') else None
        if get_user_role(db, user_id) == 'view_only' or not can_edit_kr(db, user_id, existing, objective):
            return jsonify({'error': 'Not allowed to edit this key result'}), 403
        client_last = data.get('lastUpdatedAt')
        if client_last:
            try:
                client_dt = datetime.fromisoformat(client_last.replace('Z', '+00:00'))
                if client_dt.tzinfo is None:
                    client_dt = client_dt.replace(tzinfo=timezone.utc)
            except (ValueError, TypeError):
                client_dt = None
            server_last = existing.get('lastUpdatedAt')
            if server_last and client_dt:
                server_dt = server_last.replace(tzinfo=timezone.utc) if getattr(server_last, 'tzinfo', None) is None else server_last
                if server_dt > client_dt:
                    return jsonify({
                        'error': 'conflict',
                        'message': 'This key result was updated by someone else. Reload to see their changes.',
                        'current': _serialize_doc(existing),
                    }), 409
        now = _now()
        update = {'lastUpdatedAt': now}
        for key in ('title', 'target', 'currentValue', 'unit', 'score', 'targetScore', 'ownerId', 'notes'):
            if key in data:
                update[key] = data[key]
        db.key_results.update_one({'_id': kid}, {'$set': update})
        if 'score' in data or 'notes' in data:
            score = update.get('score', existing.get('score'))
            if score is not None:
                notes_snippet = None
                if 'notes' in update and update['notes']:
                    notes_snippet = update['notes'][-1].get('text', '')[:500] if isinstance(update['notes'][-1], dict) else str(update['notes'][-1])[:500]
                db.score_history.insert_one({
                    'keyResultId': kid,
                    'score': float(score),
                    'notes': notes_snippet,
                    'recordedBy': user_id,
                    'recordedAt': now,
                })
                # Significant change alert (best-effort): notify objective owner via Gmail if connected.
                try:
                    prev = existing.get('score')
                    if prev is not None:
                        delta = abs(float(score) - float(prev))
                        if delta >= 0.2 and objective and objective.get('ownerId'):
                            from app.services.google_gmail import send_gmail
                            owner_id = objective.get('ownerId')
                            # Look up owner's email (stored in Postgres users table during /auth/me provisioning).
                            owner_email = None
                            try:
                                if os.getenv("DATABASE_URL"):
                                    from app.db.postgres import pg_session
                                    from app.models_sql.user import User
                                    with pg_session() as s:
                                        u = s.get(User, str(owner_id))
                                        owner_email = getattr(u, "email", None) if u else None
                            except Exception:
                                owner_email = None
                            if not owner_email:
                                raise ValueError("owner_email_missing")
                            frontend = (os.getenv('FRONTEND_URL') or 'http://localhost:3000').rstrip('/')
                            subject = 'Significant OKR change detected'
                            body = (
                                f"One of your OKRs changed significantly (Δscore {delta:.1f}).\n\n"
                                f"Objective: {objective.get('title') or 'Untitled'}\n"
                                f"Key Result: {existing.get('title') or ''}\n"
                                f"New score: {float(score):.2f}\n\n"
                                f"View: {frontend}/okrs/{objective.get('_id')}\n"
                            )
                            # Send from the owner's connected Gmail account to themselves.
                            send_gmail(user_id=str(owner_id), to_email=str(owner_email), subject=subject, body_text=body)
                except Exception:
                    pass
        updated = db.key_results.find_one({'_id': kid})
        return jsonify(_serialize_doc(updated)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/key-results/<kr_id>', methods=['DELETE'])
@require_auth
def delete_key_result(kr_id, user_id):
    """Delete a key result."""
    try:
        repo = get_okr_repository()
        if _using_postgres_repo():
            ok = repo.delete_key_result(user_id, kr_id)
            if not ok:
                return jsonify({'error': 'Key result not found'}), 404
            return jsonify({'message': 'Key result deleted'}), 200

        kid = _parse_object_id(kr_id)
        if kid is None:
            return jsonify({'error': 'Invalid key result ID'}), 400
        db = get_db()
        existing = db.key_results.find_one({'_id': kid})
        if not existing:
            return jsonify({'error': 'Key result not found'}), 404
        db.key_results.delete_one({'_id': kid})
        return jsonify({'message': 'Key result deleted'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---- Comments ----

@bp.route('/objectives/<objective_id>/comments', methods=['GET'])
@require_auth
def list_comments(objective_id, user_id):
    """List comments for an objective."""
    try:
        db = get_db()
        if _using_postgres_repo():
            norm, err = _postgres_objective_norm_or_error(user_id, objective_id)
            if err:
                return err
            oid = norm
        else:
            oid = _parse_object_id(objective_id)
            if oid is None:
                return jsonify({'error': 'Invalid objective ID'}), 400
            if not db.objectives.find_one({'_id': oid}):
                return jsonify({'error': 'Objective not found'}), 404
        cursor = db.comments.find({'objectiveId': oid}).sort('createdAt', 1)
        items = [_serialize_doc(d) for d in cursor]
        return jsonify(items), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/<objective_id>/comments', methods=['POST'])
@require_auth
def create_comment(objective_id, user_id):
    """Add a comment. Body: { body }."""
    try:
        data = request.get_json() or {}
        body = data.get('body', '').strip()
        if not body:
            return jsonify({'error': 'body is required'}), 400
        db = get_db()
        if _using_postgres_repo():
            norm, err = _postgres_objective_norm_or_error(user_id, objective_id)
            if err:
                return err
            oid = norm
        else:
            oid = _parse_object_id(objective_id)
            if oid is None:
                return jsonify({'error': 'Invalid objective ID'}), 400
            if not db.objectives.find_one({'_id': oid}):
                return jsonify({'error': 'Objective not found'}), 404
        now = _now()
        doc = {
            'objectiveId': oid,
            'authorId': user_id,
            'body': body,
            'createdAt': now,
        }
        result = db.comments.insert_one(doc)
        doc['_id'] = result.inserted_id
        return jsonify(_serialize_doc(doc)), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---- Attachments ----

MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024  # 25 MB

# MIME types and extensions we accept (upload validation).
_ALLOWED_ATTACHMENT_MIMES = frozenset({
    'application/pdf',
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'text/plain', 'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
})

_ALLOWED_ATTACHMENT_EXTS = frozenset({
    '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.txt', '.csv',
    '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
})


def _file_ext(name):
    if not name or '.' not in name:
        return ''
    return '.' + name.rsplit('.', 1)[-1].lower()


def _validate_upload_file(file_storage, filename: str):
    """Returns (ok: bool, error_message or None)."""
    if not file_storage:
        return False, 'No file provided'
    ext = _file_ext(filename or '')
    ext_ok = ext in _ALLOWED_ATTACHMENT_EXTS if ext else False
    mime = (getattr(file_storage, 'content_type', None) or '').split(';')[0].strip().lower()
    mime_ok = mime in _ALLOWED_ATTACHMENT_MIMES if mime else False
    if not ext_ok and not mime_ok:
        return False, 'File type not allowed (allowed: PDF, images, Word, Excel, PowerPoint, CSV, TXT)'
    try:
        pos = file_storage.tell()
        file_storage.seek(0, 2)
        size = file_storage.tell()
        file_storage.seek(pos)
    except Exception:
        return False, 'Could not read file size'
    if size <= 0:
        return False, 'File is empty'
    if size > MAX_ATTACHMENT_BYTES:
        return False, f'File too large (max {MAX_ATTACHMENT_BYTES // (1024 * 1024)} MB)'
    return True, None


def _validate_attachment_json_meta(file_name: str, file_size: int, file_type: str):
    ext = _file_ext(file_name or '')
    ext_ok = ext in _ALLOWED_ATTACHMENT_EXTS if ext else False
    mime = (file_type or '').split(';')[0].strip().lower()
    mime_ok = mime in _ALLOWED_ATTACHMENT_MIMES if mime else False
    if not ext_ok and not mime_ok:
        return False, 'File type not allowed'
    try:
        sz = int(file_size)
    except (TypeError, ValueError):
        return False, 'Invalid file size'
    if sz <= 0 or sz > MAX_ATTACHMENT_BYTES:
        return False, f'Invalid file size (max {MAX_ATTACHMENT_BYTES // (1024 * 1024)} MB)'
    return True, None


def _key_result_belongs_to_objective(db, kr_oid, objective_oid):
    if kr_oid is None:
        return True, None
    kr = db.key_results.find_one({'_id': kr_oid})
    if not kr:
        return False, 'Key result not found'
    if kr.get('objectiveId') != objective_oid:
        return False, 'Key result does not belong to this objective'
    return True, None


def _key_result_belongs_to_objective_unified(user_id, db, key_result_id_str, objective_ref):
    """objective_ref: Mongo ObjectId or Postgres objective UUID string."""
    if not key_result_id_str:
        return True, None
    if _using_postgres_repo():
        kid = _parse_uuid_objective_id(key_result_id_str)
        if kid is None:
            return False, 'Invalid keyResultId'
        repo = get_okr_repository()
        kr = repo.get_key_result(user_id, kid)
        if not kr:
            return False, 'Key result not found'
        if str(kr.get('objectiveId')) != str(objective_ref):
            return False, 'Key result does not belong to this objective'
        return True, None
    kr_oid = _parse_object_id(key_result_id_str)
    if kr_oid is None:
        return False, 'Invalid keyResultId'
    return _key_result_belongs_to_objective(db, kr_oid, objective_ref)


@bp.route('/objectives/<objective_id>/attachments', methods=['GET'])
@require_auth
def list_attachments(objective_id, user_id):
    """List attachments for an objective (exclude soft-deleted)."""
    try:
        db = get_db()
        if _using_postgres_repo():
            norm, err = _postgres_objective_norm_or_error(user_id, objective_id)
            if err:
                return err
            oid = norm
        else:
            oid = _parse_object_id(objective_id)
            if oid is None:
                return jsonify({'error': 'Invalid objective ID'}), 400
            if not db.objectives.find_one({'_id': oid}):
                return jsonify({'error': 'Objective not found'}), 404
        cursor = db.attachments.find({'objectiveId': oid, 'deletedAt': None})
        items = [_serialize_doc(d) for d in cursor]
        return jsonify(items), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/attachments', methods=['POST'])
@require_auth
def create_attachment(user_id):
    """Create attachment: JSON { objectiveId, keyResultId?, fileName, fileSize, fileType, url } or multipart with file + objectiveId + keyResultId?."""
    try:
        db = get_db()
        url = None
        file_name = None
        file_size = 0
        file_type = ''

        storage_public_id = None
        if request.content_type and 'multipart/form-data' in request.content_type:
            objective_id = request.form.get('objectiveId')
            key_result_id = request.form.get('keyResultId') or None
            file = request.files.get('file')
            if not objective_id or not file:
                return jsonify({'error': 'objectiveId and file are required'}), 400
            kr_storage = None
            if _using_postgres_repo():
                norm, err = _postgres_objective_norm_or_error(user_id, objective_id)
                if err:
                    return err
                oid = norm
                ok_kr, kr_err = _key_result_belongs_to_objective_unified(user_id, db, key_result_id, oid)
                if not ok_kr:
                    return jsonify({'error': kr_err}), 400
                kr_storage = _parse_uuid_objective_id(key_result_id) if key_result_id else None
            else:
                oid = _parse_object_id(objective_id)
                if oid is None:
                    return jsonify({'error': 'Invalid objectiveId'}), 400
                if not db.objectives.find_one({'_id': oid}):
                    return jsonify({'error': 'Objective not found'}), 404
                kr_oid = _parse_object_id(key_result_id) if key_result_id else None
                if key_result_id and kr_oid is None:
                    return jsonify({'error': 'Invalid keyResultId'}), 400
                ok_kr, kr_err = _key_result_belongs_to_objective(db, kr_oid, oid)
                if not ok_kr:
                    return jsonify({'error': kr_err}), 400
                kr_storage = kr_oid
            if get_user_role(db, user_id) == 'view_only':
                return jsonify({'error': 'Not allowed to upload'}), 403
            ok_f, err_f = _validate_upload_file(file, file.filename or '')
            if not ok_f:
                return jsonify({'error': err_f}), 400
            try:
                from app.config.cloudinary_config import upload_file as cloudinary_upload
                result = cloudinary_upload(file, folder='okr_attachments')
                url = result.get('secure_url')
                file_name = file.filename or 'upload'
                file_size = result.get('bytes') or 0
                file_type = (file.content_type or 'application/octet-stream')
                storage_public_id = result.get('public_id')
            except Exception as e:
                return jsonify({'error': f'Upload failed: {str(e)}'}), 500
        else:
            data = request.get_json() or {}
            objective_id = data.get('objectiveId')
            if not objective_id:
                return jsonify({'error': 'objectiveId is required'}), 400
            kr_storage = None
            if _using_postgres_repo():
                norm, err = _postgres_objective_norm_or_error(user_id, objective_id)
                if err:
                    return err
                oid = norm
                key_result_id = data.get('keyResultId')
                ok_kr, kr_err = _key_result_belongs_to_objective_unified(user_id, db, key_result_id, oid)
                if not ok_kr:
                    return jsonify({'error': kr_err}), 400
                kr_storage = _parse_uuid_objective_id(key_result_id) if key_result_id else None
            else:
                oid = _parse_object_id(objective_id)
                if oid is None:
                    return jsonify({'error': 'Invalid objectiveId'}), 400
                if not db.objectives.find_one({'_id': oid}):
                    return jsonify({'error': 'Objective not found'}), 404
                key_result_id = data.get('keyResultId')
                kr_oid = _parse_object_id(key_result_id) if key_result_id else None
                if key_result_id and kr_oid is None:
                    return jsonify({'error': 'Invalid keyResultId'}), 400
                ok_kr, kr_err = _key_result_belongs_to_objective(db, kr_oid, oid)
                if not ok_kr:
                    return jsonify({'error': kr_err}), 400
                kr_storage = kr_oid
            if get_user_role(db, user_id) == 'view_only':
                return jsonify({'error': 'Not allowed to upload'}), 403
            url = data.get('url')
            file_name = data.get('fileName', '')
            file_size = data.get('fileSize', 0) or 0
            file_type = data.get('fileType', '') or 'application/octet-stream'
            if not url or not file_name:
                return jsonify({'error': 'url and fileName are required'}), 400
            ok_m, err_m = _validate_attachment_json_meta(file_name, file_size, file_type)
            if not ok_m:
                return jsonify({'error': err_m}), 400

        now = _now()
        doc = {
            'objectiveId': oid,
            'keyResultId': kr_storage,
            'fileName': file_name,
            'fileSize': file_size,
            'fileType': file_type,
            'url': url,
            'uploadedBy': user_id,
            'uploadedAt': now,
            'deletedAt': None,
        }
        if storage_public_id:
            doc['storagePublicId'] = storage_public_id
        result = db.attachments.insert_one(doc)
        doc['_id'] = result.inserted_id
        return jsonify(_serialize_doc(doc)), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/attachments/<attachment_id>/access', methods=['GET'])
@require_auth
def attachment_access(attachment_id, user_id):
    """Return storage URL for download/preview after auth (do not expose URLs without a session)."""
    try:
        aid = _parse_object_id(attachment_id)
        if aid is None:
            return jsonify({'error': 'Invalid attachment ID'}), 400
        db = get_db()
        att = db.attachments.find_one({'_id': aid, 'deletedAt': None})
        if not att:
            return jsonify({'error': 'Attachment not found'}), 404
        oid = att.get('objectiveId')
        if not oid:
            return jsonify({'error': 'Objective not found'}), 404
        if _using_postgres_repo():
            repo = get_okr_repository()
            if not repo.get_objective(user_id, str(oid)):
                return jsonify({'error': 'Objective not found'}), 404
        elif not db.objectives.find_one({'_id': oid}):
            return jsonify({'error': 'Objective not found'}), 404
        return jsonify({
            'url': att.get('url'),
            'fileName': att.get('fileName', ''),
            'fileType': att.get('fileType', ''),
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/objectives/<objective_id>/attachment-deletions', methods=['GET'])
@require_auth
def list_attachment_deletions(objective_id, user_id):
    """Audit trail: file deletions for this objective."""
    try:
        db = get_db()
        if _using_postgres_repo():
            norm, err = _postgres_objective_norm_or_error(user_id, objective_id)
            if err:
                return err
            oid = norm
        else:
            oid = _parse_object_id(objective_id)
            if oid is None:
                return jsonify({'error': 'Invalid objective ID'}), 400
            if not db.objectives.find_one({'_id': oid}):
                return jsonify({'error': 'Objective not found'}), 404
        cursor = db.attachment_deletion_audit.find({'objectiveId': oid}).sort('deletedAt', -1).limit(200)
        items = [_serialize_doc(d) for d in cursor]
        return jsonify(items), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/attachments/<attachment_id>', methods=['DELETE'])
@require_auth
def delete_attachment(attachment_id, user_id):
    """Soft-delete an attachment (set deletedAt)."""
    try:
        aid = _parse_object_id(attachment_id)
        if aid is None:
            return jsonify({'error': 'Invalid attachment ID'}), 400
        db = get_db()
        existing = db.attachments.find_one({'_id': aid})
        if not existing:
            return jsonify({'error': 'Attachment not found'}), 404
        if existing.get('deletedAt'):
            return jsonify({'message': 'Attachment already deleted'}), 200
        obj = None
        if existing.get('objectiveId'):
            oref = existing['objectiveId']
            if _using_postgres_repo():
                repo = get_okr_repository()
                obj = repo.get_objective(user_id, str(oref))
            else:
                obj = db.objectives.find_one({'_id': oref})
        if not can_edit_objective(db, user_id, obj) and get_user_role(db, user_id) != 'admin':
            return jsonify({'error': 'Not allowed to delete this attachment'}), 403
        now = _now()
        audit_doc = {
            'objectiveId': existing['objectiveId'],
            'keyResultId': existing.get('keyResultId'),
            'attachmentId': aid,
            'fileName': existing.get('fileName'),
            'fileSize': existing.get('fileSize', 0),
            'fileType': existing.get('fileType'),
            'uploadedBy': existing.get('uploadedBy'),
            'uploadedAt': existing.get('uploadedAt'),
            'storageUrl': existing.get('url'),
            'deletedBy': user_id,
            'deletedAt': now,
        }
        db.attachment_deletion_audit.insert_one(audit_doc)
        db.attachments.update_one({'_id': aid}, {'$set': {'deletedAt': now}})
        return jsonify({'message': 'Attachment deleted'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
