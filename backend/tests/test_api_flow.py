import os

os.environ["DATABASE_URL"] = "sqlite:///./data/test_ia_friday.db"

from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app
from app.schemas import TeamInsightsOut
from app.services import team_insights


client = TestClient(app)


def setup_function():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def test_full_api_flow():
    session = client.post("/sessions", json={"name": "IA Friday", "date": "2026-06-05"}).json()
    session_id = session["id"]

    for index, level in enumerate([5, 4, 3, 2, 1, 0], start=1):
        response = client.post(
            f"/sessions/{session_id}/participants",
            json={"name": f"Participante {index}", "ai_level": level},
        )
        assert response.status_code == 200

    for title in ["Caso A", "Caso B", "Caso C"]:
        response = client.post(f"/sessions/{session_id}/use-cases", json={"title": title})
        assert response.status_code == 200

    teams = client.post(f"/sessions/{session_id}/teams/generate", json={"number_of_teams": 3})
    assert teams.status_code == 200
    assert len(teams.json()["teams"]) == 3

    assignments = client.post(f"/sessions/{session_id}/use-cases/assign", json={"mode": "random"})
    assert assignments.status_code == 200
    assert len(assignments.json()) == 3

    results = client.get(f"/sessions/{session_id}/results")
    assert results.status_code == 200
    body = results.json()
    assert len(body["teams"]) == 3
    assert len(body["assignments"]) == 3


def test_delete_session_removes_it_from_history():
    created = client.post("/sessions", json={"name": "Sesion para borrar", "date": "2026-06-12"}).json()

    delete_response = client.delete(f"/sessions/{created['id']}")
    assert delete_response.status_code == 200
    assert delete_response.json() == {"ok": True}

    sessions = client.get("/sessions").json()
    assert all(session["id"] != created["id"] for session in sessions)


def test_archive_session_hides_it_from_default_history():
    created = client.post("/sessions", json={"name": "Sesion archivada", "date": "2026-06-19"}).json()

    response = client.post(f"/sessions/{created['id']}/archive")

    assert response.status_code == 200
    assert response.json()["status"] == "archived"
    sessions = client.get("/sessions").json()
    assert all(session["id"] != created["id"] for session in sessions)
    archived = client.get("/sessions?include_archived=true").json()
    assert any(session["id"] == created["id"] for session in archived)


def test_duplicate_session_copies_setup_without_results():
    created = client.post("/sessions", json={"name": "Sesion original", "date": "2026-06-19"}).json()
    for level in [5, 3]:
        client.post(f"/sessions/{created['id']}/participants", json={"name": f"P{level}", "ai_level": level})
    client.post(f"/sessions/{created['id']}/use-cases", json={"title": "Caso A"})

    response = client.post(
        f"/sessions/{created['id']}/duplicate",
        json={"name": "Sesion duplicada", "date": "2026-06-26"},
    )

    assert response.status_code == 200
    duplicated = response.json()
    assert duplicated["name"] == "Sesion duplicada"
    assert duplicated["status"] == "draft"
    assert len(client.get(f"/sessions/{duplicated['id']}/participants").json()) == 2
    assert len(client.get(f"/sessions/{duplicated['id']}/use-cases").json()) == 1
    assert len(client.get(f"/sessions/{duplicated['id']}/teams").json()["teams"]) == 0


def test_complete_session_stores_snapshot_that_survives_later_edits():
    session = client.post("/sessions", json={"name": "Snapshot session", "date": "2026-06-05"}).json()
    for index, level in enumerate([5, 4, 3, 2], start=1):
        client.post(f"/sessions/{session['id']}/participants", json={"name": f"Participante {index}", "ai_level": level})
    for title in ["Caso A", "Caso B"]:
        client.post(f"/sessions/{session['id']}/use-cases", json={"title": title})
    client.post(f"/sessions/{session['id']}/teams/generate", json={"number_of_teams": 2})
    client.post(f"/sessions/{session['id']}/use-cases/assign", json={"mode": "random"})

    completed = client.post(f"/sessions/{session['id']}/complete")
    assert completed.status_code == 200
    assert completed.json()["session"]["status"] == "completed"

    participant_id = client.get(f"/sessions/{session['id']}/participants").json()[0]["id"]
    client.patch(f"/participants/{participant_id}", json={"name": "Nombre cambiado"})

    results = client.get(f"/sessions/{session['id']}/results").json()
    snapshot_names = [member["name"] for team in results["teams"] for member in team["members"]]
    assert "Nombre cambiado" not in snapshot_names
    assert "Participante 1" in snapshot_names


def test_assign_use_cases_repeats_cases_when_there_are_more_teams_than_cases():
    session = client.post("/sessions", json={"name": "Casos repetidos", "date": "2026-06-26"}).json()
    for index, level in enumerate([5, 4, 3, 2, 1, 0, 3, 2], start=1):
        client.post(
            f"/sessions/{session['id']}/participants",
            json={"name": f"Participante {index}", "ai_level": level},
        )
    for title in ["Caso A", "Caso B", "Caso C"]:
        client.post(f"/sessions/{session['id']}/use-cases", json={"title": title})
    client.post(f"/sessions/{session['id']}/teams/generate", json={"number_of_teams": 4})

    response = client.post(f"/sessions/{session['id']}/use-cases/assign", json={"mode": "random"})

    assert response.status_code == 200
    assignments = response.json()
    use_case_ids = [assignment["use_case_id"] for assignment in assignments]
    assert len(assignments) == 4
    assert len(set(use_case_ids)) == 3


def test_manual_team_update_moves_members_and_clears_assignments():
    session = client.post("/sessions", json={"name": "Equipos editables", "date": "2026-06-26"}).json()
    for name, level in [("Ana", 5), ("Ben", 4), ("Cata", 1), ("Diego", 0)]:
        client.post(f"/sessions/{session['id']}/participants", json={"name": name, "ai_level": level})
    client.post(f"/sessions/{session['id']}/use-cases", json={"title": "Caso A"})
    client.post(f"/sessions/{session['id']}/use-cases", json={"title": "Caso B"})

    generated = client.post(f"/sessions/{session['id']}/teams/generate", json={"number_of_teams": 2}).json()
    client.post(f"/sessions/{session['id']}/use-cases/assign", json={"mode": "random"})
    assert len(client.get(f"/sessions/{session['id']}/results").json()["assignments"]) == 2

    first_team, second_team = generated["teams"]
    first_member = first_team["members"][0]
    second_member = second_team["members"][0]
    payload = {
        "teams": [
            {
                "team_id": first_team["id"],
                "participant_ids": [member["id"] for member in first_team["members"] if member["id"] != first_member["id"]] + [second_member["id"]],
            },
            {
                "team_id": second_team["id"],
                "participant_ids": [member["id"] for member in second_team["members"] if member["id"] != second_member["id"]] + [first_member["id"]],
            },
        ]
    }

    response = client.put(f"/sessions/{session['id']}/teams/manual", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert [member["id"] for member in body["teams"][0]["members"]] == payload["teams"][0]["participant_ids"]
    assert body["teams"][0]["total_ai_score"] == sum(member["ai_level"] for member in body["teams"][0]["members"])
    assert len(client.get(f"/sessions/{session['id']}/results").json()["assignments"]) == 0


def test_manual_team_update_rejects_missing_participant():
    session = client.post("/sessions", json={"name": "Equipos invalidos", "date": "2026-06-26"}).json()
    for name, level in [("Ana", 5), ("Ben", 4), ("Cata", 1)]:
        client.post(f"/sessions/{session['id']}/participants", json={"name": name, "ai_level": level})
    generated = client.post(f"/sessions/{session['id']}/teams/generate", json={"number_of_teams": 2}).json()

    response = client.put(
        f"/sessions/{session['id']}/teams/manual",
        json={
            "teams": [
                {"team_id": generated["teams"][0]["id"], "participant_ids": [generated["teams"][0]["members"][0]["id"]]},
                {"team_id": generated["teams"][1]["id"], "participant_ids": []},
            ]
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "All session participants must be assigned exactly once"


def test_regenerate_teams_replaces_existing_distribution_and_clears_assignments():
    session = client.post("/sessions", json={"name": "Regenerar equipos", "date": "2026-06-26"}).json()
    for index, level in enumerate([5, 4, 3, 2, 1, 0], start=1):
        client.post(f"/sessions/{session['id']}/participants", json={"name": f"P{index}", "ai_level": level})
    for title in ["Caso A", "Caso B", "Caso C"]:
        client.post(f"/sessions/{session['id']}/use-cases", json={"title": title})

    first = client.post(f"/sessions/{session['id']}/teams/generate", json={"number_of_teams": 2}).json()
    client.post(f"/sessions/{session['id']}/use-cases/assign", json={"mode": "random"})
    assert len(client.get(f"/sessions/{session['id']}/results").json()["assignments"]) == 2

    second = client.post(f"/sessions/{session['id']}/teams/generate", json={"number_of_teams": 3}).json()

    assert len(first["teams"]) == 2
    assert len(second["teams"]) == 3
    assert len(client.get(f"/sessions/{session['id']}/results").json()["assignments"]) == 0


def create_session_with_generated_teams() -> int:
    session = client.post("/sessions", json={"name": "Insights session", "date": "2026-06-26"}).json()
    for index, level in enumerate([5, 4, 3, 2, 1, 0], start=1):
        client.post(
            f"/sessions/{session['id']}/participants",
            json={"name": f"Participante {index}", "ai_level": level},
        )
    client.post(f"/sessions/{session['id']}/teams/generate", json={"number_of_teams": 3})
    return session["id"]


def test_team_insights_use_cloud_ai_first_when_configured(monkeypatch):
    session_id = create_session_with_generated_teams()
    calls = []

    def fake_cloud(teams_response, api_key, endpoint, model=None):
        calls.append((api_key, endpoint, model, len(teams_response.teams)))
        return TeamInsightsOut(
            summary="Explicacion generada por IA cloud.",
            strengths=["Fortaleza cloud"],
            recommendations=["Recomendacion cloud"],
            generated_by="cloud",
        )

    monkeypatch.setenv("CLOUD_AI_URL", "https://cloud.example.com/api")
    monkeypatch.setenv("CLOUD_AI_API_KEY", "test-key")
    monkeypatch.setattr(team_insights, "generate_cloud_team_insights", fake_cloud)

    response = client.post(f"/sessions/{session_id}/teams/insights")

    assert response.status_code == 200
    body = response.json()
    assert body["generated_by"] == "cloud"
    assert body["summary"] == "Explicacion generada por IA cloud."
    assert calls == [("test-key", "https://cloud.example.com/api", "minimax-m3:cloud", 3)]


def test_team_insights_accept_ollama_aliases(monkeypatch):
    session_id = create_session_with_generated_teams()
    calls = []

    def fake_cloud(teams_response, api_key, endpoint, model=None):
        calls.append((api_key, endpoint, model, len(teams_response.teams)))
        return TeamInsightsOut(
            summary="Explicacion generada por Ollama cloud.",
            strengths=["Fortaleza cloud"],
            recommendations=["Recomendacion cloud"],
            generated_by="cloud",
        )

    monkeypatch.delenv("CLOUD_AI_URL", raising=False)
    monkeypatch.delenv("CLOUD_AI_API_KEY", raising=False)
    monkeypatch.delenv("CLOUD_AI_MODEL", raising=False)
    monkeypatch.setenv("OLLAMA_API_KEY", "ollama-key")
    monkeypatch.setenv("OLLAMA_MODEL", "minimax-m3:cloud")
    monkeypatch.setattr(team_insights, "generate_cloud_team_insights", fake_cloud)

    response = client.post(f"/sessions/{session_id}/teams/insights")

    assert response.status_code == 200
    body = response.json()
    assert body["generated_by"] == "cloud"
    assert calls == [("ollama-key", "https://ollama.com/v1/chat/completions", "minimax-m3:cloud", 3)]


def test_team_insights_fall_back_to_local_when_cloud_fails(monkeypatch):
    session_id = create_session_with_generated_teams()

    def failing_cloud(*_args, **_kwargs):
        raise RuntimeError("cloud unavailable")

    monkeypatch.setenv("CLOUD_AI_URL", "https://cloud.example.com/api")
    monkeypatch.setenv("CLOUD_AI_API_KEY", "test-key")
    monkeypatch.setattr(team_insights, "generate_cloud_team_insights", failing_cloud)

    response = client.post(f"/sessions/{session_id}/teams/insights")

    assert response.status_code == 200
    body = response.json()
    assert body["generated_by"] == "local"
    assert body["summary"]
    assert len(body["strengths"]) >= 1
    assert len(body["recommendations"]) >= 1


def test_team_insights_use_local_fallback_without_cloud_config(monkeypatch):
    session_id = create_session_with_generated_teams()
    monkeypatch.delenv("CLOUD_AI_URL", raising=False)
    monkeypatch.delenv("CLOUD_AI_API_KEY", raising=False)

    response = client.post(f"/sessions/{session_id}/teams/insights")

    assert response.status_code == 200
    body = response.json()
    assert body["generated_by"] == "local"
    assert body["summary"]


def test_evaluation_flow_registers_judge_scores_and_ranking():
    session = client.post("/sessions", json={"name": "Evaluacion jurado", "date": "2026-06-26"}).json()
    for index, level in enumerate([5, 4, 3, 2, 1, 0], start=1):
        client.post(
            f"/sessions/{session['id']}/participants",
            json={"name": f"Participante {index}", "ai_level": level},
        )
    for title in ["Caso A", "Caso B", "Caso C"]:
        client.post(f"/sessions/{session['id']}/use-cases", json={"title": title})
    client.post(f"/sessions/{session['id']}/teams/generate", json={"number_of_teams": 3})
    client.post(f"/sessions/{session['id']}/use-cases/assign", json={"mode": "random"})

    opened = client.post(f"/sessions/{session['id']}/evaluation/open")

    assert opened.status_code == 200
    evaluation = opened.json()
    assert evaluation["status"] == "open"
    assert len(evaluation["criteria"]) == 5
    assert [criterion["name"] for criterion in evaluation["criteria"]] == [
        "Presentation & Communication",
        "Usability & Desing",
        "Innovation",
        "Impact and Relevance",
        "Technical Quiality",
    ]

    public = client.get(f"/judge/{evaluation['token']}").json()
    judge = client.post(
        f"/judge/{evaluation['token']}/identify",
        json={"name": "Jurado Uno", "email": "jurado@example.com", "organization": "IA Friday"},
    ).json()
    team_id = public["teams"][0]["id"]
    scores = [{"criterion_id": criterion["id"], "score": 5} for criterion in public["criteria"]]

    submitted = client.post(
        f"/judge/{evaluation['token']}/scores",
        json={"judge_id": judge["id"], "team_id": team_id, "scores": scores, "comment": "Muy buen pitch"},
    )

    assert submitted.status_code == 200
    ranking = client.get(f"/sessions/{session['id']}/evaluation/ranking").json()
    assert ranking[0]["team_id"] == team_id
    assert ranking[0]["average_score"] == 5
    assert ranking[0]["votes_count"] == 1


def test_judge_can_register_before_evaluation_opens():
    session = client.post("/sessions", json={"name": "Registro previo", "date": "2026-06-26"}).json()

    prepared = client.post(f"/sessions/{session['id']}/evaluation/prepare")

    assert prepared.status_code == 200
    evaluation = prepared.json()
    assert evaluation["status"] == "prepared"

    judge = client.post(
        f"/judge/{evaluation['token']}/identify",
        json={"name": "Jurado Previo", "email": "previo@example.com"},
    )

    assert judge.status_code == 200
    refreshed = client.get(f"/sessions/{session['id']}/evaluation").json()
    assert len(refreshed["judges"]) == 1
    assert refreshed["judges"][0]["judge"]["email"] == "previo@example.com"


def test_prepare_evaluation_is_idempotent():
    session = client.post("/sessions", json={"name": "QR idempotente", "date": "2026-06-27"}).json()

    first = client.post(f"/sessions/{session['id']}/evaluation/prepare")
    second = client.post(f"/sessions/{session['id']}/evaluation/prepare")

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["token"] == second.json()["token"]


def test_judge_can_register_with_name_only():
    session = client.post("/sessions", json={"name": "Evaluacion sin correo", "date": "2026-06-27"}).json()
    evaluation = client.post(f"/sessions/{session['id']}/evaluation/prepare").json()

    judge = client.post(
        f"/judge/{evaluation['token']}/identify",
        json={"name": "Jurado Sin Correo"},
    )

    assert judge.status_code == 200
    payload = judge.json()
    assert payload["name"] == "Jurado Sin Correo"
    assert payload["email"].endswith("@internal.judge")

    refreshed = client.get(f"/sessions/{session['id']}/evaluation").json()
    assert len(refreshed["judges"]) == 1
    assert refreshed["judges"][0]["judge"]["name"] == "Jurado Sin Correo"
