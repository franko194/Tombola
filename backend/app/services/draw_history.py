import json

from sqlalchemy.orm import Session

from app.models import Assignment, DrawHistory, Participant, SessionModel, Team, TeamMember, UseCase, utc_now
from app.schemas import DrawHistoryOut


def archive_draw(db: Session, session_id: int, reason: str) -> None:
    """Copy the current teams and case draw into draw_history before they are replaced or deleted.

    Call this before any change to the draw. The copy is added to the session but not committed;
    the caller's commit stores it together with the change.
    """
    teams = db.query(Team).filter(Team.session_id == session_id).order_by(Team.id).all()
    assignments = db.query(Assignment).filter(Assignment.session_id == session_id).order_by(Assignment.id).all()
    if not teams and not assignments:
        return

    # Read plain columns instead of ORM objects: the caller may bulk-delete these rows right after.
    participants = {row.id: row.name for row in db.query(Participant.id, Participant.name).filter(Participant.session_id == session_id)}
    members_by_team: dict[int, list[str]] = {}
    for team_id, participant_id in db.query(TeamMember.team_id, TeamMember.participant_id).filter(
        TeamMember.team_id.in_([team.id for team in teams])
    ):
        if participant_id in participants:
            members_by_team.setdefault(team_id, []).append(participants[participant_id])
    team_names = {team.id: team.name for team in teams}
    use_case_titles = {row.id: row.title for row in db.query(UseCase.id, UseCase.title).filter(UseCase.session_id == session_id)}
    session = db.get(SessionModel, session_id)

    payload = {
        "teams": [
            {
                "name": team.name,
                "average_ai_level": team.average_ai_level,
                "total_ai_score": team.total_ai_score,
                "members": members_by_team.get(team.id, []),
            }
            for team in teams
        ],
        "assignments": [
            {
                "team_name": team_names.get(assignment.team_id, ""),
                "use_case_title": use_case_titles.get(assignment.use_case_id, ""),
            }
            for assignment in assignments
        ],
    }
    db.add(
        DrawHistory(
            session_id=session_id,
            session_name=session.name if session else "",
            reason=reason,
            payload_json=json.dumps(payload, ensure_ascii=False),
            created_at=utc_now(),
        )
    )


def to_draw_history_out(row: DrawHistory) -> DrawHistoryOut:
    return DrawHistoryOut(
        id=row.id,
        session_id=row.session_id,
        session_name=row.session_name,
        reason=row.reason,
        note=row.note,
        created_at=row.created_at,
        **json.loads(row.payload_json),
    )


def list_draw_history(db: Session, session_id: int) -> list[DrawHistoryOut]:
    rows = db.query(DrawHistory).filter(DrawHistory.session_id == session_id).order_by(DrawHistory.id.desc()).all()
    return [to_draw_history_out(row) for row in rows]


def get_draw_history_entry(db: Session, session_id: int, entry_id: int) -> DrawHistory | None:
    return db.query(DrawHistory).filter(DrawHistory.id == entry_id, DrawHistory.session_id == session_id).first()
