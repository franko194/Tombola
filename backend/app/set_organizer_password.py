"""Crea un organizador o cambia su contrasena en la base configurada en DATABASE_URL.

Uso (desde backend/, con DATABASE_URL apuntando a Neon si es produccion):
    python -m app.set_organizer_password correo@gmail.com
    python -m app.set_organizer_password correo@gmail.com --admin   # primer administrador
"""

import getpass
import sys

from app.auth import hash_password
from app.database import SessionLocal, init_db
from app.models import Organizer, utc_now

MIN_PASSWORD_LENGTH = 8


def main() -> None:
    args = sys.argv[1:]
    make_admin = "--admin" in args
    emails = [arg for arg in args if arg != "--admin"]
    if len(emails) != 1:
        raise SystemExit("Uso: python -m app.set_organizer_password correo@gmail.com [--admin]")

    email = emails[0].strip().lower()
    password = getpass.getpass("Nueva contrasena: ")
    if len(password) < MIN_PASSWORD_LENGTH:
        raise SystemExit(f"La contrasena debe tener al menos {MIN_PASSWORD_LENGTH} caracteres.")
    if getpass.getpass("Repite la contrasena: ") != password:
        raise SystemExit("Las contrasenas no coinciden.")

    init_db()
    with SessionLocal() as db:
        organizer = db.query(Organizer).filter(Organizer.email == email).first()
        if organizer is None:
            organizer = Organizer(email=email, active=True, created_at=utc_now())
            db.add(organizer)
        organizer.password_hash = hash_password(password)
        organizer.active = True
        if make_admin:
            organizer.is_admin = True
        db.commit()
        role = "administrador" if organizer.is_admin else "organizador"
    print(f"Listo: {email} puede iniciar sesion como {role}.")


if __name__ == "__main__":
    main()
