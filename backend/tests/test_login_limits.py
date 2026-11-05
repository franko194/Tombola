from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.auth import LOCKOUT_MINUTES, MAX_FAILED_LOGINS, hash_password
from app.database import Base, SessionLocal, engine, init_db
from app.main import app
from app.models import LoginFailure, Organizer, utc_now

EMAIL = "limite@example.com"
PASSWORD = "clave-segura-1"


def setup_function():
    Base.metadata.drop_all(bind=engine)
    init_db()
    with SessionLocal() as db:
        db.add(Organizer(email=EMAIL, active=True, password_hash=hash_password(PASSWORD), created_at=utc_now()))
        db.add(Organizer(email="otra@example.com", active=True, password_hash=hash_password(PASSWORD), created_at=utc_now()))
        db.commit()


def attempt(client: TestClient, password: str, email: str = EMAIL):
    return client.post("/auth/login", json={"email": email, "password": password})


def test_login_is_blocked_after_too_many_failures_even_with_the_right_password():
    client = TestClient(app)
    for _ in range(MAX_FAILED_LOGINS):
        assert attempt(client, "incorrecta").status_code == 401

    blocked = attempt(client, PASSWORD)

    assert blocked.status_code == 429
    assert str(LOCKOUT_MINUTES) in blocked.json()["detail"]
    assert blocked.headers["retry-after"] == str(LOCKOUT_MINUTES * 60)


def test_the_block_only_affects_the_email_that_failed():
    client = TestClient(app)
    for _ in range(MAX_FAILED_LOGINS):
        attempt(client, "incorrecta")

    assert attempt(client, PASSWORD, email="otra@example.com").status_code == 200


def test_a_successful_login_resets_the_failure_count():
    client = TestClient(app)
    for _ in range(MAX_FAILED_LOGINS - 1):
        attempt(client, "incorrecta")
    assert attempt(client, PASSWORD).status_code == 200

    # The counter started over, so the next failures do not trigger the block yet.
    for _ in range(MAX_FAILED_LOGINS - 1):
        assert attempt(client, "incorrecta").status_code == 401
    assert attempt(client, PASSWORD).status_code == 200


def test_old_failures_do_not_count_and_are_removed():
    old = (datetime.now(timezone.utc) - timedelta(minutes=LOCKOUT_MINUTES + 1)).isoformat()
    with SessionLocal() as db:
        db.add_all([LoginFailure(email=EMAIL, created_at=old) for _ in range(MAX_FAILED_LOGINS)])
        db.commit()
    client = TestClient(app)

    assert attempt(client, "incorrecta").status_code == 401

    with SessionLocal() as db:
        remaining = db.query(LoginFailure).filter(LoginFailure.email == EMAIL).count()
    assert remaining == 1


def test_unknown_emails_are_counted_too_so_the_response_does_not_reveal_who_exists():
    client = TestClient(app)
    for _ in range(MAX_FAILED_LOGINS):
        assert attempt(client, "x", email="no-existe@example.com").status_code == 401

    assert attempt(client, "x", email="no-existe@example.com").status_code == 429
