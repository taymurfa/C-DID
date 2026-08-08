"""Email API: send and test SMTP (Zoho)."""
from flask import Blueprint, request, jsonify
from app.services.mail import send_email, is_configured

bp = Blueprint('email', __name__)


@bp.route('/email/status', methods=['GET'])
def email_status():
    """Return whether SMTP is configured (no auth required for status)."""
    return jsonify({'smtp_configured': is_configured()}), 200


@bp.route('/email/send', methods=['POST'])
def email_send():
    """
    Send an email. Body: { "to": "email@example.com", "subject": "...", "body": "..." }.
    Optional: "body_html", "reply_to".
    """
    if not is_configured():
        return jsonify({'error': 'SMTP is not configured. Set SMTP_USER and SMTP_PASSWORD in backend .env.'}), 503
    data = request.get_json() or {}
    to = data.get('to')
    subject = data.get('subject')
    body = data.get('body') or data.get('text') or ''
    body_html = data.get('body_html')
    reply_to = data.get('reply_to')
    if not to or not subject:
        return jsonify({'error': 'Missing "to" or "subject".'}), 400
    try:
        send_email(to=to, subject=subject, body_text=body, body_html=body_html, reply_to=reply_to)
        return jsonify({'message': 'Email sent successfully.'}), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'Failed to send email: {str(e)}'}), 500


@bp.route('/email/test', methods=['POST'])
def email_test():
    """
    Send a test email to the address in the request body: { "to": "you@example.com" }.
    If "to" is omitted, sends to SMTP_FROM (your Zoho address).
    """
    if not is_configured():
        return jsonify({'error': 'SMTP is not configured. Set SMTP_USER and SMTP_PASSWORD in backend .env.'}), 503
    data = request.get_json() or {}
    to = data.get('to') or None  # will use SMTP_FROM if not provided
    if not to:
        from app.services.mail import _get_config
        _, _, user, _, from_addr = _get_config()
        to = from_addr or user
    if not to:
        return jsonify({'error': 'Provide "to" in the request body or set SMTP_FROM in .env.'}), 400
    try:
        send_email(
            to=to,
            subject='Test email from Claude Home',
            body_text='This is a test email from your Hackathon Template backend. SMTP (Zoho) is working.',
            body_html='<p>This is a test email from your <strong>Hackathon Template</strong> backend.</p><p>SMTP (Zoho) is working.</p>',
        )
        return jsonify({'message': f'Test email sent to {to}.'}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to send test email: {str(e)}'}), 500
