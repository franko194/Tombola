from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import hash_password, require_admin
from app.database import get_db
from app.models import Organizer, utc_now

# Only administrators manage organizers. Every organizer can be made admin by another admin.
router = APIRouter(prefix="/organizers", tags=["organizers"], dependencies=[Depends(require_admin)])

MIN_PASSWORD_LENGTH = 8


class OrganizerOut(BaseModel):
    id: int
    email: str
    active: bool
    is_admin: bool
    has_password: bool


class OrganizerCreate(BaseModel):
    email: str
    password: str = Field(min_length=MIN_PASSWORD_LENGTH)
    is_admin: bool = False


class OrganizerUpdate(BaseModel):
    active: bool | None = None
    is_admin: bool | None = None
    password: str | None = Field(default=None, min_length=MIN_PASSWORD_LENGTH)


def to_out(organizer: Organizer) -> OrganizerOut:
    return OrganizerOut(
        id=organizer.id,
        email=organizer.email,
        active=organizer.active,
        is_admin=organizer.is_admin,
        has_password=bool(organizer.password_hash),
    )


@router.get("", response_model=list[OrganizerOut])
def list_organizers(db: Session = Depends(get_db)) -> list[OrganizerOut]:
    return [to_out(item) for item in db.query(Organizer).order_by(Organizer.email).all()]


@router.post("", response_model=OrganizerOut, status_code=201)
def create_organizer(payload: OrganizerCreate, db: Session = Depends(get_db)) -> OrganizerOut:
    email = payload.email.strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=400, detail="El correo no es válido")
    if db.query(Organizer).filter(Organizer.email == email).first():
        raise HTTPException(status_code=409, detail="Ese correo ya es organizador")
    organizer = Organizer(
        email=email,
        password_hash=hash_password(payload.password),
        is_admin=payload.is_admin,
        active=True,
        created_at=utc_now(),
    )
    db.add(organizer)
    db.commit()
    db.refresh(organizer)
    return to_out(organizer)


@router.patch("/{organizer_id}", response_model=OrganizerOut)
def update_organizer(
    organizer_id: int,
    payload: OrganizerUpdate,
    current_email: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> OrganizerOut:
    organizer = db.get(Organizer, organizer_id)
    if organizer is None:
        raise HTTPException(status_code=404, detail="Organizador no encontrado")

    # Admins can change anyone else, but never lock themselves out or drop their own admin role.
    is_self = organizer.email == current_email
    if is_self and (payload.active is False or payload.is_admin is False):
        raise HTTPException(status_code=409, detail="No puedes desactivarte ni quitarte el rol de admin a ti mismo")

    if payload.active is not None:
        organizer.active = payload.active
    if payload.is_admin is not None:
        organizer.is_admin = payload.is_admin
    if payload.password is not None:
        organizer.password_hash = hash_password(payload.password)

    db.commit()
    db.refresh(organizer)
    return to_out(organizer)
