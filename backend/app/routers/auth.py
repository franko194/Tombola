from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import (
    COOKIE_NAME,
    LOCKOUT_MINUTES,
    SESSION_HOURS,
    authenticate_organizer,
    clear_login_failures,
    create_session_token,
    login_is_locked,
    record_login_failure,
    require_organizer,
)
from app.database import get_db
from app.models import Organizer

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)) -> dict[str, str]:
    # Capped so a huge value cannot be stored in login_failures.
    email = payload.email.strip().lower()[:254]
    if login_is_locked(db, email):
        raise HTTPException(
            status_code=429,
            detail=f"Demasiados intentos fallidos. Espera {LOCKOUT_MINUTES} minutos e inténtalo de nuevo.",
            headers={"Retry-After": str(LOCKOUT_MINUTES * 60)},
        )
    organizer = authenticate_organizer(db, payload.email, payload.password)
    if organizer is None:
        record_login_failure(db, email)
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")
    clear_login_failures(db, email)
    response.set_cookie(
        COOKIE_NAME,
        create_session_token(organizer.email),
        max_age=SESSION_HOURS * 3600,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )
    return {"email": organizer.email}


@router.get("/me")
def current_organizer(email: str = Depends(require_organizer), db: Session = Depends(get_db)) -> dict[str, object]:
    organizer = db.query(Organizer).filter(Organizer.email == email).first()
    return {"email": email, "is_admin": bool(organizer and organizer.is_admin)}


@router.post("/logout")
def logout(response: Response) -> dict[str, bool]:
    response.delete_cookie(COOKIE_NAME, path="/", secure=True, httponly=True, samesite="lax")
    return {"ok": True}
