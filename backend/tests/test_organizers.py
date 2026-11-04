from fastapi.testclient import TestClient

from app.auth import COOKIE_NAME, create_session_token
from app.database import Base, SessionLocal, engine, init_db
from app.main import app
from app.models import Organizer

ADMIN = "organizador@example.com"
OTHER_ADMIN = "otro-admin@example.com"


def setup_function():
    Base.metadata.drop_all(bind=engine)
    init_db()
    with SessionLocal() as db:
        db.query(Organizer).filter(Organizer.email == ADMIN).update({"is_admin": True})
        db.commit()


def login_as(email: str) -> TestClient:
    client = TestClient(app)
    client.cookies.set(COOKIE_NAME, create_session_token(email))
    return client


def organizer_id(email: str) -> int:
    with SessionLocal() as db:
        return db.query(Organizer).filter(Organizer.email == email).one().id


def test_only_admins_can_list_or_create_organizers():
    with SessionLocal() as db:
        db.add(Organizer(email="normal@example.com", active=True, is_admin=False, created_at="2026-01-01"))
        db.commit()
    normal = login_as("normal@example.com")

    assert normal.get("/organizers").status_code == 403
    assert normal.post("/organizers", json={"email": "x@example.com", "password": "clave-larga"}).status_code == 403


def test_admin_creates_an_organizer_that_can_log_in_and_is_not_admin_by_default():
    admin = login_as(ADMIN)

    created = admin.post("/organizers", json={"email": "Nuevo@Example.com", "password": "clave-nueva"})
    assert created.status_code == 201
    assert created.json()["email"] == "nuevo@example.com"
    assert created.json()["is_admin"] is False
    assert "password" not in created.json()

    client = TestClient(app, base_url="https://testserver")
    assert client.post("/auth/login", json={"email": "nuevo@example.com", "password": "clave-nueva"}).status_code == 200
    assert client.get("/auth/me").json()["is_admin"] is False
    assert client.get("/sessions").status_code == 200


def test_creating_an_existing_organizer_or_short_password_is_rejected():
    admin = login_as(ADMIN)

    assert admin.post("/organizers", json={"email": ADMIN, "password": "clave-larga"}).status_code == 409
    assert admin.post("/organizers", json={"email": "corto@example.com", "password": "123"}).status_code == 422


def test_admin_can_grant_admin_reset_password_and_deactivate_another_organizer():
    admin = login_as(ADMIN)
    admin.post("/organizers", json={"email": OTHER_ADMIN, "password": "clave-larga"})
    target = organizer_id(OTHER_ADMIN)

    updated = admin.patch(f"/organizers/{target}", json={"is_admin": True, "password": "otra-clave-larga"})
    assert updated.status_code == 200
    assert updated.json()["is_admin"] is True

    other = TestClient(app, base_url="https://testserver")
    assert other.post("/auth/login", json={"email": OTHER_ADMIN, "password": "otra-clave-larga"}).status_code == 200
    assert other.get("/organizers").status_code == 200

    assert admin.patch(f"/organizers/{target}", json={"active": False}).json()["active"] is False
    assert login_as(OTHER_ADMIN).get("/organizers").status_code == 401


def test_admin_cannot_deactivate_or_demote_themselves():
    admin = login_as(ADMIN)
    me = organizer_id(ADMIN)

    assert admin.patch(f"/organizers/{me}", json={"active": False}).status_code == 409
    assert admin.patch(f"/organizers/{me}", json={"is_admin": False}).status_code == 409
    assert admin.get("/organizers").status_code == 200


def test_listing_never_exposes_password_hashes():
    admin = login_as(ADMIN)
    admin.post("/organizers", json={"email": "lista@example.com", "password": "clave-larga"})

    organizers = admin.get("/organizers").json()
    assert all("password_hash" not in item for item in organizers)
    assert next(item for item in organizers if item["email"] == "lista@example.com")["has_password"] is True
