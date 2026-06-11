from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import SessionModel
from app.routers.teams import serialize_teams
from app.schemas import TeamInsightsOut
from app.services.team_insights import generate_team_insights

router = APIRouter(tags=["ai"])


@router.post("/sessions/{session_id}/teams/insights", response_model=TeamInsightsOut)
def create_team_insights(session_id: int, db: Session = Depends(get_db)) -> TeamInsightsOut:
    if not db.get(SessionModel, session_id):
        raise HTTPException(status_code=404, detail="Session not found")

    teams_response = serialize_teams(db, session_id)
    if not teams_response.teams:
        raise HTTPException(status_code=400, detail="Generate teams before requesting insights")

    return generate_team_insights(teams_response)
