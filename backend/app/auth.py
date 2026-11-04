import base64
import hashlib
import hmac
import json
import os
import secrets
import time

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Organizer

COOKIE_NAME = "ia_friday_organizer"
SESSION_HOURS = 12


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str | None) -> bool:
    if not stored or "$" not in stored:
        return False
    salt_hex, digest_hex = stored.split("$", 1)
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), n=2**14, r=8, p=1, dklen=32)
    return hmac.compare_digest(digest.hex(), digest_hex)


def authenticate_organizer(db: Session, email: str, password: str) -> Organizer | None:
    organizer = db.query(Organizer).filter(Organizer.email == email.strip().lower(), Organizer.active == True).first()  # noqa: E712
    if organizer is None or not verify_password(password, organizer.password_hash):
        return None
    return organizer


def is_organizer(db: Session, email: str) -> bool:
    return db.query(Organizer).filter(Organizer.email == email.lower(), Organizer.active == True).first() is not None  # noqa: E712


def _secret() -> bytes | None:
    value = os.environ.get("SESSION_SECRET", "")
    return value.encode() if value else None


def _sign(payload: str, secret: bytes) -> str:
    return hmac.new(secret, payload.encode(), hashlib.sha256).hexdigest()


def create_session_token(email: str) -> str:
    secret = _secret()
    if secret is None:
        raise HTTPException(status_code=503, detail="SESSION_SECRET is not configured")
    expires = int(time.time()) + SESSION_HOURS * 3600
    payload = base64.urlsafe_b64encode(json.dumps({"email": email, "exp": expires}).encode()).decode()
    return f"{payload}.{_sign(payload, secret)}"


def read_session_email(token: str | None) -> str | None:
    secret = _secret()
    if not token or secret is None or "." not in token:
        return None
    payload, signature = token.rsplit(".", 1)
    if not hmac.compare_digest(signature, _sign(payload, secret)):
        return None
    try:
        data = json.loads(base64.urlsafe_b64decode(payload.encode()))
    except (ValueError, TypeError):
        return None
    if int(data.get("exp", 0)) < time.time():
        return None
    return str(data.get("email", "")).lower() or None


def require_organizer(request: Request, db: Session = Depends(get_db)) -> str:
    email = read_session_email(request.cookies.get(COOKIE_NAME))
    # Checked on every request, so setting active to false in the organizers table revokes access right away.
    if not email or not is_organizer(db, email):
        raise HTTPException(status_code=401, detail="Organizer login required")
    return email


def require_admin(request: Request, db: Session = Depends(get_db)) -> str:
    email = require_organizer(request, db)
    organizer = db.query(Organizer).filter(Organizer.email == email).first()
    if organizer is None or not organizer.is_admin:
        raise HTTPException(status_code=403, detail="Solo los administradores pueden hacer esto")
    return email
