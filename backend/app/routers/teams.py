from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Assignment, Participant, SessionModel, Team, TeamMember, utc_now
from app.schemas import BalanceOut, TeamGenerateRequest, TeamMemberOut, TeamOut, TeamsResponse
from app.services.team_balancer import ParticipantInput, generate_snake_draft_teams

router = APIRouter(tags=["teams"])


def serialize_teams(db: Session, session_id: int) -> TeamsResponse:
    participants = {item.id: item for item in db.query(Participant).filter(Participant.session_id == session_id).all()}
    teams = db.query(Team).filter(Team.session_id == session_id).order_by(Team.id).all()
    response_teams: list[TeamOut] = []

    for team in teams:
        members: list[TeamMemberOut] = []
        for member in team.members:
            participant = participants.get(member.participant_id)
            if participant:
                members.append(TeamMemberOut(id=participant.id, name=participant.name, ai_level=participant.ai_level))
        response_teams.append(
            TeamOut(
                id=team.id,
                name=team.name,
                average_ai_level=team.average_ai_level,
                total_ai_score=team.total_ai_score,
                members=members,
            )
        )

    averages = [team.average_ai_level for team in response_teams] or [0]
    return TeamsResponse(
        teams=response_teams,
        balance=BalanceOut(
            highest_average=max(averages),
            lowest_average=min(averages),
            average_gap=round(max(averages) - min(averages), 2),
        ),
    )


@router.post("/sessions/{session_id}/teams/generate", response_model=TeamsResponse)
def generate_teams(
    session_id: int,
    payload: TeamGenerateRequest,
    db: Session = Depends(get_db),
) -> TeamsResponse:
    session = db.get(SessionModel, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    db.query(Assignment).filter(Assignment.session_id == session_id).delete()
    db.query(TeamMember).filter(TeamMember.team_id.in_(db.query(Team.id).filter(Team.session_id == session_id))).delete()
    db.query(Team).filter(Team.session_id == session_id).delete()

    participants = db.query(Participant).filter(Participant.session_id == session_id).order_by(Participant.id).all()
    try:
        balanced = generate_snake_draft_teams(
            [ParticipantInput(id=item.id, name=item.name, ai_level=item.ai_level) for item in participants],
            payload.number_of_teams,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    for balanced_team in balanced:
        team = Team(
            session_id=session_id,
            name=balanced_team.name,
            average_ai_level=balanced_team.average_score,
            total_ai_score=balanced_team.total_score,
        )
        db.add(team)
        db.flush()
        for member in balanced_team.members:
            db.add(TeamMember(team_id=team.id, participant_id=member.id))

    session.status = "teams_generated"
    session.updated_at = utc_now()
    db.commit()
    return serialize_teams(db, session_id)


@router.get("/sessions/{session_id}/teams", response_model=TeamsResponse)
def list_teams(session_id: int, db: Session = Depends(get_db)) -> TeamsResponse:
    if not db.get(SessionModel, session_id):
        raise HTTPException(status_code=404, detail="Session not found")
    return serialize_teams(db, session_id)
