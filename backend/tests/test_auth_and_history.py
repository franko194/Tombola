from fastapi.testclient import TestClient

from app.auth import COOKIE_NAME, create_session_token, hash_password
from app.database import Base, engine, init_db
from app.main import app

ORGANIZER = "organizador@example.com"


def setup_function():
    Base.metadata.drop_all(bind=engine)
    init_db()  # also seeds the organizers table from ORGANIZER_EMAILS


def organizer_client() -> TestClient:
    client = TestClient(app)
    client.cookies.set(COOKIE_NAME, create_session_token(ORGANIZER))
    return client


def test_organizer_routes_require_login():
    anonymous = TestClient(app)

    assert anonymous.get("/sessions").status_code == 401
    assert anonymous.post("/sessions", json={"name": "X", "date": "2026-06-05"}).status_code == 401


def test_cookie_for_an_email_outside_the_allowlist_is_rejected():
    client = TestClient(app)
    client.cookies.set(COOKIE_NAME, create_session_token("intruso@example.com"))

    assert client.get("/sessions").status_code == 401


def test_judge_routes_stay_public():
    anonymous = TestClient(app)

    # 404 means the judge handler ran without a login; 401 would mean it was protected.
    assert anonymous.get("/judge/token-inexistente").status_code == 404


def set_password(email: str, password: str) -> None:
    from app.database import SessionLocal
    from app.models import Organizer

    with SessionLocal() as db:
        db.query(Organizer).filter(Organizer.email == email).update({"password_hash": hash_password(password)})
        db.commit()


def test_login_rejects_wrong_password_and_non_organizers():
    set_password(ORGANIZER, "clave-segura")
    client = TestClient(app, base_url="https://testserver")

    assert client.post("/auth/login", json={"email": ORGANIZER, "password": "otra"}).status_code == 401
    assert client.post("/auth/login", json={"email": "intruso@example.com", "password": "clave-segura"}).status_code == 401
    assert client.get("/auth/me").status_code == 401


def test_login_with_correct_password_sets_cookie():
    set_password(ORGANIZER, "clave-segura")
    client = TestClient(app, base_url="https://testserver")

    response = client.post("/auth/login", json={"email": ORGANIZER.upper(), "password": "clave-segura"})

    assert response.status_code == 200
    assert client.get("/auth/me").json()["email"] == ORGANIZER


def test_organizer_without_password_cannot_log_in():
    client = TestClient(app, base_url="https://testserver")

    assert client.post("/auth/login", json={"email": ORGANIZER, "password": ""}).status_code == 401


def test_csv_import_updates_existing_names_and_adds_new_ones():
    client = organizer_client()
    session_id = client.post("/sessions", json={"name": "Import", "date": "2026-06-05"}).json()["id"]
    client.post(f"/sessions/{session_id}/participants", json={"name": "Ana Pérez", "ai_level": 1})

    csv_content = "nombre,nivelIA\nANA PEREZ,4\nPedro Soto,2\n"
    response = client.post(
        f"/sessions/{session_id}/participants/import",
        files={"file": ("personas.csv", csv_content.encode("utf-8"), "text/csv")},
    )

    assert response.status_code == 200
    participants = client.get(f"/sessions/{session_id}/participants").json()
    assert len(participants) == 2
    ana = next(item for item in participants if item["name"] == "ANA PEREZ")
    assert ana["ai_level"] == 4


def test_editing_a_participant_archives_the_previous_draw():
    client = organizer_client()
    session_id = client.post("/sessions", json={"name": "Historial", "date": "2026-06-05"}).json()["id"]
    for index, level in enumerate([5, 4, 3, 2], start=1):
        client.post(f"/sessions/{session_id}/participants", json={"name": f"Persona {index}", "ai_level": level})
    client.post(f"/sessions/{session_id}/use-cases", json={"title": "Caso A"})
    client.post(f"/sessions/{session_id}/teams/generate", json={"number_of_teams": 2})
    client.post(f"/sessions/{session_id}/use-cases/assign", json={"mode": "random"})

    first = client.get(f"/sessions/{session_id}/participants").json()[0]
    client.patch(f"/participants/{first['id']}", json={"name": "Persona editada"})

    history = client.get(f"/sessions/{session_id}/draw-history").json()
    assert len(history) == 1
    assert history[0]["reason"] == "participant_edited"
    assert len(history[0]["teams"]) == 2
    assert len(history[0]["assignments"]) == 2


def test_history_entry_can_get_a_note_and_be_deleted():
    client = organizer_client()
    session_id = client.post("/sessions", json={"name": "Notas", "date": "2026-06-05"}).json()["id"]
    for index in range(1, 3):
        client.post(f"/sessions/{session_id}/participants", json={"name": f"Persona {index}", "ai_level": index})
    client.post(f"/sessions/{session_id}/teams/generate", json={"number_of_teams": 1})
    client.post(f"/sessions/{session_id}/participants", json={"name": "Persona 3", "ai_level": 3})
    entry_id = client.get(f"/sessions/{session_id}/draw-history").json()[0]["id"]

    edited = client.patch(f"/sessions/{session_id}/draw-history/{entry_id}", json={"note": "  Sorteo de prueba  "})
    assert edited.status_code == 200
    assert edited.json()["note"] == "Sorteo de prueba"

    assert client.delete(f"/sessions/{session_id}/draw-history/{entry_id}").status_code == 200
    assert client.get(f"/sessions/{session_id}/draw-history").json() == []


def test_import_replaces_the_whole_participant_list():
    client = organizer_client()
    session_id = client.post("/sessions", json={"name": "Reemplazo", "date": "2026-06-05"}).json()["id"]
    client.post(f"/sessions/{session_id}/participants", json={"name": "Persona vieja", "ai_level": 1})

    csv_content = "nombre,nivelIA\nNueva Uno,2\nNueva Dos,3\n"
    client.post(
        f"/sessions/{session_id}/participants/import",
        files={"file": ("personas.csv", csv_content.encode("utf-8"), "text/csv")},
    )

    names = sorted(item["name"] for item in client.get(f"/sessions/{session_id}/participants").json())
    assert names == ["Nueva Dos", "Nueva Uno"]


def test_judge_votes_require_the_token_issued_to_that_judge():
    client = organizer_client()
    session_id = client.post("/sessions", json={"name": "Jurados", "date": "2026-06-05"}).json()["id"]
    for index in range(1, 3):
        client.post(f"/sessions/{session_id}/participants", json={"name": f"Persona {index}", "ai_level": index})
    client.post(f"/sessions/{session_id}/use-cases", json={"title": "Caso A"})
    client.post(f"/sessions/{session_id}/teams/generate", json={"number_of_teams": 1})
    client.post(f"/sessions/{session_id}/use-cases/assign", json={"mode": "random"})
    evaluation = client.post(f"/sessions/{session_id}/evaluation/open").json()
    client.post(f"/sessions/{session_id}/evaluation/registration", json={"open": True})
    public = client.get(f"/judge/{evaluation['token']}").json()
    first = client.post(f"/judge/{evaluation['token']}/identify", json={"name": "Ana"}).json()
    second = client.post(f"/judge/{evaluation['token']}/identify", json={"name": "Beto"}).json()
    scores = [{"criterion_id": criterion["id"], "score": 5} for criterion in public["criteria"]]
    body = {"judge_id": first["judge"]["id"], "team_id": public["teams"][0]["id"], "scores": scores}

    assert client.post(f"/judge/{evaluation['token']}/scores", json=body).status_code == 403
    assert (
        client.post(
            f"/judge/{evaluation['token']}/scores",
            json=body,
            headers={"X-Judge-Token": second["vote_token"]},
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"/judge/{evaluation['token']}/scores",
            json=body,
            headers={"X-Judge-Token": first["vote_token"]},
        ).status_code
        == 200
    )


def test_client_visits_can_be_planned_by_month_edited_and_deleted():
    client = organizer_client()
    created = client.post(
        "/clients",
        json={"company_name": "Acme", "contact": "  Laura  ", "notes": "", "visit_date": "2026-11-18"},
    ).json()
    client.post("/clients", json={"company_name": "Globex", "visit_date": "2026-12-02"})

    november = client.get("/clients", params={"month": "2026-11"}).json()
    assert [item["company_name"] for item in november] == ["Acme"]
    assert created["contact"] == "Laura"
    assert created["notes"] is None

    edited = client.patch(f"/clients/{created['id']}", json={"notes": "Llevar demo"}).json()
    assert edited["notes"] == "Llevar demo"
    assert client.delete(f"/clients/{created['id']}").status_code == 200
    assert client.get("/clients", params={"month": "2026-11"}).json() == []
    assert client.get("/clients", params={"month": "bad"}).status_code == 400


def test_client_visit_type_times_and_weekday_rules():
    client = organizer_client()
    created = client.post("/clients", json={"company_name": "AI Friday", "visit_date": "2026-11-20"}).json()
    assert (created["is_internal"], created["tentative"]) == (False, False)
    assert (created["start_time"], created["end_time"]) == ("09:00", "18:00")

    edited = client.patch(
        f"/clients/{created['id']}",
        json={"is_internal": True, "tentative": True, "start_time": "10:00", "end_time": "12:00"},
    ).json()
    assert (edited["is_internal"], edited["tentative"], edited["start_time"], edited["end_time"]) == (True, True, "10:00", "12:00")

    # 2026-11-21 is a Saturday.
    assert client.post("/clients", json={"company_name": "X", "visit_date": "2026-11-21"}).status_code == 400
    assert client.patch(f"/clients/{created['id']}", json={"visit_date": "2026-11-22"}).status_code == 400
    assert client.post("/clients", json={"company_name": "X", "visit_date": "2026-11-20", "start_time": "12:00", "end_time": "11:00"}).status_code == 400
    assert client.patch(f"/clients/{created['id']}", json={"end_time": "09:30"}).status_code == 400
    assert client.post("/clients", json={"company_name": "X", "visit_date": "2026-11-20", "start_time": "25:00"}).status_code == 422


def test_organizer_access_is_revoked_when_the_row_is_deactivated():
    from app.database import SessionLocal
    from app.models import Organizer

    client = organizer_client()
    assert client.get("/sessions").status_code == 200

    with SessionLocal() as db:
        db.query(Organizer).filter(Organizer.email == ORGANIZER).update({"active": False})
        db.commit()

    assert client.get("/sessions").status_code == 401
