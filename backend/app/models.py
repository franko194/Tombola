from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class SessionModel(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    date: Mapped[str]
    status: Mapped[str] = mapped_column(default="draft")
    created_at: Mapped[str] = mapped_column(default=utc_now)
    updated_at: Mapped[str] = mapped_column(default=utc_now)

    participants: Mapped[list["Participant"]] = relationship(cascade="all, delete-orphan")
    use_cases: Mapped[list["UseCase"]] = relationship(cascade="all, delete-orphan")
    teams: Mapped[list["Team"]] = relationship(cascade="all, delete-orphan")
    assignments: Mapped[list["Assignment"]] = relationship(cascade="all, delete-orphan")


class Participant(Base):
    __tablename__ = "participants"
    __table_args__ = (CheckConstraint("ai_level BETWEEN 0 AND 5", name="valid_ai_level"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"))
    name: Mapped[str]
    ai_level: Mapped[int]
    created_at: Mapped[str] = mapped_column(default=utc_now)
    updated_at: Mapped[str] = mapped_column(default=utc_now)


class UseCase(Base):
    __tablename__ = "use_cases"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"))
    title: Mapped[str]
    description: Mapped[str | None] = mapped_column(default=None)
    created_at: Mapped[str] = mapped_column(default=utc_now)
    updated_at: Mapped[str] = mapped_column(default=utc_now)


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"))
    name: Mapped[str]
    average_ai_level: Mapped[float]
    total_ai_score: Mapped[int]
    created_at: Mapped[str] = mapped_column(default=utc_now)

    members: Mapped[list["TeamMember"]] = relationship(cascade="all, delete-orphan")


class TeamMember(Base):
    __tablename__ = "team_members"

    id: Mapped[int] = mapped_column(primary_key=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"))
    participant_id: Mapped[int] = mapped_column(ForeignKey("participants.id", ondelete="CASCADE"))


class Assignment(Base):
    __tablename__ = "assignments"
    __table_args__ = (
        UniqueConstraint("session_id", "team_id", name="unique_team_assignment"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"))
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"))
    use_case_id: Mapped[int] = mapped_column(ForeignKey("use_cases.id", ondelete="CASCADE"))
    assigned_at: Mapped[str] = mapped_column(default=utc_now)


class ResultSnapshot(Base):
    __tablename__ = "result_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"), unique=True)
    payload_json: Mapped[str]
    created_at: Mapped[str] = mapped_column(default=utc_now)


class Judge(Base):
    __tablename__ = "judges"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    email: Mapped[str] = mapped_column(unique=True)
    organization: Mapped[str | None] = mapped_column(default=None)
    active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[str] = mapped_column(default=utc_now)
    updated_at: Mapped[str] = mapped_column(default=utc_now)


class SessionEvaluation(Base):
    __tablename__ = "session_evaluations"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"), unique=True)
    token: Mapped[str] = mapped_column(unique=True)
    status: Mapped[str] = mapped_column(default="open")
    opened_at: Mapped[str] = mapped_column(default=utc_now)
    closed_at: Mapped[str | None] = mapped_column(default=None)


class SessionJudge(Base):
    __tablename__ = "session_judges"
    __table_args__ = (UniqueConstraint("session_id", "judge_id", name="unique_session_judge"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"))
    judge_id: Mapped[int] = mapped_column(ForeignKey("judges.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(default="checked_in")
    invited_at: Mapped[str] = mapped_column(default=utc_now)
    checked_in_at: Mapped[str | None] = mapped_column(default=utc_now)


class EvaluationCriterion(Base):
    __tablename__ = "evaluation_criteria"
    __table_args__ = (UniqueConstraint("session_id", "name", name="unique_session_criterion"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"))
    name: Mapped[str]
    weight: Mapped[float] = mapped_column(default=1)
    max_score: Mapped[int] = mapped_column(default=5)
    order: Mapped[int] = mapped_column(default=0)
    active: Mapped[bool] = mapped_column(default=True)


class TeamScore(Base):
    __tablename__ = "team_scores"
    __table_args__ = (UniqueConstraint("session_id", "judge_id", "team_id", "criterion_id", name="unique_team_score"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"))
    judge_id: Mapped[int] = mapped_column(ForeignKey("judges.id", ondelete="CASCADE"))
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"))
    criterion_id: Mapped[int] = mapped_column(ForeignKey("evaluation_criteria.id", ondelete="CASCADE"))
    score: Mapped[int]
    comment: Mapped[str | None] = mapped_column(default=None)
    created_at: Mapped[str] = mapped_column(default=utc_now)
    updated_at: Mapped[str] = mapped_column(default=utc_now)
