"""Integrations: Slack/Teams webhooks, incoming webhook, Google Slides."""
import os
import secrets
import urllib.parse
import logging
from flask import Blueprint, request, jsonify, redirect

logger = logging.getLogger(__name__)
from app.db.mongodb import get_db
from app.routes.auth_backend import require_auth
from app.services.permissions import get_user_role, ROLE_VIEW_ONLY
from app.services.notifications import post_okr_update_to_webhook, format_okr_update_message

bp = Blueprint('integrations', __name__)


@bp.route('/integrations/outgoing', methods=['GET'])
@require_auth
def get_outgoing_config(user_id):
    """Get current user's outgoing webhook config (Slack/Teams). Mask URL for display."""
    try:
        db = get_db()
        doc = db.integration_configs.find_one({'_id': user_id})
        if not doc:
            return jsonify({'webhookUrlMasked': None, 'channelType': None, 'channelDisplayName': None, 'configured': False}), 200
        url = doc.get('webhookUrl') or ''
        if len(url) > 20:
            url = url[:8] + '...' + url[-8:]
        return jsonify({
            'webhookUrlMasked': url or None,
            'channelType': doc.get('channelType'),
            'channelDisplayName': doc.get('channelDisplayName'),
            'configured': bool(doc.get('webhookUrl')),
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/integrations/outgoing', methods=['POST'])
@require_auth
def save_outgoing_config(user_id):
    """Save outgoing webhook (Slack or Teams). Body: { webhookUrl, channelType: 'slack'|'teams', channelDisplayName? }."""
    try:
        if get_user_role(get_db(), user_id) == ROLE_VIEW_ONLY:
            return jsonify({'error': 'View-only users cannot configure integrations'}), 403
        data = request.get_json() or {}
        webhook_url = (data.get('webhookUrl') or '').strip()
        channel_type = (data.get('channelType') or 'slack').lower()
        if channel_type not in ('slack', 'teams'):
            channel_type = 'slack'
        channel_display = (data.get('channelDisplayName') or '').strip() or None
        if not webhook_url:
            # Clear config
            get_db().integration_configs.update_one(
                {'_id': user_id},
                {'$set': {'webhookUrl': None, 'channelType': None, 'channelDisplayName': None}},
                upsert=True,
            )
            return jsonify({'message': 'Webhook cleared', 'configured': False}), 200
        if not webhook_url.startswith('https://'):
            return jsonify({'error': 'Webhook URL must be HTTPS'}), 400
        get_db().integration_configs.update_one(
            {'_id': user_id},
            {'$set': {
                'webhookUrl': webhook_url,
                'channelType': channel_type,
                'channelDisplayName': channel_display,
            }},
            upsert=True,
        )
        return jsonify({'message': 'Webhook saved', 'configured': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/integrations/outgoing/test', methods=['POST'])
@require_auth
def test_outgoing_webhook(user_id):
    """Send a test message to the configured webhook."""
    try:
        db = get_db()
        doc = db.integration_configs.find_one({'_id': user_id})
        if not doc or not doc.get('webhookUrl'):
            return jsonify({'error': 'No webhook configured'}), 400
        payload = format_okr_update_message('Test OKR', 'Test', actor_name='You', event_type='test')
        ok = post_okr_update_to_webhook(doc['webhookUrl'], doc.get('channelType') or 'slack', payload)
        if not ok:
            return jsonify({'error': 'Failed to send test message'}), 502
        return jsonify({'message': 'Test message sent'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/integrations/incoming-url', methods=['GET'])
@require_auth
def get_incoming_webhook_url(user_id):
    """Return the incoming webhook URL for the current user (token created if missing)."""
    try:
        db = get_db()
        doc = db.integration_configs.find_one({'_id': user_id})
        token = doc.get('incomingWebhookToken') if doc else None
        if not token:
            token = secrets.token_urlsafe(24)
            db.integration_configs.update_one(
                {'_id': user_id},
                {'$set': {'incomingWebhookToken': token}},
                upsert=True,
            )
        base = os.getenv('API_BASE_URL', request.url_root.rstrip('/'))
        url = f'{base}/api/webhooks/incoming?token={token}'
        return jsonify({'url': url}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---- Google Slides ----

def _google_credentials_config():
    """Read Google OAuth env vars; strip surrounding quotes so .env quoting works."""
    def _s(v):
        return (v or '').strip().strip('"\'').strip() if v else ''
    client_id = _s(os.getenv('GOOGLE_CLIENT_ID'))
    client_secret = _s(os.getenv('GOOGLE_CLIENT_SECRET'))
    redirect_uri = _s(os.getenv('GOOGLE_REDIRECT_URI'))
    if not client_id or not client_secret or not redirect_uri:
        return None
    return {'client_id': client_id, 'client_secret': client_secret, 'redirect_uri': redirect_uri}


def _google_auth_url_with_state(user_id: str) -> str:
    """Build Google OAuth2 authorization URL with state=user_id."""
    cfg = _google_credentials_config()
    if not cfg:
        raise ValueError('Google integration not configured')
    base = 'https://accounts.google.com/o/oauth2/v2/auth'
    params = {
        'client_id': cfg['client_id'],
        'redirect_uri': cfg['redirect_uri'],
        'response_type': 'code',
        'scope': 'https://www.googleapis.com/auth/presentations https://www.googleapis.com/auth/drive.file',
        'access_type': 'offline',
        'prompt': 'consent',
        'state': user_id,
    }
    return f"{base}?{urllib.parse.urlencode(params)}"


@bp.route('/integrations/google/auth-url', methods=['GET'])
@require_auth
def google_auth_url(user_id):
    """Return Google OAuth2 authorization URL. Frontend redirects user there."""
    try:
        url = _google_auth_url_with_state(user_id)
        return jsonify({'url': url}), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 503
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def _redirect_google_error(frontend: str, reason: str = ''):
    """Redirect to integrations with google=error; in dev, append reason for debugging."""
    base = f'{frontend}/integrations?google=error'
    if reason and os.getenv('FLASK_ENV') == 'development':
        base += '&reason=' + urllib.parse.quote(reason[:200])
    return redirect(base)


@bp.route('/integrations/google/callback', methods=['GET'])
def google_callback():
    """OAuth callback: exchange code for tokens, store refresh_token, redirect to frontend."""
    code = request.args.get('code')
    state = request.args.get('state')  # user_id
    error = request.args.get('error')  # from Google when user denies or config wrong
    error_description = request.args.get('error_description', '')
    frontend = (os.getenv('FRONTEND_URL') or 'http://localhost:3000').rstrip('/')
    if error:
        logger.warning('Google OAuth error from redirect: %s %s', error, error_description)
        return _redirect_google_error(frontend, error_description or error)
    if not code or not state:
        logger.warning('Google callback missing code or state')
        return _redirect_google_error(frontend, 'missing_code_or_state')
    try:
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import Flow
        cfg = _google_credentials_config()
        if not cfg:
            logger.warning('Google integration not configured (missing GOOGLE_* env)')
            return _redirect_google_error(frontend, 'google_not_configured')
        flow = Flow.from_client_config(
            {
                'web': {
                    'client_id': cfg['client_id'],
                    'client_secret': cfg['client_secret'],
                    'auth_uri': 'https://accounts.google.com/o/oauth2/auth',
                    'token_uri': 'https://oauth2.googleapis.com/token',
                    'redirect_uris': [cfg['redirect_uri']],
                }
            },
            scopes=['https://www.googleapis.com/auth/presentations', 'https://www.googleapis.com/auth/drive.file'],
        )
        flow.redirect_uri = cfg['redirect_uri']
        flow.fetch_token(code=code)
        credentials = flow.credentials
        refresh_token = credentials.refresh_token
        if not refresh_token:
            logger.warning('Google OAuth did not return a refresh_token (prompt=consent may be needed)')
            return _redirect_google_error(frontend, 'no_refresh_token')
        get_db().integration_configs.update_one(
            {'_id': state},
            {'$set': {'googleRefreshToken': refresh_token}},
            upsert=True,
        )
        return redirect(f'{frontend}/integrations?google=connected')
    except Exception as e:
        err_msg = str(e).strip() or type(e).__name__
        logger.exception('Google OAuth callback failed: %s', e)
        return _redirect_google_error(frontend, err_msg)


@bp.route('/integrations/google/export', methods=['POST'])
@require_auth
def google_slides_export(user_id):
    """Create a Google Slides presentation from OKR tree. Body: { treeRootId } or { objectiveIds: [] }."""
    if get_user_role(get_db(), user_id) == ROLE_VIEW_ONLY:
        return jsonify({'error': 'View-only users cannot export'}), 403
    try:
        from app.services.google_slides_export import create_okr_presentation
        data = request.get_json() or {}
        tree_root_id = data.get('treeRootId')
        objective_ids = data.get('objectiveIds')
        if not tree_root_id and not objective_ids:
            return jsonify({'error': 'Provide treeRootId or objectiveIds'}), 400
        result = create_okr_presentation(user_id, tree_root_id, objective_ids)
        return jsonify(result), 200
    except ImportError as e:
        return jsonify({'error': 'Google Slides export not available'}), 503
    except Exception as e:
        return jsonify({'error': str(e)}), 500
