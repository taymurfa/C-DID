import base64
import os

from cryptography.fernet import Fernet


def _get_fernet() -> Fernet:
    """
    INTEGRATIONS_TOKEN_KEY must be a base64-encoded 32-byte key.
    Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    """
    key = (os.getenv("INTEGRATIONS_TOKEN_KEY") or "").strip()
    if not key:
        raise ValueError("INTEGRATIONS_TOKEN_KEY is not set")
    try:
        # Validate base64
        base64.urlsafe_b64decode(key.encode())
    except Exception as e:
        raise ValueError("INTEGRATIONS_TOKEN_KEY must be urlsafe base64") from e
    return Fernet(key.encode())


def encrypt_token(token: str) -> str:
    f = _get_fernet()
    return f.encrypt(token.encode("utf-8")).decode("utf-8")


def decrypt_token(token_enc: str) -> str:
    f = _get_fernet()
    return f.decrypt(token_enc.encode("utf-8")).decode("utf-8")

