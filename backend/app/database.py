from collections.abc import Generator
import os
from pathlib import Path
import tempfile

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

IS_VERCEL = bool(os.environ.get("VERCEL"))
DATA_DIR = Path(__file__).resolve().parents[1] / "data"

if not IS_VERCEL:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

default_sqlite_path = Path(tempfile.gettempdir()) / "ia_friday.db" if IS_VERCEL else DATA_DIR / "ia_friday.db"
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{default_sqlite_path}")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine_options = {"connect_args": connect_args, "pool_pre_ping": True}

engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
_db_initialized = False


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    ensure_db_initialized()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    global _db_initialized
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    migrate_assignments_allow_repeated_use_cases()
    _db_initialized = True


def ensure_db_initialized() -> None:
    if not _db_initialized:
        init_db()


def check_database() -> dict[str, str]:
    ensure_db_initialized()
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ok", "dialect": engine.dialect.name}


def migrate_assignments_allow_repeated_use_cases() -> None:
    if engine.dialect.name != "sqlite":
        return

    with engine.begin() as connection:
        table_exists = connection.exec_driver_sql(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='assignments'"
        ).first()
        if not table_exists:
            return

        unique_use_case_index = None
        for index in connection.exec_driver_sql("PRAGMA index_list(assignments)").mappings():
            if not index["unique"]:
                continue
            columns = [
                row["name"]
                for row in connection.exec_driver_sql(f"PRAGMA index_info({index['name']})").mappings()
            ]
            if columns == ["session_id", "use_case_id"]:
                unique_use_case_index = index["name"]
                break

        if not unique_use_case_index:
            return

        connection.exec_driver_sql("ALTER TABLE assignments RENAME TO assignments_old")
        Base.metadata.tables["assignments"].create(bind=connection)
        connection.exec_driver_sql(
            """
            INSERT INTO assignments (id, session_id, team_id, use_case_id, assigned_at)
            SELECT id, session_id, team_id, use_case_id, assigned_at
            FROM assignments_old
            """
        )
        connection.exec_driver_sql("DROP TABLE assignments_old")
