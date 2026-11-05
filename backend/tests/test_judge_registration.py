from fastapi.testclient import TestClient
from sqlalchemy import text

from app.auth import COOKIE_NAME, create_session_token
from app.database import Base, engine, init_db
from app.main import app


def setup_function():
    Base.metadata.drop_all(bind=engine)
    init_db()


def organizer_client() -> TestClient:
    client = TestClient(app)
    client.cookies.set(COOKIE_NAME, create_session_token("organizador@example.com"))
    return client


def prepared_evaluation(client: TestClient) -> tuple[int, dict]:
    session_id = client.post("/sessions", json={"name": "Registro", "date": "2026-06-05"}).json()["id"]
    for index in range(1, 3):
        client.post(f"/sessions/{session_id}/participants", json={"name": f"Persona {index}", "ai_level": index})
    client.post(f"/sessions/{session_id}/use-cases", json={"title": "Caso A"})
    client.post(f"/sessions/{session_id}/teams/generate", json={"number_of_teams": 1})
    client.post(f"/sessions/{session_id}/use-cases/assign", json={"mode": "random"})
    return session_id, client.post(f"/sessions/{session_id}/evaluation/prepare").json()


def test_a_name_already_registered_needs_confirmation():
    client = organizer_client()
    _, evaluation = prepared_evaluation(client)
    url = f"/judge/{evaluation['token']}/identify"
    first = client.post(url, json={"name": "Juan"}).json()

    repeated = client.post(url, json={"name": " juan "})
    confirmed = client.post(url, json={"name": "Juan", "confirm_existing": True})

    assert repeated.status_code == 409
    assert repeated.json()["detail"] == "Judge name already registered"
    assert confirmed.status_code == 200
    assert confirmed.json()["judge"]["id"] == first["judge"]["id"]
    # Taking over the name revokes the previous token, as before.
    assert confirmed.json()["vote_token"] != first["vote_token"]


def test_a_different_name_registers_without_confirmation():
    client = organizer_client()
    _, evaluation = prepared_evaluation(client)
    url = f"/judge/{evaluation['token']}/identify"
    client.post(url, json={"name": "Juan"})

    other = client.post(url, json={"name": "Juan Pérez"})

    assert other.status_code == 200


def test_opening_the_vote_keeps_judge_registration_open():
    client = organizer_client()
    session_id, evaluation = prepared_evaluation(client)
    url = f"/judge/{evaluation['token']}/identify"
    registered = client.post(url, json={"name": "Ana"}).json()

    opened = client.post(f"/sessions/{session_id}/evaluation/open").json()

    assert opened["registration_open"] is True
    assert client.post(url, json={"name": "Carla"}).status_code == 200

    # Stale databases may still hold a closed registration; opening the vote again repairs it.
    client.post(f"/sessions/{session_id}/evaluation/registration", json={"open": False})
    assert client.post(f"/sessions/{session_id}/evaluation/open").json()["registration_open"] is True

    client.post(f"/sessions/{session_id}/evaluation/registration", json={"open": False})
    late = client.post(url, json={"name": "Beto"})
    assert late.status_code == 403
    assert late.json()["detail"] == "Judge registration is closed"
    # A judge who registered before can still come back, for example from a new phone.
    returning = client.post(url, json={"name": "Ana", "confirm_existing": True})
    assert returning.status_code == 200
    assert returning.json()["judge"]["id"] == registered["judge"]["id"]


def test_the_organizer_can_reopen_registration_for_late_judges():
    client = organizer_client()
    session_id, evaluation = prepared_evaluation(client)
    client.post(f"/sessions/{session_id}/evaluation/open")
    client.post(f"/sessions/{session_id}/evaluation/registration", json={"open": False})

    reopened = client.post(f"/sessions/{session_id}/evaluation/registration", json={"open": True})

    assert reopened.status_code == 200
    assert reopened.json()["registration_open"] is True
    assert client.post(f"/judge/{evaluation['token']}/identify", json={"name": "Beto"}).status_code == 200


def test_default_criteria_are_stored_in_spanish():
    client = organizer_client()
    _, evaluation = prepared_evaluation(client)

    assert [criterion["name"] for criterion in evaluation["criteria"]] == [
        "Presentación y comunicación",
        "Usabilidad y diseño",
        "Innovación",
        "Impacto y relevancia",
        "Calidad técnica",
    ]


def test_startup_renames_criteria_saved_with_english_names():
    client = organizer_client()
    _, evaluation = prepared_evaluation(client)
    with engine.begin() as connection:
        connection.execute(text("UPDATE evaluation_criteria SET name = 'Technical Quiality' WHERE name = 'Calidad técnica'"))
        connection.execute(text("UPDATE evaluation_criteria SET name = 'Innovation' WHERE name = 'Innovación'"))

    init_db()

    names = [criterion["name"] for criterion in client.get(f"/sessions/{evaluation['session']['id']}/evaluation").json()["criteria"]]
    assert "Calidad técnica" in names
    assert "Innovación" in names


def test_names_that_differ_only_by_accents_are_the_same_judge():
    client = organizer_client()
    _, evaluation = prepared_evaluation(client)
    url = f"/judge/{evaluation['token']}/identify"
    first = client.post(url, json={"name": "José"}).json()

    repeated = client.post(url, json={"name": "Jose"})
    confirmed = client.post(url, json={"name": "JOSÉ", "confirm_existing": True})

    assert repeated.status_code == 409
    assert confirmed.json()["judge"]["id"] == first["judge"]["id"]


def test_names_in_other_alphabets_stay_distinct():
    client = organizer_client()
    _, evaluation = prepared_evaluation(client)
    url = f"/judge/{evaluation['token']}/identify"

    first = client.post(url, json={"name": "山田"})
    second = client.post(url, json={"name": "李明"})

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["judge"]["id"] != second.json()["judge"]["id"]


def test_judges_registered_before_accents_were_ignored_keep_their_address():
    client = organizer_client()
    session_id, evaluation = prepared_evaluation(client)
    url = f"/judge/{evaluation['token']}/identify"
    # Address as the previous version built it for "José": the accented letter was dropped, leaving "jos".
    legacy_email = f"judge-{session_id}-jos@internal.judge"
    legacy = client.post(url, json={"name": "José", "email": legacy_email}).json()

    again = client.post(url, json={"name": "José", "confirm_existing": True})

    assert again.status_code == 200
    assert again.json()["judge"]["id"] == legacy["judge"]["id"]
