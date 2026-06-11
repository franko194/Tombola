from pydantic import BaseModel, Field


class ORMModel(BaseModel):
    model_config = {"from_attributes": True}


class SessionCreate(BaseModel):
    name: str
    date: str


class SessionUpdate(BaseModel):
    name: str | None = None
    date: str | None = None
    status: str | None = None


class SessionDuplicate(BaseModel):
    name: str
    date: str


class SessionOut(ORMModel):
    id: int
    name: str
    date: str
    status: str
    created_at: str
    updated_at: str


class ParticipantCreate(BaseModel):
    name: str
    ai_level: int = Field(ge=0, le=5)


class ParticipantUpdate(BaseModel):
    name: str | None = None
    ai_level: int | None = Field(default=None, ge=0, le=5)


class ParticipantOut(ORMModel):
    id: int
    session_id: int
    name: str
    ai_level: int


class UseCaseCreate(BaseModel):
    title: str
    description: str | None = None


class UseCaseUpdate(BaseModel):
    title: str | None = None
    description: str | None = None


class UseCaseOut(ORMModel):
    id: int
    session_id: int
    title: str
    description: str | None = None


class TeamGenerateRequest(BaseModel):
    number_of_teams: int = Field(ge=1)


class TeamMemberOut(BaseModel):
    id: int
    name: str
    ai_level: int


class TeamOut(BaseModel):
    id: int
    name: str
    average_ai_level: float
    total_ai_score: int
    members: list[TeamMemberOut]


class BalanceOut(BaseModel):
    highest_average: float
    lowest_average: float
    average_gap: float


class TeamsResponse(BaseModel):
    teams: list[TeamOut]
    balance: BalanceOut


class TeamInsightsOut(BaseModel):
    summary: str
    strengths: list[str]
    recommendations: list[str]
    generated_by: str


class AssignmentRequest(BaseModel):
    mode: str = "random"


class AssignmentOut(BaseModel):
    id: int
    team_id: int
    use_case_id: int
    assigned_at: str
    team_name: str
    use_case_title: str
    use_case_description: str | None = None


class ResultsOut(BaseModel):
    session: SessionOut
    teams: list[TeamOut]
    assignments: list[AssignmentOut]


class JudgeIdentifyRequest(BaseModel):
    name: str
    email: str
    organization: str | None = None


class JudgeOut(ORMModel):
    id: int
    name: str
    email: str
    organization: str | None = None
    active: bool


class SessionJudgeOut(BaseModel):
    judge: JudgeOut
    status: str
    checked_in_at: str | None = None
    voted_teams: int = 0


class EvaluationCriterionOut(ORMModel):
    id: int
    session_id: int
    name: str
    weight: float
    max_score: int
    order: int
    active: bool


class ScoreItemIn(BaseModel):
    criterion_id: int
    score: int = Field(ge=1, le=5)


class TeamScoreSubmit(BaseModel):
    judge_id: int
    team_id: int
    scores: list[ScoreItemIn]
    comment: str | None = None


class JudgeScoreOut(BaseModel):
    team_id: int
    criterion_id: int
    score: int
    comment: str | None = None


class TeamRankingOut(BaseModel):
    team_id: int
    team_name: str
    average_score: float
    votes_count: int
    judges_count: int


class EvaluationOut(BaseModel):
    id: int
    session: SessionOut
    token: str
    status: str
    judge_url: str
    criteria: list[EvaluationCriterionOut]
    judges: list[SessionJudgeOut]
    ranking: list[TeamRankingOut]


class PublicEvaluationOut(BaseModel):
    session: SessionOut
    token: str
    status: str
    criteria: list[EvaluationCriterionOut]
    teams: list[TeamOut]
    assignments: list[AssignmentOut]
