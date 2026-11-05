from sqlalchemy import inspect, text

from app.database import Base, engine, init_db


def columns_of(table: str) -> set[str]:
    return {column["name"] for column in inspect(engine).get_columns(table)}


def test_columns_added_in_later_versions_are_created_on_existing_tables():
    Base.metadata.drop_all(bind=engine)
    # Tables as an older version of the app created them, without password_hash, is_admin and note.
    with engine.begin() as connection:
        connection.execute(
            text("CREATE TABLE organizers (id INTEGER PRIMARY KEY, email VARCHAR NOT NULL UNIQUE, active BOOLEAN NOT NULL, created_at VARCHAR NOT NULL)")
        )
        connection.execute(
            text(
                "CREATE TABLE draw_history (id INTEGER PRIMARY KEY, session_id INTEGER NOT NULL, session_name VARCHAR NOT NULL, "
                "reason VARCHAR NOT NULL, payload_json VARCHAR NOT NULL, created_at VARCHAR NOT NULL)"
            )
        )

    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE client_visits (id INTEGER PRIMARY KEY, company_name VARCHAR NOT NULL, contact VARCHAR, notes VARCHAR, "
                "visit_date DATE NOT NULL, created_at VARCHAR NOT NULL, updated_at VARCHAR NOT NULL)"
            )
        )
        connection.execute(
            text("INSERT INTO client_visits (company_name, visit_date, created_at, updated_at) VALUES ('Acme', '2026-11-18', 'x', 'x')")
        )

    init_db()

    assert {"is_internal", "tentative", "start_time", "end_time"} <= columns_of("client_visits")
    with engine.begin() as connection:
        row = connection.execute(text("SELECT is_internal, tentative, start_time, end_time FROM client_visits")).one()
    assert tuple(row) == (0, 0, "09:00", "18:00")
    assert {"password_hash", "is_admin"} <= columns_of("organizers")
    assert "note" in columns_of("draw_history")

    # Running it again on an up to date database must change nothing.
    init_db()
    assert "note" in columns_of("draw_history")
