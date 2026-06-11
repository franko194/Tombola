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
