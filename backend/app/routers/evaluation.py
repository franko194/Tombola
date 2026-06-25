import os
import secrets
import re

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Assignment,
    EvaluationCriterion,
    Judge,
    SessionEvaluation,
    SessionJudge,
    SessionModel,
    Team,
    TeamScore,
    UseCase,
    utc_now,
)
from app.routers.results import serialize_assignments
from app.routers.teams import serialize_teams
from app.schemas import (
    EvaluationCriterionOut,
    EvaluationOut,
    EvaluationReportOut,
    JudgeIdentifyRequest,
    JudgeOut,
    JudgeScoreOut,
    PublicEvaluationOut,
    SessionJudgeOut,
    TeamRankingOut,
    TeamScoreSubmit,
)

router = APIRouter(tags=["evaluation"])
DEFAULT_PUBLIC_APP_URL = "https://tombola-rust.vercel.app"

DEFAULT_CRITERIA = [
    ("Presentation & Communication", 1.0),
    ("Usability & Desing", 1.0),
    ("Innovation", 1.0),
    ("Impact and Relevance", 1.0),
    ("Technical Quiality", 1.0),
]


def public_base_url(request: Request | None = None) -> str:
    configured_url = os.environ.get("PUBLIC_APP_URL")
    if configured_url:
        return configured_url.rstrip("/")
    if request:
        forwarded_proto = request.headers.get("x-forwarded-proto")
        forwarded_host = request.headers.get("x-forwarded-host")
        host = forwarded_host or request.headers.get("host")
        if host:
            scheme = forwarded_proto or request.url.scheme or "https"
            return f"{scheme}://{host}".rstrip("/")
    return DEFAULT_PUBLIC_APP_URL


def build_judge_url(token: str, request: Request | None = None) -> str:
    return f"{public_base_url(request)}/judge/{token}"


def get_evaluation_by_token(db: Session, token: str) -> SessionEvaluation:
    evaluation = db.query(SessionEvaluation).filter(SessionEvaluation.token == token).first()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    return evaluation


def internal_judge_email(evaluation: SessionEvaluation, name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-") or "jurado"
    return f"judge-{evaluation.session_id}-{slug}@internal.judge"


def ensure_default_criteria(db: Session, session_id: int) -> None:
    existing_criteria = db.query(EvaluationCriterion).filter(EvaluationCriterion.session_id == session_id).order_by(EvaluationCriterion.order).all()
    if existing_criteria:
        existing_scores = db.query(TeamScore).filter(TeamScore.session_id == session_id).count()
        if existing_scores:
            return
        expected_names = [name for name, _weight in DEFAULT_CRITERIA]
        current_names = [criterion.name for criterion in existing_criteria]
        if current_names == expected_names:
            return
        for criterion in existing_criteria:
            db.delete(criterion)
        db.flush()

    for index, (name, weight) in enumerate(DEFAULT_CRITERIA, start=1):
        db.add(EvaluationCriterion(session_id=session_id, name=name, weight=weight, max_score=5, order=index, active=True))


def serialize_criteria(db: Session, session_id: int) -> list[EvaluationCriterionOut]:
    return [
        EvaluationCriterionOut.model_validate(item)
        for item in db.query(EvaluationCriterion)
        .filter(EvaluationCriterion.session_id == session_id, EvaluationCriterion.active == True)  # noqa: E712
        .order_by(EvaluationCriterion.order, EvaluationCriterion.id)
        .all()
    ]


def build_ranking(db: Session, session_id: int) -> list[TeamRankingOut]:
    teams = db.query(Team).filter(Team.session_id == session_id).order_by(Team.id).all()
    criteria = db.query(EvaluationCriterion).filter(EvaluationCriterion.session_id == session_id, EvaluationCriterion.active == True).all()  # noqa: E712
    weights = {criterion.id: criterion.weight for criterion in criteria}
    scores = db.query(TeamScore).filter(TeamScore.session_id == session_id).all()
    judges_count = db.query(SessionJudge).filter(SessionJudge.session_id == session_id).count()
    output: list[TeamRankingOut] = []

    for team in teams:
        team_scores = [score for score in scores if score.team_id == team.id]
        judge_ids = {score.judge_id for score in team_scores}
        weighted_total = sum(score.score * weights.get(score.criterion_id, 1) for score in team_scores)
        weight_total = sum(weights.get(score.criterion_id, 1) for score in team_scores)
        average_score = round(weighted_total / weight_total, 2) if weight_total else 0
        output.append(
            TeamRankingOut(
                team_id=team.id,
                team_name=team.name,
                average_score=average_score,
                votes_count=len(judge_ids),
                judges_count=judges_count,
            )
        )

    return sorted(output, key=lambda item: (-item.average_score, item.team_name))


def serialize_session_judges(db: Session, session_id: int) -> list[SessionJudgeOut]:
    session_judges = db.query(SessionJudge).filter(SessionJudge.session_id == session_id).order_by(SessionJudge.id).all()
    output: list[SessionJudgeOut] = []
    for session_judge in session_judges:
        judge = db.get(Judge, session_judge.judge_id)
        if not judge:
            continue
        voted_teams = (
            db.query(func.count(func.distinct(TeamScore.team_id)))
            .filter(TeamScore.session_id == session_id, TeamScore.judge_id == judge.id)
            .scalar()
            or 0
        )
        output.append(
            SessionJudgeOut(
                judge=JudgeOut.model_validate(judge),
                status=session_judge.status,
                checked_in_at=session_judge.checked_in_at,
                voted_teams=voted_teams,
            )
        )
    return output


def serialize_evaluation(db: Session, evaluation: SessionEvaluation, request: Request | None = None) -> EvaluationOut:
    session = db.get(SessionModel, evaluation.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return EvaluationOut(
        id=evaluation.id,
        session=session,
        token=evaluation.token,
        status=evaluation.status,
        judge_url=build_judge_url(evaluation.token, request),
        criteria=serialize_criteria(db, evaluation.session_id),
        judges=serialize_session_judges(db, evaluation.session_id),
        ranking=build_ranking(db, evaluation.session_id),
    )


def get_or_create_evaluation(db: Session, session_id: int, status: str = "prepared") -> SessionEvaluation:
    session = db.get(SessionModel, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    evaluation = db.query(SessionEvaluation).filter(SessionEvaluation.session_id == session_id).first()
    if not evaluation:
        evaluation = SessionEvaluation(session_id=session_id, token=secrets.token_urlsafe(8), status=status)
        db.add(evaluation)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            evaluation = db.query(SessionEvaluation).filter(SessionEvaluation.session_id == session_id).first()
            if not evaluation:
                raise
    ensure_default_criteria(db, session_id)
    return evaluation


@router.post("/sessions/{session_id}/evaluation/prepare", response_model=EvaluationOut)
def prepare_evaluation(session_id: int, request: Request, db: Session = Depends(get_db)) -> EvaluationOut:
    evaluation = get_or_create_evaluation(db, session_id, "prepared")
    db.commit()
    db.refresh(evaluation)
    return serialize_evaluation(db, evaluation, request)


@router.post("/sessions/{session_id}/evaluation/open", response_model=EvaluationOut)
def open_evaluation(session_id: int, request: Request, db: Session = Depends(get_db)) -> EvaluationOut:
    session = db.get(SessionModel, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not db.query(Team).filter(Team.session_id == session_id).count():
        raise HTTPException(status_code=400, detail="Generate teams before opening evaluation")

    evaluation = get_or_create_evaluation(db, session_id, "open")
    evaluation.status = "open"
    evaluation.closed_at = None
    db.commit()
    db.refresh(evaluation)
    return serialize_evaluation(db, evaluation, request)


@router.post("/sessions/{session_id}/evaluation/close", response_model=EvaluationOut)
def close_evaluation(session_id: int, request: Request, db: Session = Depends(get_db)) -> EvaluationOut:
    evaluation = db.query(SessionEvaluation).filter(SessionEvaluation.session_id == session_id).first()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    evaluation.status = "closed"
    evaluation.closed_at = utc_now()
    db.commit()
    db.refresh(evaluation)
    return serialize_evaluation(db, evaluation, request)


@router.get("/sessions/{session_id}/evaluation", response_model=EvaluationOut)
def get_session_evaluation(session_id: int, request: Request, db: Session = Depends(get_db)) -> EvaluationOut:
    evaluation = db.query(SessionEvaluation).filter(SessionEvaluation.session_id == session_id).first()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    return serialize_evaluation(db, evaluation, request)


@router.delete("/sessions/{session_id}/evaluation/judges/{judge_id}", response_model=EvaluationOut)
def remove_session_judge(session_id: int, judge_id: int, request: Request, db: Session = Depends(get_db)) -> EvaluationOut:
    evaluation = db.query(SessionEvaluation).filter(SessionEvaluation.session_id == session_id).first()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    session_judge = (
        db.query(SessionJudge)
        .filter(SessionJudge.session_id == session_id, SessionJudge.judge_id == judge_id)
        .first()
    )
    if not session_judge:
        raise HTTPException(status_code=404, detail="Judge not found in this evaluation")

    db.query(TeamScore).filter(TeamScore.session_id == session_id, TeamScore.judge_id == judge_id).delete()
    db.delete(session_judge)
    db.commit()
    db.refresh(evaluation)
    return serialize_evaluation(db, evaluation, request)


@router.get("/sessions/{session_id}/evaluation/ranking", response_model=list[TeamRankingOut])
def get_session_ranking(session_id: int, db: Session = Depends(get_db)) -> list[TeamRankingOut]:
    if not db.get(SessionModel, session_id):
        raise HTTPException(status_code=404, detail="Session not found")
    return build_ranking(db, session_id)


@router.post("/sessions/{session_id}/evaluation/report", response_model=EvaluationReportOut)
def create_evaluation_report(session_id: int, db: Session = Depends(get_db)) -> EvaluationReportOut:
    from app.services.evaluation_reports import generate_evaluation_report

    session = db.get(SessionModel, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not db.query(Team).filter(Team.session_id == session_id).count():
        raise HTTPException(status_code=400, detail="Generate teams before requesting an evaluation report")
    return generate_evaluation_report(db, session)


@router.get("/judge/{token}", response_model=PublicEvaluationOut)
def get_public_evaluation(token: str, db: Session = Depends(get_db)) -> PublicEvaluationOut:
    evaluation = get_evaluation_by_token(db, token)
    session = db.get(SessionModel, evaluation.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return PublicEvaluationOut(
        session=session,
        token=evaluation.token,
        status=evaluation.status,
        criteria=serialize_criteria(db, evaluation.session_id),
        teams=serialize_teams(db, evaluation.session_id).teams,
        assignments=serialize_assignments(db, evaluation.session_id),
    )


@router.post("/judge/{token}/identify", response_model=JudgeOut)
def identify_judge(token: str, payload: JudgeIdentifyRequest, db: Session = Depends(get_db)) -> JudgeOut:
    evaluation = get_evaluation_by_token(db, token)
    if evaluation.status == "closed":
        raise HTTPException(status_code=400, detail="Evaluation is closed")

    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    email = payload.email.strip().lower() if payload.email else internal_judge_email(evaluation, name)
    judge = db.query(Judge).filter(Judge.email == email).first()
    if judge:
        judge.name = name
        judge.organization = payload.organization
        judge.updated_at = utc_now()
    else:
        judge = Judge(name=name, email=email, organization=payload.organization, active=True)
        db.add(judge)
        db.flush()

    session_judge = (
        db.query(SessionJudge)
        .filter(SessionJudge.session_id == evaluation.session_id, SessionJudge.judge_id == judge.id)
        .first()
    )
    if session_judge:
        session_judge.status = "checked_in"
        session_judge.checked_in_at = session_judge.checked_in_at or utc_now()
    else:
        db.add(SessionJudge(session_id=evaluation.session_id, judge_id=judge.id, status="checked_in", checked_in_at=utc_now()))

    db.commit()
    db.refresh(judge)
    return JudgeOut.model_validate(judge)


@router.get("/judge/{token}/scores", response_model=list[JudgeScoreOut])
def get_judge_scores(token: str, judge_id: int, db: Session = Depends(get_db)) -> list[JudgeScoreOut]:
    evaluation = get_evaluation_by_token(db, token)
    scores = (
        db.query(TeamScore)
        .filter(TeamScore.session_id == evaluation.session_id, TeamScore.judge_id == judge_id)
        .order_by(TeamScore.team_id, TeamScore.criterion_id)
        .all()
    )
    return [JudgeScoreOut(team_id=item.team_id, criterion_id=item.criterion_id, score=item.score, comment=item.comment) for item in scores]


@router.post("/judge/{token}/scores", response_model=list[JudgeScoreOut])
def submit_scores(token: str, payload: TeamScoreSubmit, db: Session = Depends(get_db)) -> list[JudgeScoreOut]:
    evaluation = get_evaluation_by_token(db, token)
    if evaluation.status != "open":
        raise HTTPException(status_code=400, detail="Evaluation is closed")
    if not db.query(SessionJudge).filter(SessionJudge.session_id == evaluation.session_id, SessionJudge.judge_id == payload.judge_id).first():
        raise HTTPException(status_code=400, detail="Judge is not registered for this evaluation")
    team = db.get(Team, payload.team_id)
    if not team or team.session_id != evaluation.session_id:
        raise HTTPException(status_code=404, detail="Team not found")

    valid_criteria = {
        criterion.id
        for criterion in db.query(EvaluationCriterion)
        .filter(EvaluationCriterion.session_id == evaluation.session_id, EvaluationCriterion.active == True)  # noqa: E712
        .all()
    }
    for item in payload.scores:
        if item.criterion_id not in valid_criteria:
            raise HTTPException(status_code=400, detail="Invalid criterion")
        existing = (
            db.query(TeamScore)
            .filter(
                TeamScore.session_id == evaluation.session_id,
                TeamScore.judge_id == payload.judge_id,
                TeamScore.team_id == payload.team_id,
                TeamScore.criterion_id == item.criterion_id,
            )
            .first()
        )
        if existing:
            existing.score = item.score
            existing.comment = payload.comment
            existing.updated_at = utc_now()
        else:
            db.add(
                TeamScore(
                    session_id=evaluation.session_id,
                    judge_id=payload.judge_id,
                    team_id=payload.team_id,
                    criterion_id=item.criterion_id,
                    score=item.score,
                    comment=payload.comment,
                )
            )

    db.commit()
    return get_judge_scores(token, payload.judge_id, db)
