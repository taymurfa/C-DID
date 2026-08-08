"""Post OKR updates to Slack/Teams (and generic webhooks)."""
import requests


def post_okr_update_to_webhook(webhook_url: str, channel_type: str, payload: dict) -> bool:
    """
    POST a formatted message to webhook_url. channel_type is 'slack' or 'teams'.
    payload: { title, text, objective_id?, status?, actor? }
    Returns True if request succeeded (2xx).
    """
    if not webhook_url or not webhook_url.startswith('https://'):
        return False
    try:
        if channel_type == 'slack':
            # Slack Incoming Webhook: https://api.slack.com/messaging/webhooks
            body = {'text': payload.get('text') or payload.get('title', 'OKR Update')}
            if payload.get('title'):
                body['text'] = f"*{payload['title']}*\n{body.get('text', '')}"
        elif channel_type == 'teams':
            # Microsoft Teams Incoming Webhook (Office 365 Connector)
            body = {
                '@type': 'MessageCard',
                '@context': 'https://schema.org/extensions',
                'summary': payload.get('title', 'OKR Update'),
                'title': payload.get('title', 'OKR Update'),
                'text': payload.get('text', ''),
            }
        else:
            # Generic webhook: JSON body
            body = payload
        r = requests.post(webhook_url, json=body, timeout=10)
        return 200 <= r.status_code < 300
    except Exception:
        return False


def format_okr_update_message(objective_title: str, status: str, actor_name: str = '', event_type: str = 'status_change') -> dict:
    """Build payload for post_okr_update_to_webhook."""
    title = 'OKR Update'
    text = f"**{objective_title}** — Status: {status}"
    if actor_name:
        text += f" (by {actor_name})"
    return {'title': title, 'text': text, 'status': status, 'event_type': event_type}
