"""Create a Google Slides presentation from OKR data."""
import os
from app.db.mongodb import get_db
from bson import ObjectId


def _get_credentials(user_id):
    """Build credentials from stored refresh token."""
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    db = get_db()
    doc = db.integration_configs.find_one({'_id': user_id})
    if not doc or not doc.get('googleRefreshToken'):
        raise ValueError('Google account not connected. Connect in Integrations.')
    def _s(v):
        return (v or '').strip().strip('"\'').strip() if v else ''
    client_id = _s(os.getenv('GOOGLE_CLIENT_ID'))
    client_secret = _s(os.getenv('GOOGLE_CLIENT_SECRET'))
    if not client_id or not client_secret:
        raise ValueError('Google integration not configured')
    creds = Credentials(
        token=None,
        refresh_token=doc['googleRefreshToken'],
        token_uri='https://oauth2.googleapis.com/token',
        client_id=client_id,
        client_secret=client_secret,
        scopes=['https://www.googleapis.com/auth/presentations', 'https://www.googleapis.com/auth/drive.file'],
    )
    creds.refresh(Request())
    return creds


def _load_objectives_for_export(tree_root_id, objective_ids):
    """Return list of (objective_doc, key_results_list) for the given scope."""
    db = get_db()
    if tree_root_id:
        oid = _parse_oid(tree_root_id)
        if not oid:
            raise ValueError('Invalid treeRootId')
        root = db.objectives.find_one({'_id': oid})
        if not root:
            raise ValueError('Objective not found')
        # Build flat list: root + all descendants (BFS)
        stack = [root]
        result = []
        while stack:
            obj = stack.pop()
            krs = list(db.key_results.find({'objectiveId': obj['_id']}))
            result.append((obj, krs))
            for child in db.objectives.find({'parentObjectiveId': obj['_id']}):
                stack.append(child)
        return result
    if objective_ids:
        result = []
        for oid_str in objective_ids:
            oid = _parse_oid(oid_str)
            if not oid:
                continue
            obj = db.objectives.find_one({'_id': oid})
            if obj:
                krs = list(db.key_results.find({'objectiveId': oid}))
                result.append((obj, krs))
        return result
    return []


def _parse_oid(value):
    try:
        return ObjectId(value)
    except Exception:
        return None


def create_okr_presentation(user_id, tree_root_id=None, objective_ids=None):
    """
    Create a Google Slides presentation with one title slide and one slide per objective (with key results).
    Returns { presentationId, link }.
    """
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError

    creds = _get_credentials(user_id)
    service = build('slides', 'v1', credentials=creds)
    drive_service = build('drive', 'v3', credentials=creds)

    items = _load_objectives_for_export(tree_root_id, objective_ids)
    if not items:
        raise ValueError('No objectives to export')

    title = 'OKR Export (Hierarchy + RBAC)'
    body = {
        'title': title,
    }
    presentation = service.presentations().create(body=body).execute()
    presentation_id = presentation.get('presentationId')

    # Create title slide + one slide per objective
    requests = [{'createSlide': {'slideLayoutReference': {'predefinedLayout': 'TITLE'}}}]
    for _ in items:
        requests.append({'createSlide': {'slideLayoutReference': {'predefinedLayout': 'TITLE_AND_BODY'}}})

    service.presentations().batchUpdate(
        presentationId=presentation_id,
        body={'requests': requests},
    ).execute()

    pres = service.presentations().get(presentationId=presentation_id).execute()
    slides = pres.get('slides', [])

    # Build map of objectId -> current text length (to avoid deleteText on empty shapes; API rejects startIndex=endIndex=0)
    def _text_length(element):
        for run in element.get('shape', {}).get('text', {}).get('textElements', []) or []:
            if 'textRun' in run and run['textRun'].get('content'):
                return len(run['textRun']['content'])
        return 0

    text_length_by_id = {}
    for slide in slides:
        for el in slide.get('pageElements', []):
            text_length_by_id[el['objectId']] = _text_length(el)

    def set_shape_text(obj_id, text):
        text = (text or '')[:3000]
        requests = []
        if text_length_by_id.get(obj_id, 0) > 0:
            requests.append({'deleteText': {'objectId': obj_id, 'textRange': {'type': 'ALL'}}})
        requests.append({'insertText': {'objectId': obj_id, 'text': text, 'insertionIndex': 0}})
        service.presentations().batchUpdate(
            presentationId=presentation_id,
            body={'requests': requests},
        ).execute()

    # Title slide (first slide)
    if slides:
        for el in slides[0].get('pageElements', []):
            if el.get('shape', {}).get('shapeType') == 'TEXT_BOX':
                set_shape_text(el['objectId'], title)
                break

    # Objective slides
    for i, (obj, krs) in enumerate(items):
        if i + 1 >= len(slides):
            break
        slide = slides[i + 1]
        title_text = (obj.get('title') or 'Untitled')[:300]
        body_parts = [f"Status: {obj.get('status', '')}"] if obj.get('status') else []
        for kr in krs[:10]:
            score = kr.get('score')
            score_str = f" {int((score or 0) * 100)}%" if score is not None else ""
            body_parts.append(f"• {(kr.get('title') or '')[:80]}{score_str}")
        body_text = '\n'.join(body_parts)[:3000]

        text_box_ids = [el['objectId'] for el in slide.get('pageElements', []) if el.get('shape', {}).get('shapeType') == 'TEXT_BOX']
        if len(text_box_ids) >= 1:
            set_shape_text(text_box_ids[0], title_text)
        if len(text_box_ids) >= 2:
            set_shape_text(text_box_ids[1], body_text)

    # Make file accessible (optional - so user can open)
    try:
        drive_service.permissions().create(
            fileId=presentation_id,
            body={'type': 'anyone', 'role': 'reader'},
        ).execute()
    except HttpError:
        pass

    link = f'https://docs.google.com/presentation/d/{presentation_id}/edit'
    return {'presentationId': presentation_id, 'link': link}
