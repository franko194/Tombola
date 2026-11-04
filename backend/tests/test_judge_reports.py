from fastapi.testclient import TestClient

from app.auth import COOKIE_NAME, create_session_token
from app.database import Base, SessionLocal, engine, init_db
from app.main import app
from app.models import SessionModel
from app.services.evaluation_reports import _collect_report_context


def setup_function():
    Base.metadata.drop_all(bind=engine)
    init_db()


def organizer_client() -> TestClient:
    client = TestClient(app)
    client.cookies.set(COOKIE_NAME, create_session_token("organizador@example.com"))
    return client


def test_a_judge_comment_appears_once_per_team_in_the_report_context():
    client = organizer_client()
    session_id = client.post("/sessions", json={"name": "Reporte", "date": "2026-06-05"}).json()["id"]
    for index in range(1, 3):
        client.post(f"/sessions/{session_id}/participants", json={"name": f"Persona {index}", "ai_level": index})
    client.post(f"/sessions/{session_id}/use-cases", json={"title": "Caso A"})
    client.post(f"/sessions/{session_id}/teams/generate", json={"number_of_teams": 1})
    client.post(f"/sessions/{session_id}/use-cases/assign", json={"mode": "random"})
    evaluation = client.post(f"/sessions/{session_id}/evaluation/open").json()
    public = client.get(f"/judge/{evaluation['token']}").json()
    judge = client.post(f"/judge/{evaluation['token']}/identify", json={"name": "Ana"}).json()
    team_id = public["teams"][0]["id"]

    submitted = client.post(
        f"/judge/{evaluation['token']}/scores",
        json={
            "judge_id": judge["judge"]["id"],
            "team_id": team_id,
            "comment": "Muy buen trabajo",
            "scores": [{"criterion_id": criterion["id"], "score": 4} for criterion in public["criteria"]],
        },
        headers={"X-Judge-Token": judge["vote_token"]},
    )
    assert submitted.status_code == 200

    with SessionLocal() as db:
        context = _collect_report_context(db, db.get(SessionModel, session_id))

    assert len(public["criteria"]) > 1
    assert context["comments_by_team"][team_id] == ["Muy buen trabajo"]
