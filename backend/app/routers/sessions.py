from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Participant, SessionModel, UseCase, utc_now
from app.schemas import ResultsOut, SessionCreate, SessionDuplicate, SessionOut, SessionUpdate

router = APIRouter(prefix="/sessions", tags=["sessions"])

VALID_STATUSES = {"draft", "teams_generated", "cases_assigned", "completed", "archived"}


@router.post("", response_model=SessionOut)
def create_session(payload: SessionCreate, db: Session = Depends(get_db)) -> SessionModel:
    session = SessionModel(name=payload.name.strip(), date=payload.date, status="draft")
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("", response_model=list[SessionOut])
def list_sessions(include_archived: bool = False, db: Session = Depends(get_db)) -> list[SessionModel]:
    query = db.query(SessionModel)
    if not include_archived:
        query = query.filter(SessionModel.status != "archived")
    return list(query.order_by(desc(SessionModel.date), desc(SessionModel.id)).all())


@router.get("/{session_id}", response_model=SessionOut)
def get_session(session_id: int, db: Session = Depends(get_db)) -> SessionModel:
    session = db.get(SessionModel, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.patch("/{session_id}", response_model=SessionOut)
def update_session(
    session_id: int,
    payload: SessionUpdate,
    db: Session = Depends(get_db),
) -> SessionModel:
    session = db.get(SessionModel, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if payload.status is not None and payload.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid session status")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(session, field, value)
    session.updated_at = utc_now()
    db.commit()
    db.refresh(session)
    return session


@router.post("/{session_id}/reopen", response_model=SessionOut)
def reopen_session(session_id: int, db: Session = Depends(get_db)) -> SessionModel:
    session = db.get(SessionModel, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.status = "cases_assigned"
    session.updated_at = datetime.now(timezone.utc).isoformat()
    db.commit()
    db.refresh(session)
    return session


@router.post("/{session_id}/archive", response_model=SessionOut)
def archive_session(session_id: int, db: Session = Depends(get_db)) -> SessionModel:
    session = db.get(SessionModel, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.status = "archived"
    session.updated_at = utc_now()
    db.commit()
    db.refresh(session)
    return session


@router.post("/{session_id}/duplicate", response_model=SessionOut)
def duplicate_session(
    session_id: int,
    payload: SessionDuplicate,
    db: Session = Depends(get_db),
) -> SessionModel:
    source = db.get(SessionModel, session_id)
    if not source:
        raise HTTPException(status_code=404, detail="Session not found")

    duplicated = SessionModel(name=payload.name.strip(), date=payload.date, status="draft")
    db.add(duplicated)
    db.flush()

    participants = db.query(Participant).filter(Participant.session_id == session_id).order_by(Participant.id).all()
    for participant in participants:
        db.add(Participant(session_id=duplicated.id, name=participant.name, ai_level=participant.ai_level))

    use_cases = db.query(UseCase).filter(UseCase.session_id == session_id).order_by(UseCase.id).all()
    for use_case in use_cases:
        db.add(UseCase(session_id=duplicated.id, title=use_case.title, description=use_case.description))

    db.commit()
    db.refresh(duplicated)
    return duplicated


@router.post("/{session_id}/complete", response_model=ResultsOut)
def complete_session(session_id: int, db: Session = Depends(get_db)) -> ResultsOut:
    from app.routers.results import store_result_snapshot

    session = db.get(SessionModel, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.status = "completed"
    session.updated_at = utc_now()
    snapshot = store_result_snapshot(db, session)
    db.commit()
    db.refresh(session)
    snapshot.session = session
    return snapshot


@router.delete("/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db)) -> dict[str, bool]:
    session = db.get(SessionModel, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()
    return {"ok": True}
