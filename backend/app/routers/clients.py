from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ClientVisit, utc_now
from app.schemas import ClientVisitCreate, ClientVisitOut, ClientVisitUpdate

router = APIRouter(prefix="/clients", tags=["clients"])


def clean_text(value: str | None) -> str | None:
    cleaned = (value or "").strip()
    return cleaned or None


def month_bounds(month: str) -> tuple[date, date]:
    try:
        first = date.fromisoformat(f"{month}-01")
    except ValueError:
        raise HTTPException(status_code=400, detail="month must look like YYYY-MM")
    next_first = date(first.year + 1, 1, 1) if first.month == 12 else date(first.year, first.month + 1, 1)
    return first, next_first


def ensure_weekday(value: date) -> None:
    # The calendar only plans Monday to Friday.
    if value.weekday() >= 5:
        raise HTTPException(status_code=400, detail="Events cannot be planned on weekends")


def ensure_time_range(start_time: str, end_time: str) -> None:
    if end_time <= start_time:
        raise HTTPException(status_code=400, detail="End time must be after start time")


def get_visit(db: Session, visit_id: int) -> ClientVisit:
    visit = db.get(ClientVisit, visit_id)
    if not visit:
        raise HTTPException(status_code=404, detail="Client visit not found")
    return visit


@router.get("", response_model=list[ClientVisitOut])
def list_client_visits(month: str | None = None, db: Session = Depends(get_db)) -> list[ClientVisit]:
    query = db.query(ClientVisit)
    if month:
        first, next_first = month_bounds(month)
        query = query.filter(ClientVisit.visit_date >= first, ClientVisit.visit_date < next_first)
    return query.order_by(ClientVisit.visit_date, ClientVisit.id).all()


@router.post("", response_model=ClientVisitOut)
def create_client_visit(payload: ClientVisitCreate, db: Session = Depends(get_db)) -> ClientVisit:
    ensure_weekday(payload.visit_date)
    ensure_time_range(payload.start_time, payload.end_time)
    visit = ClientVisit(
        company_name=payload.company_name.strip(),
        contact=clean_text(payload.contact),
        notes=clean_text(payload.notes),
        visit_date=payload.visit_date,
        is_internal=payload.is_internal,
        tentative=payload.tentative,
        start_time=payload.start_time,
        end_time=payload.end_time,
        created_at=utc_now(),
        updated_at=utc_now(),
    )
    db.add(visit)
    db.commit()
    db.refresh(visit)
    return visit


@router.patch("/{visit_id}", response_model=ClientVisitOut)
def update_client_visit(visit_id: int, payload: ClientVisitUpdate, db: Session = Depends(get_db)) -> ClientVisit:
    visit = get_visit(db, visit_id)
    data = payload.model_dump(exclude_unset=True)
    if "company_name" in data and data["company_name"] is not None:
        visit.company_name = data["company_name"].strip()
    if "contact" in data:
        visit.contact = clean_text(data["contact"])
    if "notes" in data:
        visit.notes = clean_text(data["notes"])
    if "visit_date" in data and data["visit_date"] is not None:
        ensure_weekday(data["visit_date"])
        visit.visit_date = data["visit_date"]
    for flag in ("is_internal", "tentative"):
        if data.get(flag) is not None:
            setattr(visit, flag, data[flag])
    for field in ("start_time", "end_time"):
        if data.get(field) is not None:
            setattr(visit, field, data[field])
    ensure_time_range(visit.start_time, visit.end_time)
    visit.updated_at = utc_now()
    db.commit()
    db.refresh(visit)
    return visit


@router.delete("/{visit_id}")
def delete_client_visit(visit_id: int, db: Session = Depends(get_db)) -> dict[str, bool]:
    visit = get_visit(db, visit_id)
    db.delete(visit)
    db.commit()
    return {"ok": True}
