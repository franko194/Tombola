from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Assignment, SessionModel, UseCase, utc_now
from app.schemas import UseCaseCreate, UseCaseOut, UseCaseUpdate

router = APIRouter(tags=["use-cases"])


def ensure_session(db: Session, session_id: int) -> None:
    if not db.get(SessionModel, session_id):
        raise HTTPException(status_code=404, detail="Session not found")


def reset_assignments(db: Session, session_id: int) -> None:
    db.query(Assignment).filter(Assignment.session_id == session_id).delete()
    session = db.get(SessionModel, session_id)
    if session and session.status in {"cases_assigned", "completed"}:
        session.status = "teams_generated"
        session.updated_at = utc_now()


@router.post("/sessions/{session_id}/use-cases", response_model=UseCaseOut)
def create_use_case(
    session_id: int,
    payload: UseCaseCreate,
    db: Session = Depends(get_db),
) -> UseCase:
    ensure_session(db, session_id)
    reset_assignments(db, session_id)
    use_case = UseCase(session_id=session_id, title=payload.title.strip(), description=payload.description)
    db.add(use_case)
    db.commit()
    db.refresh(use_case)
    return use_case


@router.get("/sessions/{session_id}/use-cases", response_model=list[UseCaseOut])
def list_use_cases(session_id: int, db: Session = Depends(get_db)) -> list[UseCase]:
    ensure_session(db, session_id)
    return list(db.query(UseCase).filter(UseCase.session_id == session_id).order_by(UseCase.id).all())


@router.patch("/use-cases/{use_case_id}", response_model=UseCaseOut)
def update_use_case(
    use_case_id: int,
    payload: UseCaseUpdate,
    db: Session = Depends(get_db),
) -> UseCase:
    use_case = db.get(UseCase, use_case_id)
    if not use_case:
        raise HTTPException(status_code=404, detail="Use case not found")
    reset_assignments(db, use_case.session_id)
    data = payload.model_dump(exclude_unset=True)
    if "title" in data and data["title"] is not None:
        use_case.title = data["title"].strip()
    if "description" in data:
        use_case.description = data["description"]
    use_case.updated_at = utc_now()
    db.commit()
    db.refresh(use_case)
    return use_case


@router.delete("/use-cases/{use_case_id}")
def delete_use_case(use_case_id: int, db: Session = Depends(get_db)) -> dict[str, bool]:
    use_case = db.get(UseCase, use_case_id)
    if not use_case:
        raise HTTPException(status_code=404, detail="Use case not found")
    reset_assignments(db, use_case.session_id)
    db.delete(use_case)
    db.commit()
    return {"ok": True}
