# IA Friday Web MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working reusable IA Friday Tombola web app with sessions, participants, use cases, balanced teams, tombola assignment, and projector results.

**Architecture:** The app has a FastAPI backend with SQLite persistence and a React TypeScript frontend built with Vite and TailwindCSS. Backend services own team balancing and use case assignment; the frontend focuses on organizer workflow and visual presentation.

**Tech Stack:** Python, FastAPI, SQLAlchemy, pytest, SQLite, React, TypeScript, Vite, TailwindCSS.

---

## File Structure

Backend files:

- `backend/requirements.txt`: Python dependencies.
- `backend/app/__init__.py`: App package marker.
- `backend/app/main.py`: FastAPI app setup and router registration.
- `backend/app/database.py`: SQLite engine, session factory, and table initialization.
- `backend/app/models.py`: SQLAlchemy ORM models.
- `backend/app/schemas.py`: Pydantic request and response schemas.
- `backend/app/routers/sessions.py`: Session endpoints.
- `backend/app/routers/participants.py`: Participant CRUD and import endpoints.
- `backend/app/routers/usecases.py`: Use case CRUD endpoints.
- `backend/app/routers/teams.py`: Team generation and retrieval endpoints.
- `backend/app/routers/results.py`: Assignment and results endpoints.
- `backend/app/services/team_balancer.py`: Snake Draft team generation logic.
- `backend/app/services/usecase_assigner.py`: Random assignment without replacement.
- `backend/tests/test_team_balancer.py`: Unit tests for team balancing.
- `backend/tests/test_usecase_assigner.py`: Unit tests for assignment.
- `backend/tests/test_api_flow.py`: API integration flow test.

Frontend files:

- `frontend/package.json`: Frontend scripts and dependencies.
- `frontend/index.html`: Vite entry HTML.
- `frontend/vite.config.ts`: Vite config.
- `frontend/tsconfig.json`: TypeScript config.
- `frontend/tailwind.config.js`: Tailwind config.
- `frontend/postcss.config.js`: PostCSS config.
- `frontend/src/main.tsx`: React entry.
- `frontend/src/App.tsx`: Main app shell and route state.
- `frontend/src/styles.css`: Tailwind base and custom visual system.
- `frontend/src/types.ts`: Shared frontend types.
- `frontend/src/api/client.ts`: Fetch wrapper.
- `frontend/src/api/resources.ts`: API resource functions.
- `frontend/src/components/Layout.tsx`: App frame and navigation.
- `frontend/src/components/StatusBadge.tsx`: Session status badge.
- `frontend/src/components/MetricCard.tsx`: Compact dashboard metric.
- `frontend/src/pages/SessionsPage.tsx`: Create/open sessions.
- `frontend/src/pages/DashboardPage.tsx`: Session overview and next actions.
- `frontend/src/pages/ParticipantsPage.tsx`: Manual participant management and import.
- `frontend/src/pages/UseCasesPage.tsx`: Use case management.
- `frontend/src/pages/TeamsPage.tsx`: Team generation and balance review.
- `frontend/src/pages/TombolaPage.tsx`: Visual ticket tombola.
- `frontend/src/pages/ResultsPage.tsx`: Projector-friendly results.

Root files:

- `package.json`: Convenience scripts for frontend/backend.
- `README.md`: Local run instructions.

---

### Task 1: Backend Skeleton and Database

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/app/__init__.py`
- Create: `backend/app/database.py`
- Create: `backend/app/models.py`
- Create: `backend/app/main.py`

- [ ] **Step 1: Create backend dependencies**

Create `backend/requirements.txt`:

```txt
fastapi==0.115.6
uvicorn[standard]==0.34.0
sqlalchemy==2.0.36
pydantic==2.10.4
python-multipart==0.0.20
openpyxl==3.1.5
pytest==8.3.4
httpx==0.28.1
```

- [ ] **Step 2: Create database setup**

Create `backend/app/database.py`:

```py
from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite:///{DATA_DIR / 'ia_friday.db'}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app import models

    Base.metadata.create_all(bind=engine)
```

- [ ] **Step 3: Create ORM models**

Create `backend/app/models.py`:

```py
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
        UniqueConstraint("session_id", "use_case_id", name="unique_use_case_assignment"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"))
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"))
    use_case_id: Mapped[int] = mapped_column(ForeignKey("use_cases.id", ondelete="CASCADE"))
    assigned_at: Mapped[str] = mapped_column(default=utc_now)
```

- [ ] **Step 4: Create FastAPI entry point**

Create `backend/app/main.py`:

```py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db

app = FastAPI(title="IA Friday Tombola API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 5: Run backend health check**

Run:

```bash
cd backend
python -m uvicorn app.main:app --reload
```

Expected: server starts and `GET http://127.0.0.1:8000/health` returns `{"status":"ok"}`.

---

### Task 2: Backend Services with Tests

**Files:**
- Create: `backend/app/services/team_balancer.py`
- Create: `backend/app/services/usecase_assigner.py`
- Create: `backend/tests/test_team_balancer.py`
- Create: `backend/tests/test_usecase_assigner.py`

- [ ] **Step 1: Write team balancer tests**

Create `backend/tests/test_team_balancer.py`:

```py
from app.services.team_balancer import ParticipantInput, generate_snake_draft_teams


def test_snake_draft_creates_requested_number_of_teams():
    participants = [
        ParticipantInput(id=1, name="Ana", ai_level=5),
        ParticipantInput(id=2, name="Pedro", ai_level=4),
        ParticipantInput(id=3, name="Juan", ai_level=3),
        ParticipantInput(id=4, name="Sofia", ai_level=2),
    ]

    teams = generate_snake_draft_teams(participants, 2)

    assert len(teams) == 2
    assert teams[0].name == "Equipo A"
    assert teams[1].name == "Equipo B"


def test_snake_draft_balances_experience_levels():
    participants = [
        ParticipantInput(id=1, name="P1", ai_level=5),
        ParticipantInput(id=2, name="P2", ai_level=5),
        ParticipantInput(id=3, name="P3", ai_level=4),
        ParticipantInput(id=4, name="P4", ai_level=3),
        ParticipantInput(id=5, name="P5", ai_level=2),
        ParticipantInput(id=6, name="P6", ai_level=1),
    ]

    teams = generate_snake_draft_teams(participants, 3)
    totals = [team.total_score for team in teams]

    assert max(totals) - min(totals) <= 3
    assert all(len(team.members) == 2 for team in teams)


def test_snake_draft_rejects_more_teams_than_participants():
    participants = [ParticipantInput(id=1, name="Ana", ai_level=3)]

    try:
        generate_snake_draft_teams(participants, 2)
    except ValueError as error:
        assert "at least one participant per team" in str(error)
    else:
        raise AssertionError("Expected ValueError")
```

- [ ] **Step 2: Implement team balancer**

Create `backend/app/services/team_balancer.py`:

```py
from dataclasses import dataclass, field


@dataclass
class ParticipantInput:
    id: int
    name: str
    ai_level: int


@dataclass
class BalancedTeam:
    name: str
    members: list[ParticipantInput] = field(default_factory=list)
    total_score: int = 0
    average_score: float = 0


def generate_snake_draft_teams(
    participants: list[ParticipantInput],
    number_of_teams: int,
) -> list[BalancedTeam]:
    if number_of_teams < 1:
        raise ValueError("number_of_teams must be greater than 0")

    if len(participants) < number_of_teams:
        raise ValueError("There must be at least one participant per team")

    sorted_participants = sorted(participants, key=lambda item: item.ai_level, reverse=True)
    teams = [BalancedTeam(name=f"Equipo {chr(65 + index)}") for index in range(number_of_teams)]

    direction = 1
    team_index = 0

    for participant in sorted_participants:
        teams[team_index].members.append(participant)

        if team_index == number_of_teams - 1 and direction == 1:
            direction = -1
        elif team_index == 0 and direction == -1:
            direction = 1
        else:
            team_index += direction

    for team in teams:
        team.total_score = sum(member.ai_level for member in team.members)
        team.average_score = round(team.total_score / len(team.members), 2)

    return teams
```

- [ ] **Step 3: Write use case assigner tests**

Create `backend/tests/test_usecase_assigner.py`:

```py
from app.services.usecase_assigner import UseCaseInput, assign_use_cases


def test_assign_use_cases_assigns_unique_cases():
    assignments = assign_use_cases(
        team_ids=[1, 2, 3],
        use_cases=[
            UseCaseInput(id=10, title="Caso A"),
            UseCaseInput(id=11, title="Caso B"),
            UseCaseInput(id=12, title="Caso C"),
        ],
        seed=42,
    )

    assigned_case_ids = [use_case.id for use_case in assignments.values()]

    assert set(assignments.keys()) == {1, 2, 3}
    assert len(assigned_case_ids) == len(set(assigned_case_ids))


def test_assign_use_cases_rejects_too_few_cases():
    try:
        assign_use_cases(
            team_ids=[1, 2],
            use_cases=[UseCaseInput(id=10, title="Caso A")],
            seed=42,
        )
    except ValueError as error:
        assert "at least one use case per team" in str(error)
    else:
        raise AssertionError("Expected ValueError")
```

- [ ] **Step 4: Implement use case assigner**

Create `backend/app/services/usecase_assigner.py`:

```py
import random
from dataclasses import dataclass


@dataclass
class UseCaseInput:
    id: int
    title: str


def assign_use_cases(
    team_ids: list[int],
    use_cases: list[UseCaseInput],
    seed: int | None = None,
) -> dict[int, UseCaseInput]:
    if len(use_cases) < len(team_ids):
        raise ValueError("There must be at least one use case per team")

    randomizer = random.Random(seed)
    shuffled = use_cases[:]
    randomizer.shuffle(shuffled)

    return {team_id: shuffled[index] for index, team_id in enumerate(team_ids)}
```

- [ ] **Step 5: Run service tests**

Run:

```bash
cd backend
python -m pytest tests/test_team_balancer.py tests/test_usecase_assigner.py -v
```

Expected: all tests pass.

---

### Task 3: Backend API

**Files:**
- Create: `backend/app/schemas.py`
- Create: `backend/app/routers/sessions.py`
- Create: `backend/app/routers/participants.py`
- Create: `backend/app/routers/usecases.py`
- Create: `backend/app/routers/teams.py`
- Create: `backend/app/routers/results.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_api_flow.py`

- [ ] **Step 1: Create API schemas**

Create `backend/app/schemas.py` with Pydantic models for sessions, participants, use cases, teams, assignments, and results. Use `from_attributes = True` on response models so SQLAlchemy records serialize cleanly.

- [ ] **Step 2: Implement routers**

Create routers for:

- `POST /sessions`
- `GET /sessions`
- `GET /sessions/{session_id}`
- `PATCH /sessions/{session_id}`
- `POST /sessions/{session_id}/reopen`
- `POST /sessions/{session_id}/participants`
- `GET /sessions/{session_id}/participants`
- `PATCH /participants/{participant_id}`
- `DELETE /participants/{participant_id}`
- `POST /sessions/{session_id}/participants/import`
- `POST /sessions/{session_id}/use-cases`
- `GET /sessions/{session_id}/use-cases`
- `PATCH /use-cases/{use_case_id}`
- `DELETE /use-cases/{use_case_id}`
- `POST /sessions/{session_id}/teams/generate`
- `GET /sessions/{session_id}/teams`
- `POST /sessions/{session_id}/use-cases/assign`
- `GET /sessions/{session_id}/results`

- [ ] **Step 3: Add API flow test**

Create `backend/tests/test_api_flow.py` to verify this flow:

1. Create session.
2. Add 6 participants.
3. Add 3 use cases.
4. Generate 3 teams.
5. Assign use cases.
6. Fetch results.

- [ ] **Step 4: Register routers in app**

Modify `backend/app/main.py` to include each router.

- [ ] **Step 5: Run API tests**

Run:

```bash
cd backend
python -m pytest tests -v
```

Expected: all backend tests pass.

---

### Task 4: Frontend Skeleton and API Client

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/index.html`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/styles.css`
- Create: `frontend/src/types.ts`
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/resources.ts`

- [ ] **Step 1: Create frontend package**

Create `frontend/package.json`:

```json
{
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc && vite build",
    "preview": "vite preview --host 0.0.0.0"
  },
  "dependencies": {
    "@vitejs/plugin-react": "latest",
    "vite": "latest",
    "typescript": "latest",
    "react": "latest",
    "react-dom": "latest",
    "lucide-react": "latest"
  },
  "devDependencies": {
    "tailwindcss": "latest",
    "postcss": "latest",
    "autoprefixer": "latest"
  }
}
```

- [ ] **Step 2: Create app shell**

Create Vite and React entry files with a simple state-based router. The first view should be `SessionsPage`; once a session is selected, show the app layout.

- [ ] **Step 3: Create API client**

Create a fetch wrapper using `http://127.0.0.1:8000` as the default API base and `VITE_API_URL` as override.

- [ ] **Step 4: Run frontend build**

Run:

```bash
cd frontend
npm run build
```

Expected: TypeScript and Vite build successfully.

---

### Task 5: Organizer Pages

**Files:**
- Create: `frontend/src/components/Layout.tsx`
- Create: `frontend/src/components/StatusBadge.tsx`
- Create: `frontend/src/components/MetricCard.tsx`
- Create: `frontend/src/pages/SessionsPage.tsx`
- Create: `frontend/src/pages/DashboardPage.tsx`
- Create: `frontend/src/pages/ParticipantsPage.tsx`
- Create: `frontend/src/pages/UseCasesPage.tsx`
- Create: `frontend/src/pages/TeamsPage.tsx`

- [ ] **Step 1: Build layout and navigation**

Create a compact organizer shell with tabs for Dashboard, Participantes, Casos, Equipos, Tombola, and Resultados.

- [ ] **Step 2: Build sessions page**

Implement session list, create session form, continue latest session, and open existing session.

- [ ] **Step 3: Build dashboard page**

Show counts and next recommended action for the current session.

- [ ] **Step 4: Build participants page**

Implement manual add/edit/delete and file import input.

- [ ] **Step 5: Build use cases page**

Implement manual add/edit/delete.

- [ ] **Step 6: Build teams page**

Implement number of teams input, generate button, team cards, and balance metrics.

- [ ] **Step 7: Run frontend build**

Run:

```bash
cd frontend
npm run build
```

Expected: build succeeds.

---

### Task 6: Tombola and Results Views

**Files:**
- Create: `frontend/src/pages/TombolaPage.tsx`
- Create: `frontend/src/pages/ResultsPage.tsx`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Build tombola page**

Implement visual ticket/card animation with a "Iniciar tombola" button. The backend assignment should happen once, then the frontend reveals persisted assignments one by one.

- [ ] **Step 2: Build results page**

Implement a projector-friendly grid showing each team, members, average AI level, and assigned use case.

- [ ] **Step 3: Polish styles**

Use a modern Innovation Lab visual direction: neutral background, compact cards, cyan/green/blue accents, readable typography, and strong contrast for projector mode.

- [ ] **Step 4: Run frontend build**

Run:

```bash
cd frontend
npm run build
```

Expected: build succeeds.

---

### Task 7: Root Scripts, README, and End-to-End Verification

**Files:**
- Create: `package.json`
- Create: `README.md`

- [ ] **Step 1: Add root convenience scripts**

Create root `package.json`:

```json
{
  "scripts": {
    "install:frontend": "cd frontend && npm install",
    "backend": "cd backend && python -m uvicorn app.main:app --reload",
    "frontend": "cd frontend && npm run dev",
    "build": "cd frontend && npm run build",
    "test:backend": "cd backend && python -m pytest tests -v"
  }
}
```

- [ ] **Step 2: Add README**

Create `README.md` with:

- Stack summary.
- Backend install and run commands.
- Frontend install and run commands.
- CSV/Excel expected columns: `nombre`, `nivelIA`.
- Manual event flow.

- [ ] **Step 3: Run backend tests**

Run:

```bash
cd backend
python -m pytest tests -v
```

Expected: all tests pass.

- [ ] **Step 4: Run frontend build**

Run:

```bash
cd frontend
npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Manual app verification**

Run backend and frontend. In the browser:

1. Create a session.
2. Add 6 participants.
3. Add 3 use cases.
4. Generate 3 teams.
5. Run tombola.
6. Open results.

Expected: results show all teams, members, averages, and unique assigned use cases.

---

## Self-Review

Spec coverage:

- Sessions are covered by Tasks 1, 3, and 5.
- Manual participants and imports are covered by Tasks 3 and 5.
- Use cases are covered by Tasks 3 and 5.
- Team balancing is covered by Tasks 2, 3, and 5.
- Tombola assignment is covered by Tasks 2, 3, and 6.
- Projector results are covered by Task 6.
- Local persistence is covered by Task 1.
- QR, auth, and public deployment remain out of scope.

Placeholder scan:

- No TBD/TODO placeholders are used.
- API router implementation is intentionally grouped in Task 3 because it must be executed as one coherent backend slice.

Type consistency:

- Backend uses `ai_level`; frontend can map display labels from API fields.
- Sessions use `draft`, `teams_generated`, `cases_assigned`, and `completed`.
- Teams use `average_ai_level` and `total_ai_score` in API responses.

