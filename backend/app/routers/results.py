import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Assignment, ResultSnapshot, SessionModel, Team, UseCase, utc_now
from app.routers.teams import serialize_teams
from app.schemas import AssignmentOut, AssignmentRequest, ResultsOut
from app.services.usecase_assigner import UseCaseInput, assign_use_cases

router = APIRouter(tags=["results"])


def serialize_assignments(db: Session, session_id: int) -> list[AssignmentOut]:
    teams = {team.id: team for team in db.query(Team).filter(Team.session_id == session_id).all()}
    use_cases = {item.id: item for item in db.query(UseCase).filter(UseCase.session_id == session_id).all()}
    assignments = db.query(Assignment).filter(Assignment.session_id == session_id).order_by(Assignment.id).all()
    output: list[AssignmentOut] = []
    for assignment in assignments:
        team = teams[assignment.team_id]
        use_case = use_cases[assignment.use_case_id]
        output.append(
            AssignmentOut(
                id=assignment.id,
                team_id=assignment.team_id,
                use_case_id=assignment.use_case_id,
                assigned_at=assignment.assigned_at,
                team_name=team.name,
                use_case_title=use_case.title,
                use_case_description=use_case.description,
            )
        )
    return output


@router.post("/sessions/{session_id}/use-cases/assign", response_model=list[AssignmentOut])
def assign_cases(
    session_id: int,
    payload: AssignmentRequest,
    db: Session = Depends(get_db),
) -> list[AssignmentOut]:
    session = db.get(SessionModel, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if payload.mode != "random":
        raise HTTPException(status_code=400, detail="Only random mode is supported")

    teams = db.query(Team).filter(Team.session_id == session_id).order_by(Team.id).all()
    if not teams:
        raise HTTPException(status_code=400, detail="Generate teams before assigning use cases")

    use_cases = db.query(UseCase).filter(UseCase.session_id == session_id).order_by(UseCase.id).all()
    try:
        assigned = assign_use_cases(
            [team.id for team in teams],
            [UseCaseInput(id=item.id, title=item.title) for item in use_cases],
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    db.query(Assignment).filter(Assignment.session_id == session_id).delete()
    for team_id, use_case in assigned.items():
        db.add(Assignment(session_id=session_id, team_id=team_id, use_case_id=use_case.id))

    session.status = "cases_assigned"
    session.updated_at = utc_now()
    db.commit()
    return serialize_assignments(db, session_id)


@router.get("/sessions/{session_id}/results", response_model=ResultsOut)
def get_results(session_id: int, db: Session = Depends(get_db)) -> ResultsOut:
    session = db.get(SessionModel, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    snapshot = db.query(ResultSnapshot).filter(ResultSnapshot.session_id == session_id).first()
    if snapshot:
        return ResultsOut.model_validate(json.loads(snapshot.payload_json))
    return build_current_results(db, session)


def build_current_results(db: Session, session: SessionModel) -> ResultsOut:
    teams = serialize_teams(db, session.id).teams
    return ResultsOut(session=session, teams=teams, assignments=serialize_assignments(db, session.id))


def store_result_snapshot(db: Session, session: SessionModel) -> ResultsOut:
    payload = build_current_results(db, session)
    existing = db.query(ResultSnapshot).filter(ResultSnapshot.session_id == session.id).first()
    payload_json = payload.model_dump_json()
    if existing:
        existing.payload_json = payload_json
        existing.created_at = utc_now()
    else:
        db.add(ResultSnapshot(session_id=session.id, payload_json=payload_json))
    return payload
