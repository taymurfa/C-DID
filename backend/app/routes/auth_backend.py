from flask import Blueprint, request, jsonify, redirect, session, url_for
from functools import wraps
import requests
import os
import ssl
import certifi
import jwt
from jwt import PyJWKClient
from datetime import datetime, timedelta

bp = Blueprint('auth_backend', __name__)


def _auth0_domain_from_env() -> str | None:
    """Prefer AUTH0_DOMAIN; else derive host from AUTH0_ISSUER_BASE_URL (same as Next.js / Render)."""
    d = (os.getenv('AUTH0_DOMAIN') or '').strip()
    if d:
        return d
    issuer = (os.getenv('AUTH0_ISSUER_BASE_URL') or '').strip().rstrip('/')
    if not issuer:
        return None
    for prefix in ('https://', 'http://'):
        if issuer.startswith(prefix):
            return issuer[len(prefix) :]
    return issuer


AUTH0_DOMAIN = _auth0_domain_from_env()
AUTH0_CLIENT_ID = os.getenv('AUTH0_CLIENT_ID')
AUTH0_CLIENT_SECRET = os.getenv('AUTH0_CLIENT_SECRET')
AUTH0_AUDIENCE = os.getenv('AUTH0_AUDIENCE')
# Public URL of the Next app (OAuth redirects). FRONTEND_URL is clearer on Render; AUTH0_BASE_URL kept for compat.
AUTH0_BASE_URL = (
    (os.getenv('AUTH0_BASE_URL') or '').strip()
    or (os.getenv('FRONTEND_URL') or '').strip()
    or 'http://localhost:3000'
)
# Public URL of this API (OAuth callback). Render sets RENDER_EXTERNAL_URL automatically.
BACKEND_URL = (
    (os.getenv('BACKEND_URL') or '').strip()
    or (os.getenv('RENDER_EXTERNAL_URL') or '').strip()
    or 'http://localhost:5001'
)

if not AUTH0_AUDIENCE and AUTH0_DOMAIN:
    AUTH0_AUDIENCE = f'https://{AUTH0_DOMAIN}/api/v2/'


def is_auth0_configured() -> bool:
    """True when domain (or issuer URL), client id, and secret are set. Required for all authenticated API use."""
    return bool(AUTH0_DOMAIN and AUTH0_CLIENT_ID and AUTH0_CLIENT_SECRET)


def _flask_env_is_production() -> bool:
    return os.getenv('FLASK_ENV', '').strip().lower() == 'production'


def allow_insecure_auth0_dev() -> bool:
    """When True (and not production), API may start without Auth0 and use a synthetic user for /auth/me.

    Set ``ALLOW_INSECURE_AUTH0_DEV=1`` only on trusted developer machines. **Never** set in production:
    this flag is ignored when ``FLASK_ENV=production``.
    """
    if _flask_env_is_production():
        return False
    v = (os.getenv('ALLOW_INSECURE_AUTH0_DEV') or '').strip().lower()
    return v in ('1', 'true', 'yes')


def _fallback_user_id() -> str:
    return (os.getenv('AUTH_DISABLED_USER_ID') or 'auth0|demo_u1').strip()


def _fallback_user_info() -> dict:
    """Synthetic profile when Auth0 is off and ``allow_insecure_auth0_dev()`` is True."""
    uid = _fallback_user_id()
    name = (os.getenv('AUTH_DISABLED_USER_NAME') or 'Sarah Chen').strip()
    email = (os.getenv('AUTH_DISABLED_USER_EMAIL') or 'sarah@company.com').strip()
    return {
        'sub': uid,
        'name': name,
        'email': email,
        'picture': (os.getenv('AUTH_DISABLED_USER_PICTURE') or '').strip(),
        'nickname': name,
    }


# Cache for Auth0 Management API token (short-lived, avoid hitting token endpoint every request)
_management_token_cache = {'token': None, 'expires': 0}


def get_auth0_management_token():
    """Get an access token for the Auth0 Management API (client_credentials). Requires the Auth0
    application to be authorized for the Auth0 Management API with read:users scope.
    In Auth0 Dashboard: APIs -> Auth0 Management API -> Machine to Machine Applications ->
    Authorize your application and grant read:users."""
    import time
    global _management_token_cache
    now = time.time()
    if _management_token_cache['token'] and _management_token_cache['expires'] > now + 60:
        return _management_token_cache['token']
    if not AUTH0_DOMAIN or not AUTH0_CLIENT_ID or not AUTH0_CLIENT_SECRET:
        return None
    url = f'https://{AUTH0_DOMAIN}/oauth/token'
    data = {
        'grant_type': 'client_credentials',
        'client_id': AUTH0_CLIENT_ID,
        'client_secret': AUTH0_CLIENT_SECRET,
        'audience': AUTH0_AUDIENCE or f'https://{AUTH0_DOMAIN}/api/v2/',
    }
    try:
        r = requests.post(url, data=data, timeout=10)
        if not r.ok:
            return None
        body = r.json()
        token = body.get('access_token')
        expires_in = body.get('expires_in', 86400)
        if token:
            _management_token_cache['token'] = token
            _management_token_cache['expires'] = now + expires_in
        return token
    except Exception:
        return None


def list_auth0_users():
    """Fetch all users from Auth0 Management API. Returns list of dicts with user_id, name, email, picture."""
    token = get_auth0_management_token()
    if not token:
        return None
    url = f'https://{AUTH0_DOMAIN}/api/v2/users'
    all_users = []
    page = 0
    per_page = 100
    while True:
        try:
            r = requests.get(
                url,
                headers={'Authorization': f'Bearer {token}'},
                params={'per_page': per_page, 'page': page},
                timeout=15,
            )
            if not r.ok:
                return None
            data = r.json()
            if not data:
                break
            all_users.extend(data)
            if len(data) < per_page:
                break
            page += 1
        except Exception:
            return None
    return all_users


def get_jwks_client():
    """Get JWKS client for Auth0 (uses certifi for SSL on macOS)"""
    if not AUTH0_DOMAIN:
        return None
    jwks_url = f'https://{AUTH0_DOMAIN}/.well-known/jwks.json'
    ctx = ssl.create_default_context()
    ctx.load_verify_locations(cafile=certifi.where())
    return PyJWKClient(jwks_url, ssl_context=ctx)

def verify_token(token: str, is_id_token: bool = False) -> dict:
    """Verify Auth0 JWT token and return decoded payload
    
    Args:
        token: JWT token to verify
        is_id_token: If True, verify as ID token (audience = client_id)
                    If False, verify as access token (audience = API audience)
    """
    try:
        if not AUTH0_DOMAIN:
            raise ValueError("AUTH0_DOMAIN not configured")
        
        jwks_client = get_jwks_client()
        if not jwks_client:
            raise ValueError("Could not initialize JWKS client")
        
        # Get signing key
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        
        # For ID tokens, audience is the client ID (or can be an array containing it)
        # For access tokens, audience is the API audience
        if is_id_token:
            # ID tokens can have audience as client_id or as an array
            # Try with client_id first, but also allow verification without strict audience check
            try:
                decoded_token = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=['RS256'],
                    audience=AUTH0_CLIENT_ID,
                    issuer=f'https://{AUTH0_DOMAIN}/',
                    options={"verify_aud": True}
                )
            except jwt.InvalidAudienceError:
                # If audience check fails, try without audience verification for ID token
                # (ID tokens are meant for the client, not the API)
                decoded_token = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=['RS256'],
                    issuer=f'https://{AUTH0_DOMAIN}/',
                    options={"verify_aud": False}
                )
        else:
            # Access tokens must have the API audience
            decoded_token = jwt.decode(
                token,
                signing_key.key,
                algorithms=['RS256'],
                audience=AUTH0_AUDIENCE,
                issuer=f'https://{AUTH0_DOMAIN}/'
            )
        
        return decoded_token
    except jwt.ExpiredSignatureError:
        raise ValueError("Token has expired")
    except jwt.InvalidTokenError as e:
        raise ValueError(f"Invalid token: {str(e)}")

def get_user_from_session():
    """Get user info from session"""
    return session.get('user')

def get_user_id_from_request() -> str:
    """Extract user ID from session or Authorization header"""
    # First try session
    user = get_user_from_session()
    if user and user.get('sub'):
        return user['sub']

    # Fall back to Authorization header
    auth_header = request.headers.get('Authorization')
    if auth_header:
        try:
            token = auth_header.split(' ')[1]  # Remove 'Bearer ' prefix
            decoded = verify_token(token)
            return decoded.get('sub')
        except Exception:
            pass

    if allow_insecure_auth0_dev() and not is_auth0_configured():
        return _fallback_user_id()

    raise ValueError("No authenticated user found")

def get_user_info_from_request() -> dict:
    """Get user info from session or token"""
    # First try session
    user = get_user_from_session()
    if user:
        return {
            'sub': user.get('sub'),
            'name': user.get('name') or user.get('nickname') or '',
            'email': user.get('email') or '',
            'picture': user.get('picture') or '',
            'nickname': user.get('nickname') or user.get('name') or '',
        }
    
    # Fall back to Authorization header
    auth_header = request.headers.get('Authorization')
    if auth_header:
        try:
            token = auth_header.split(' ')[1]
            decoded = verify_token(token)
            return {
                'sub': decoded.get('sub'),
                'name': decoded.get('name') or decoded.get('nickname') or '',
                'email': decoded.get('email') or '',
                'picture': decoded.get('picture') or '',
                'nickname': decoded.get('nickname') or decoded.get('name') or '',
            }
        except Exception as e:
            raise ValueError(f"Failed to get user info: {str(e)}")

    if allow_insecure_auth0_dev() and not is_auth0_configured():
        return _fallback_user_info()

    raise ValueError("No authenticated user found")

def require_auth(f):
    """Decorator to require authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            user_id = get_user_id_from_request()
            kwargs['user_id'] = user_id
            return f(*args, **kwargs)
        except ValueError as e:
            return jsonify({'error': str(e)}), 401
        except Exception as e:
            return jsonify({'error': 'Authentication failed'}), 401
    return decorated_function


def _ensure_pg_user_row(user_info: dict) -> None:
    """Best-effort: ensure authenticated user exists in Postgres users table."""
    try:
        if not os.getenv("DATABASE_URL"):
            return
        from app.db.postgres import pg_session
        from app.models_sql.user import User
        uid = (user_info or {}).get("sub")
        if not uid:
            return
        with pg_session() as s:
            u = s.get(User, uid)
            if u is None:
                u = User(id=uid)
                s.add(u)
            # Keep these fields up to date when available
            email = (user_info or {}).get("email") or None
            name = (user_info or {}).get("name") or (user_info or {}).get("nickname") or None
            if email:
                u.email = email
            if name:
                u.name = name
            s.add(u)
    except Exception:
        # Don't block auth if provisioning fails; RBAC will enforce access later.
        return

@bp.route('/auth/login', methods=['GET'])
def login():
    """Return Auth0 authorize URL for the browser (JSON { auth_url })."""
    if not is_auth0_configured():
        if allow_insecure_auth0_dev():
            return jsonify(
                {
                    'auth_url': None,
                    'auth_disabled': True,
                    'message': 'ALLOW_INSECURE_AUTH0_DEV: no Auth0; client should treat as signed-in demo user. Never use in production.',
                }
            ), 200
        return jsonify(
            {
                'error': 'auth0_not_configured',
                'message': 'Auth0 is required. Set AUTH0_ISSUER_BASE_URL (or AUTH0_DOMAIN), AUTH0_CLIENT_ID, and AUTH0_CLIENT_SECRET — or set ALLOW_INSECURE_AUTH0_DEV=1 for local dev only (not with FLASK_ENV=production).',
            }
        ), 503

    # Use backend callback URL since backend handles the OAuth flow
    redirect_uri = f'{BACKEND_URL}/api/auth/callback'
    auth_url = (
        f'https://{AUTH0_DOMAIN}/authorize?'
        f'response_type=code&'
        f'client_id={AUTH0_CLIENT_ID}&'
        f'redirect_uri={redirect_uri}&'
        f'scope=openid profile email&'
        f'audience={AUTH0_AUDIENCE}'
    )
    
    return jsonify({'auth_url': auth_url}), 200

@bp.route('/auth/login', methods=['POST'])
def login_email_password():
    """Email/password login using Auth0"""
    if not is_auth0_configured():
        return jsonify(
            {
                'error': 'Email/password login requires Auth0. Set AUTH0_ISSUER_BASE_URL, AUTH0_CLIENT_ID, and AUTH0_CLIENT_SECRET. (ALLOW_INSECURE_AUTH0_DEV does not enable password grant.)',
            }
        ), 400
    
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400
    
    try:
        # Use Auth0's password grant (requires enabling it in Auth0 dashboard)
        token_url = f'https://{AUTH0_DOMAIN}/oauth/token'
        token_data = {
            'grant_type': 'password',
            'client_id': AUTH0_CLIENT_ID,
            'client_secret': AUTH0_CLIENT_SECRET,
            'username': email,
            'password': password,
            'scope': 'openid profile email',
            'audience': AUTH0_AUDIENCE,
            'connection': 'Username-Password-Authentication'  # Specify the database connection
        }
        
        response = requests.post(token_url, json=token_data, timeout=10)
        
        if not response.ok:
            error_data = response.json() if response.content else {}
            error_msg = error_data.get('error_description', 'Invalid email or password')
            return jsonify({'error': error_msg}), 401
        
        token_response = response.json()
        access_token = token_response.get('access_token')
        id_token = token_response.get('id_token')
        
        if not access_token or not id_token:
            return jsonify({'error': 'Failed to get tokens'}), 500
        
        # Decode ID token to get user info
        try:
            decoded = verify_token(id_token, is_id_token=True)
            user_info = {
                'sub': decoded.get('sub'),
                'name': decoded.get('name') or decoded.get('nickname') or '',
                'email': decoded.get('email') or '',
                'picture': decoded.get('picture') or '',
                'nickname': decoded.get('nickname') or decoded.get('name') or '',
            }
            
            # Store in session
            session['user'] = user_info
            session['access_token'] = access_token
            session.permanent = True
            
            return jsonify({
                'user': user_info,
                'message': 'Login successful'
            }), 200
        except Exception as e:
            print(f"Token decode error: {str(e)}")
            return jsonify({'error': 'Failed to decode token'}), 500
            
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Authentication failed: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Login failed: {str(e)}'}), 500

@bp.route('/auth/register', methods=['POST'])
def register():
    """Register new user with email/password"""
    if not is_auth0_configured():
        return jsonify(
            {
                'error': 'Registration requires Auth0. Set AUTH0_ISSUER_BASE_URL, AUTH0_CLIENT_ID, and AUTH0_CLIENT_SECRET. (ALLOW_INSECURE_AUTH0_DEV does not enable signup.)',
            }
        ), 400
    
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    name = data.get('name', '')
    
    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400
    
    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    
    try:
        # Use Auth0's signup API (requires enabling it in Auth0 dashboard)
        signup_url = f'https://{AUTH0_DOMAIN}/dbconnections/signup'
        signup_data = {
            'client_id': AUTH0_CLIENT_ID,
            'email': email,
            'password': password,
            'connection': 'Username-Password-Authentication',  # Default Auth0 database connection
        }
        
        if name:
            signup_data['name'] = name
        
        response = requests.post(signup_url, json=signup_data, timeout=10)
        
        if not response.ok:
            error_data = response.json() if response.content else {}
            error_msg = error_data.get('description', error_data.get('error', 'Registration failed'))
            return jsonify({'error': error_msg}), 400
        
        # After successful signup, automatically log them in using the same credentials
        # Call the login function directly with the credentials
        token_url = f'https://{AUTH0_DOMAIN}/oauth/token'
        token_data = {
            'grant_type': 'password',
            'client_id': AUTH0_CLIENT_ID,
            'client_secret': AUTH0_CLIENT_SECRET,
            'username': email,
            'password': password,
            'scope': 'openid profile email',
            'audience': AUTH0_AUDIENCE,
            'connection': 'Username-Password-Authentication'
        }
        
        login_response = requests.post(token_url, json=token_data, timeout=10)
        
        if not login_response.ok:
            # Registration succeeded but auto-login failed
            return jsonify({
                'message': 'Registration successful. Please log in.',
                'email': email
            }), 201
        
        token_response = login_response.json()
        access_token = token_response.get('access_token')
        id_token = token_response.get('id_token')
        
        if access_token and id_token:
            try:
                decoded = verify_token(id_token, is_id_token=True)
                user_info = {
                    'sub': decoded.get('sub'),
                    'name': decoded.get('name') or decoded.get('nickname') or name or '',
                    'email': decoded.get('email') or email,
                    'picture': decoded.get('picture') or '',
                    'nickname': decoded.get('nickname') or decoded.get('name') or name or '',
                }
                
                # Store in session
                session['user'] = user_info
                session['access_token'] = access_token
                session.permanent = True
                
                return jsonify({
                    'user': user_info,
                    'message': 'Registration and login successful'
                }), 201
            except Exception as e:
                print(f"Token decode error after registration: {str(e)}")
                return jsonify({
                    'message': 'Registration successful. Please log in.',
                    'email': email
                }), 201
        
        return jsonify({
            'message': 'Registration successful. Please log in.',
            'email': email
        }), 201
        
    except requests.exceptions.RequestException as e:
        error_data = {}
        try:
            if hasattr(e, 'response') and e.response:
                error_data = e.response.json() if e.response.content else {}
        except:
            pass
        error_msg = error_data.get('description', error_data.get('error', f'Registration failed: {str(e)}'))
        return jsonify({'error': error_msg}), 500
    except Exception as e:
        return jsonify({'error': f'Registration failed: {str(e)}'}), 500

@bp.route('/auth/callback', methods=['GET'])
def callback():
    """Handle Auth0 callback"""
    from flask import redirect as flask_redirect

    if not is_auth0_configured():
        return flask_redirect(f'{AUTH0_BASE_URL}?error=auth0_not_configured')
    
    code = request.args.get('code')
    if not code:
        return flask_redirect(f'{AUTH0_BASE_URL}?error=no_code')
    
    # Exchange code for token
    token_url = f'https://{AUTH0_DOMAIN}/oauth/token'
    token_data = {
        'grant_type': 'authorization_code',
        'client_id': AUTH0_CLIENT_ID,
        'client_secret': AUTH0_CLIENT_SECRET,
        'code': code,
        'redirect_uri': f'{BACKEND_URL}/api/auth/callback'
    }
    
    try:
        response = requests.post(token_url, json=token_data)
        if not response.ok:
            return flask_redirect(f'{AUTH0_BASE_URL}?error=token_exchange_failed')
        
        token_response = response.json()
        access_token = token_response.get('access_token')
        id_token = token_response.get('id_token')
        
        if not access_token or not id_token:
            return flask_redirect(f'{AUTH0_BASE_URL}?error=no_tokens')
        
        # Decode ID token to get user info
        # ID tokens use client_id as audience, not API audience
        try:
            decoded = verify_token(id_token, is_id_token=True)
            user_info = {
                'sub': decoded.get('sub'),
                'name': decoded.get('name') or decoded.get('nickname') or '',
                'email': decoded.get('email') or '',
                'picture': decoded.get('picture') or '',
                'nickname': decoded.get('nickname') or decoded.get('name') or '',
            }
            
            # Store in session
            session['user'] = user_info
            session['access_token'] = access_token
            session.permanent = True

            # Redirect to frontend dashboard (AUTH0_BASE_URL is the frontend URL)
            return flask_redirect(f'{AUTH0_BASE_URL}/dashboard')
        except Exception as e:
            error_msg = str(e)
            print(f"Token decode error: {error_msg}")
            import traceback
            traceback.print_exc()
            return flask_redirect(f'{AUTH0_BASE_URL}?error=token_decode_failed')
            
    except Exception as e:
        return flask_redirect(f'{AUTH0_BASE_URL}?error=token_exchange_error')

@bp.route('/auth/logout', methods=['POST', 'GET'])
def logout():
    """Logout user"""
    session.clear()
    
    # Redirect to Auth0 logout
    if is_auth0_configured():
        logout_url = (
            f'https://{AUTH0_DOMAIN}/v2/logout?'
            f'client_id={AUTH0_CLIENT_ID}&'
            f'returnTo={AUTH0_BASE_URL}'
        )
        return jsonify({'logout_url': logout_url}), 200
    
    return jsonify({'message': 'Logged out'}), 200

@bp.route('/auth/me', methods=['GET'])
@require_auth
def get_current_user(user_id):
    """Get current authenticated user. Includes role and departmentId from users collection if present."""
    try:
        user_info = get_user_info_from_request()
        _ensure_pg_user_row(user_info)
        try:
            from app.db.mongodb import get_db
            from app.services.permissions import (
                get_user_role,
                is_bootstrap_admin_email,
                is_bootstrap_org_owner_email,
                ROLE_ADMIN,
                ROLE_ORG_OWNER,
                session_may_manage_app_users,
            )

            db = get_db()
            app_user = db.users.find_one({'_id': user_id})
            if not app_user:
                # Secure default: view_only until provisioned; APP_ADMIN_EMAILS → admin; APP_ORG_OWNER_EMAILS → org_owner.
                _email = user_info.get('email') or ''
                _admin_by_email = is_bootstrap_admin_email(_email)
                _org_owner_by_email = is_bootstrap_org_owner_email(_email) and not _admin_by_email
                if _admin_by_email:
                    _initial_role = 'admin'
                elif _org_owner_by_email:
                    _initial_role = ROLE_ORG_OWNER
                else:
                    _initial_role = 'view_only'
                safe = {
                    '_id': user_id,
                    'role': _initial_role,
                    'name': user_info.get('name') or user_info.get('nickname') or '',
                    'email': _email,
                    'createdAt': datetime.utcnow().isoformat() + 'Z',
                }
                if _admin_by_email:
                    safe['okrCreateDisabled'] = False
                db.users.update_one({'_id': user_id}, {'$setOnInsert': safe}, upsert=True)
                user_info['needsProvisioning'] = True
            app_user = db.users.find_one({'_id': user_id})
            # Existing users: promote whitelist emails so Mongo and admin user list stay in sync.
            if app_user:
                _em = (user_info.get('email') or app_user.get('email') or '').strip()
                if is_bootstrap_admin_email(_em) and app_user.get('role') != 'admin':
                    db.users.update_one(
                        {'_id': user_id},
                        {
                            '$set': {
                                'role': 'admin',
                                'okrCreateDisabled': False,
                                'email': _em or app_user.get('email', ''),
                                'updatedAt': datetime.utcnow().isoformat() + 'Z',
                            }
                        },
                    )
                    app_user = db.users.find_one({'_id': user_id})
                elif (
                    is_bootstrap_org_owner_email(_em)
                    and not is_bootstrap_admin_email(_em)
                    and app_user.get('role') != ROLE_ORG_OWNER
                ):
                    db.users.update_one(
                        {'_id': user_id},
                        {
                            '$set': {
                                'role': ROLE_ORG_OWNER,
                                'email': _em or app_user.get('email', ''),
                                'updatedAt': datetime.utcnow().isoformat() + 'Z',
                            }
                        },
                    )
                    app_user = db.users.find_one({'_id': user_id})
            if app_user and app_user.get('departmentId') is not None:
                user_info['departmentId'] = str(app_user['departmentId'])

            # Keep Mongo email aligned with IdP so bootstrap env lists and listings stay correct.
            _session_email = (user_info.get('email') or '').strip()
            if app_user and _session_email and (app_user.get('email') or '').strip() != _session_email:
                db.users.update_one(
                    {'_id': user_id},
                    {'$set': {'email': _session_email, 'updatedAt': datetime.utcnow().isoformat() + 'Z'}},
                )
                app_user = db.users.find_one({'_id': user_id})

            user_info['role'] = get_user_role(db, user_id, _session_email or None)
            user_info['canManageAppUsers'] = session_may_manage_app_users(db, user_id, _session_email or None)
            if user_info['role'] == ROLE_ADMIN:
                user_info['okrCreateDisabled'] = False
            else:
                user_info['okrCreateDisabled'] = bool(app_user.get('okrCreateDisabled')) if app_user else False
            user_info['hideUserManagementNav'] = bool(app_user.get('hideUserManagementNav')) if app_user else False
        except Exception:
            user_info['role'] = user_info.get('role', 'developer')
        # Map departmentId to Postgres UUID so leader/view_only filters match objectives (UUID department_id).
        if os.getenv('DATABASE_URL'):
            try:
                from sqlalchemy import select

                from app.db.postgres import pg_session
                from app.models_sql import Membership
                from app.repositories.okr_repo_postgres import resolve_department_id_for_filter

                mongo_dep = user_info.get('departmentId')
                with pg_session() as s:
                    m = s.execute(
                        select(Membership)
                        .where(Membership.user_id == user_id)
                        .where(Membership.active.is_(True))
                        .where(Membership.department_id.isnot(None))
                    ).scalars().first()
                    if m and m.department_id:
                        user_info['departmentId'] = str(m.department_id)
                    elif mongo_dep:
                        resolved = resolve_department_id_for_filter(s, str(mongo_dep))
                        if resolved:
                            user_info['departmentId'] = resolved
            except Exception:
                pass
        if 'role' not in user_info:
            user_info['role'] = 'developer'
        user_info.setdefault('okrCreateDisabled', False)
        user_info.setdefault('hideUserManagementNav', False)
        user_info.setdefault('canManageAppUsers', False)
        return jsonify(user_info), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 401

@bp.route('/auth/token', methods=['GET'])
def get_token():
    """Get access token for API calls"""
    user = get_user_from_session()
    if not user:
        return jsonify({'error': 'Not authenticated'}), 401
    
    access_token = session.get('access_token')
    if not access_token:
        return jsonify({'error': 'No access token available'}), 401
    
    return jsonify({'accessToken': access_token}), 200


def require_admin(f):
    """Decorator to require authenticated admin (Mongo admin, ``APP_ADMIN_USER_IDS``, or ``APP_ADMIN_EMAILS``)."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            user_id = get_user_id_from_request()
            from app.db.mongodb import get_db
            from app.services.permissions import get_user_role, ROLE_ADMIN
            db = get_db()
            info = get_user_info_from_request()
            auth_em = (info.get('email') or '').strip() or None
            if get_user_role(db, user_id, auth_em) != ROLE_ADMIN:
                return jsonify({'error': 'Admin access required'}), 403
            kwargs['user_id'] = user_id
            return f(*args, **kwargs)
        except ValueError as e:
            return jsonify({'error': str(e)}), 401
        except Exception as e:
            return jsonify({'error': 'Authentication failed'}), 401
    return decorated_function


def require_user_management(f):
    """Authenticated users with role ``admin`` or ``org_owner`` may list/update app user records."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            user_id = get_user_id_from_request()
            from app.db.mongodb import get_db
            from app.services.permissions import session_may_manage_app_users
            db = get_db()
            info = get_user_info_from_request()
            auth_em = (info.get('email') or '').strip() or None
            if not session_may_manage_app_users(db, user_id, auth_em):
                return jsonify({'error': 'Admin or org owner access required'}), 403
            kwargs['user_id'] = user_id
            return f(*args, **kwargs)
        except ValueError as e:
            return jsonify({'error': str(e)}), 401
        except Exception as e:
            return jsonify({'error': 'Authentication failed'}), 401
    return decorated_function


@bp.route('/auth/users/names', methods=['GET'])
@require_auth
def list_user_names(user_id):
    """List all users' _id and name for dashboard display (any authenticated user)."""
    try:
        from app.db.mongodb import get_db
        db = get_db()
        cursor = db.users.find({}, {'_id': 1, 'name': 1})
        users = [{'_id': doc['_id'], 'name': doc.get('name', doc.get('email', str(doc['_id'])))} for doc in cursor]
        return jsonify(users), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def _user_row_from_mongo_doc(doc: dict) -> dict:
    """Build API user dict from Mongo users collection."""
    from app.services.permissions import is_bootstrap_admin_email, is_bootstrap_org_owner_email

    r = doc.get('role', 'view_only')
    if is_bootstrap_admin_email(doc.get('email')):
        r = 'admin'
    elif is_bootstrap_org_owner_email(doc.get('email')):
        r = 'org_owner'
    u = {
        '_id': doc['_id'],
        'role': r,
        'okrCreateDisabled': False if r == 'admin' else bool(doc.get('okrCreateDisabled')),
    }
    if doc.get('departmentId') is not None:
        u['departmentId'] = str(doc['departmentId'])
    if doc.get('name'):
        u['name'] = doc['name']
    if doc.get('email'):
        u['email'] = doc['email']
    u['hideUserManagementNav'] = bool(doc.get('hideUserManagementNav'))
    return u


@bp.route('/auth/users', methods=['GET'])
@require_user_management
def list_users(user_id):
    """List all users (admin only). Merges Auth0 directory with Mongo ``users`` so nothing is dropped:
    Auth0-only, Mongo-only, and merged rows all appear. Role / permissions live in Mongo."""
    try:
        from app.db.mongodb import get_db
        db = get_db()
        from app.services.permissions import is_bootstrap_admin_email, is_bootstrap_org_owner_email

        app_users_by_id = {
            doc['_id']: doc
            for doc in db.users.find(
                {},
                {
                    '_id': 1,
                    'role': 1,
                    'departmentId': 1,
                    'name': 1,
                    'email': 1,
                    'okrCreateDisabled': 1,
                    'hideUserManagementNav': 1,
                },
            )
        }
        auth0_users = list_auth0_users()
        users = []
        seen: set[str] = set()

        if auth0_users is not None:
            for au in auth0_users:
                uid = au.get('user_id') or au.get('sub') or ''
                if not uid:
                    continue
                seen.add(uid)
                app = app_users_by_id.get(uid) or {}
                row_email = (au.get('email') or app.get('email') or '').strip()
                base_role = app.get('role') or 'view_only'
                if is_bootstrap_admin_email(row_email):
                    base_role = 'admin'
                elif is_bootstrap_org_owner_email(row_email):
                    base_role = 'org_owner'
                u = {
                    '_id': uid,
                    'role': base_role,
                    'name': au.get('name') or app.get('name') or au.get('email') or '',
                    'email': row_email or (au.get('email') or app.get('email') or ''),
                }
                if app.get('departmentId') is not None:
                    u['departmentId'] = str(app['departmentId'])
                u['okrCreateDisabled'] = False if u['role'] == 'admin' else bool(app.get('okrCreateDisabled'))
                u['hideUserManagementNav'] = bool(app.get('hideUserManagementNav'))
                users.append(u)
            # Users present in Mongo but missing from Auth0 listing (e.g. stale id, different connection)
            for uid, doc in app_users_by_id.items():
                if uid in seen:
                    continue
                users.append(_user_row_from_mongo_doc(doc))
        else:
            # Auth0 Management API unavailable — all app users from Mongo
            for doc in app_users_by_id.values():
                users.append(_user_row_from_mongo_doc(doc))

        users.sort(
            key=lambda x: (
                (x.get('name') or x.get('email') or x.get('_id') or '').lower(),
                x.get('_id') or '',
            )
        )
        return jsonify(users), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/auth/users/<uid>', methods=['PATCH'])
@require_user_management
def update_user(user_id, uid):
    """Update a user's role and/or departmentId (admin or org owner). Only admins may assign the admin role."""
    try:
        from app.db.mongodb import get_db
        db = get_db()
        data = request.get_json() or {}
        update = {}
        from app.services.permissions import USER_APP_ROLES, get_user_role, ROLE_ADMIN

        caller_info = get_user_info_from_request()
        caller_auth_em = (caller_info.get('email') or '').strip() or None
        caller_role = get_user_role(db, user_id, caller_auth_em)
        if 'role' in data and data['role'] in USER_APP_ROLES:
            if data['role'] == ROLE_ADMIN and caller_role != ROLE_ADMIN:
                return jsonify({'error': 'Only administrators can assign the admin role'}), 403
            update['role'] = data['role']
            if data['role'] == 'admin':
                update['okrCreateDisabled'] = False
        if 'departmentId' in data:
            update['departmentId'] = data['departmentId'] if data['departmentId'] else None
        if 'okrCreateDisabled' in data:
            effective_role = update.get('role')
            if effective_role is None:
                existing = db.users.find_one({'_id': uid}, {'role': 1})
                effective_role = existing.get('role') if existing else None
            if effective_role != 'admin':
                update['okrCreateDisabled'] = bool(data['okrCreateDisabled'])
        if 'hideUserManagementNav' in data:
            update['hideUserManagementNav'] = bool(data['hideUserManagementNav'])
        if not update:
            return jsonify({'error': 'No valid fields to update'}), 400
        update['updatedAt'] = datetime.utcnow().isoformat() + 'Z'
        result = db.users.update_one(
            {'_id': uid},
            {'$set': update},
            upsert=True
        )
        if result.matched_count == 0 and not result.upserted_count:
            return jsonify({'error': 'User not found'}), 404
        updated = db.users.find_one(
            {'_id': uid},
            {'_id': 1, 'role': 1, 'departmentId': 1, 'okrCreateDisabled': 1, 'hideUserManagementNav': 1},
        )
        out = {
            '_id': updated['_id'],
            'role': updated.get('role', 'view_only'),
            'okrCreateDisabled': bool(updated.get('okrCreateDisabled')),
            'hideUserManagementNav': bool(updated.get('hideUserManagementNav')),
        }
        if updated.get('departmentId') is not None:
            out['departmentId'] = str(updated['departmentId'])
        return jsonify(out), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
