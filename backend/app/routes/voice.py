"""Voice message generator: Magic Hour (celebrity voices) and OpenAI TTS (fast)."""

from flask import Blueprint, request, Response, jsonify
import os
import time
import requests

bp = Blueprint('voice', __name__)

MAGICHOUR_API_URL = "https://api.magichour.ai"
OPENAI_API_URL = "https://api.openai.com/v1"


def _generate_openai_tts(text: str, voice: str, model: str, speed: float) -> Response:
    """Call OpenAI TTS and return audio response. Fast, synchronous."""
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        return jsonify({'error': 'OPENAI_API_KEY is not configured (required for OpenAI TTS)'}), 500

    payload = {
        'model': model,
        'input': text,
        'voice': voice,
        'response_format': 'mp3',
    }
    if speed != 1.0:
        payload['speed'] = round(speed, 2)

    resp = requests.post(
        f"{OPENAI_API_URL}/audio/speech",
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json=payload,
        timeout=60,
    )

    if not resp.ok:
        try:
            err = resp.json()
            msg = err.get('error', {}).get('message', resp.text) if isinstance(err.get('error'), dict) else resp.text
        except Exception:
            msg = resp.text or resp.reason
        return jsonify({'error': f'OpenAI TTS error: {msg}'}), resp.status_code

    return Response(
        resp.content,
        mimetype='audio/mpeg',
        headers={'Content-Disposition': 'inline; filename="voice-openai.mp3"'},
    )


def _generate_magic_hour(text: str, voice_name: str, name: str, api_key: str) -> tuple:
    """Call Magic Hour API (async + poll) and return (Response, status_code) or (jsonify_error, code)."""
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {api_key}',
    }
    payload = {
        'name': name,
        'style': {'prompt': text, 'voice_name': voice_name},
    }

    create_resp = requests.post(
        f"{MAGICHOUR_API_URL}/v1/ai-voice-generator",
        headers=headers,
        json=payload,
        timeout=30,
    )
    if not create_resp.ok:
        try:
            err = create_resp.json()
            msg = err.get('message') or create_resp.text
        except Exception:
            msg = create_resp.text or create_resp.reason
        return jsonify({'error': f'Magic Hour API error (create): {msg}'}), create_resp.status_code

    audio_id = create_resp.json().get('id')
    if not audio_id:
        return jsonify({'error': 'Magic Hour API did not return an audio id'}), 500

    status = None
    downloads = []
    start_time = time.time()
    timeout_seconds = 180

    while time.time() - start_time < timeout_seconds:
        details_resp = requests.get(
            f"{MAGICHOUR_API_URL}/v1/audio-projects/{audio_id}",
            headers=headers,
            timeout=15,
        )
        if not details_resp.ok:
            try:
                err = details_resp.json()
                msg = err.get('message') or details_resp.text
            except Exception:
                msg = details_resp.text or details_resp.reason
            return jsonify({'error': f'Magic Hour API error (status): {msg}'}), details_resp.status_code

        details = details_resp.json()
        status = details.get('status')
        downloads = details.get('downloads') or []

        if status == 'complete' and downloads:
            break
        if status == 'error':
            error_info = details.get('error') or {}
            message = error_info.get('message', 'unknown error')
            return jsonify({'error': f'Magic Hour render error: {message}'}), 500
        time.sleep(2)

    if status != 'complete' or not downloads:
        last_status = status or 'unknown'
        return jsonify({
            'error': f'Timed out waiting for Magic Hour audio (last status: {last_status}). Try again or use shorter text.'
        }), 504

    download_url = downloads[0].get('url')
    if not download_url:
        return jsonify({'error': 'Magic Hour response did not include a download URL'}), 500

    audio_resp = requests.get(download_url, timeout=60)
    if not audio_resp.ok:
        return jsonify({'error': 'Failed to download audio from Magic Hour'}), 502

    mimetype = audio_resp.headers.get('Content-Type', 'audio/wav')
    return (
        Response(
            audio_resp.content,
            mimetype=mimetype,
            headers={'Content-Disposition': 'inline; filename="voice-from-magic-hour"'},
        ),
        200,
    )


@bp.route('/voice/generate', methods=['POST'])
def generate_voice():
    """Convert text to speech. Provider: 'openai' (fast) or 'magic_hour' (celebrity voices)."""
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({'error': 'Text is required'}), 400

        text = data['text'].strip()
        if not text:
            return jsonify({'error': 'Text cannot be empty'}), 400

        provider = (data.get('provider') or 'openai').strip().lower()
        if provider not in ('openai', 'magic_hour'):
            return jsonify({'error': 'provider must be "openai" or "magic_hour"'}), 400

        if provider == 'openai':
            voice = data.get('voice', 'alloy')
            model = data.get('model', 'tts-1')
            speed = float(data.get('speed', 1.0))
            if not (0.25 <= speed <= 4.0):
                speed = 1.0
            return _generate_openai_tts(text, voice=voice, model=model, speed=speed)

        # Magic Hour
        api_key = os.getenv('MAGICHOUR_API_KEY')
        if not api_key:
            return jsonify({'error': 'MAGICHOUR_API_KEY is not configured'}), 500
        voice_name = data.get('voice_name', 'Elon Musk')
        name = data.get('name') or 'Voice Generator - via API'
        body, code = _generate_magic_hour(text, voice_name=voice_name, name=name, api_key=api_key)
        return body, code

    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Network error: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Internal error: {str(e)}'}), 500
