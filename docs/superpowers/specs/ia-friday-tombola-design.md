# IA Friday Tombola - MVP Design

## Vision

IA Friday Tombola is a reusable web application for weekly IA Friday workshop sessions. Its goal is to help an organizer register participants, classify their AI experience level, generate balanced teams, assign use cases through a visual tombola, and present results clearly on a shared screen.

The product should feel like a modern Innovation Lab tool: professional, energetic, easy to operate live, and visually polished enough for a corporate workshop.

## Scope

The MVP supports recurring IA Friday sessions. Each session is independent and contains its own participants, use cases, generated teams, assignments, and final results.

The app is not tied to a specific calendar date. Dates are session metadata only, used to organize weekly history.

Included in MVP:

- Create, list, open, edit, and reopen IA Friday sessions.
- Register participants manually.
- Edit and delete participants.
- Import participants from CSV and Excel.
- Register use cases manually for each session.
- Edit and delete use cases.
- Generate balanced teams by selecting the number of teams.
- Assign one unique use case per team through a visual tombola.
- Show final results in an organizer view and a projector-friendly view.
- Persist data locally using SQLite.

Out of scope for MVP:

- QR participant registration.
- Public cloud deployment.
- Authentication and user roles.
- Multiple event brands beyond IA Friday.
- Reusing use cases automatically across sessions.
- Real-time multi-device synchronization.

## Recommended Stack

Frontend:

- React
- TypeScript
- Vite
- TailwindCSS

Backend:

- Python
- FastAPI
- SQLAlchemy
- SQLite

Import support:

- CSV with Python standard library or pandas.
- Excel `.xlsx` with openpyxl or pandas.

This stack is recommended because it gives a real API and persistence layer while staying lightweight enough to run on the organizer's computer during a live event.

## Product Flow

1. Organizer opens the app.
2. Organizer creates a new IA Friday session or opens an existing one.
3. Organizer adds participants manually or imports them from CSV/Excel.
4. Organizer adds the use cases for that session.
5. Organizer selects the number of teams.
6. App generates balanced teams using Snake Draft.
7. Organizer reviews teams and can regenerate if needed.
8. Organizer starts the tombola.
9. App assigns unique use cases to teams with animation.
10. Organizer displays final results on a projector view.
11. Organizer marks the session as completed.
12. Completed sessions remain available in history and can be reopened explicitly.

## Session States

Sessions use these states:

- `draft`: participants and use cases are being prepared.
- `teams_generated`: teams have been generated.
- `cases_assigned`: teams have received use cases.
- `completed`: the session has ended.

A completed session can be reopened by the organizer. Reopening should be explicit to avoid accidental changes to historical results.

## Data Model

### sessions

Represents one weekly IA Friday execution.

Fields:

- `id`
- `name`
- `date`
- `status`
- `created_at`
- `updated_at`

Example:

```json
{
  "id": 1,
  "name": "IA Friday - Sesion semanal",
  "date": "2026-06-05",
  "status": "draft"
}
```

The `date` value represents the selected session date. It is not hardcoded by the application.

### participants

Represents a participant in one session.

Fields:

- `id`
- `session_id`
- `name`
- `ai_level`
- `created_at`
- `updated_at`

Rules:

- `ai_level` must be between 0 and 5.
- Participant names are required.

AI level scale:

- `0`: Sin experiencia
- `1`: Principiante
- `2`: Basico
- `3`: Intermedio
- `4`: Avanzado
- `5`: Experto

### use_cases

Represents a use case available for a specific session.

Fields:

- `id`
- `session_id`
- `title`
- `description`
- `created_at`
- `updated_at`

Rules:

- A session must have at least as many use cases as generated teams before assignment.
- A use case can only be assigned once per session.

### teams

Represents a generated team in a session.

Fields:

- `id`
- `session_id`
- `name`
- `average_ai_level`
- `total_ai_score`
- `created_at`

Example team names:

- Equipo A
- Equipo B
- Equipo C

### team_members

Links participants to teams.

Fields:

- `id`
- `team_id`
- `participant_id`

Rules:

- A participant can belong to only one team per session.

### assignments

Links a team to one assigned use case.

Fields:

- `id`
- `session_id`
- `team_id`
- `use_case_id`
- `assigned_at`

Rules:

- A team can receive only one use case.
- A use case can be assigned only once in the same session.

## Logical Relationships

```txt
sessions 1 -> N participants
sessions 1 -> N use_cases
sessions 1 -> N teams
teams 1 -> N team_members
participants 1 -> 1 team_members per session
teams 1 -> 1 assignments
use_cases 1 -> 1 assignments per session
```

## SQL Sketch

```sql
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  ai_level INTEGER NOT NULL CHECK (ai_level BETWEEN 0 AND 5),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE use_cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  average_ai_level REAL NOT NULL,
  total_ai_score INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL,
  participant_id INTEGER NOT NULL,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
);

CREATE TABLE assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  use_case_id INTEGER NOT NULL,
  assigned_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (use_case_id) REFERENCES use_cases(id) ON DELETE CASCADE,
  UNIQUE (session_id, team_id),
  UNIQUE (session_id, use_case_id)
);
```

## API Design

### Sessions

`POST /sessions`

Creates a session.

```json
{
  "name": "IA Friday - Sesion semanal",
  "date": "2026-06-05"
}
```

`GET /sessions`

Returns all sessions ordered by newest first.

`GET /sessions/{session_id}`

Returns session detail.

`PATCH /sessions/{session_id}`

Updates name, date, or status.

`POST /sessions/{session_id}/reopen`

Reopens a completed session.

### Participants

`POST /sessions/{session_id}/participants`

```json
{
  "name": "Juan Perez",
  "ai_level": 3
}
```

`GET /sessions/{session_id}/participants`

`PATCH /participants/{participant_id}`

`DELETE /participants/{participant_id}`

`POST /sessions/{session_id}/participants/import`

Accepts CSV or Excel file.

Expected columns:

```txt
nombre,nivelIA
Ana Perez,3
Pedro Soto,1
Juan Diaz,5
```

### Use Cases

`POST /sessions/{session_id}/use-cases`

```json
{
  "title": "Automatizacion de reportes",
  "description": "Crear un flujo que genere reportes semanales con asistencia de IA."
}
```

`GET /sessions/{session_id}/use-cases`

`PATCH /use-cases/{use_case_id}`

`DELETE /use-cases/{use_case_id}`

### Teams

`POST /sessions/{session_id}/teams/generate`

```json
{
  "number_of_teams": 4
}
```

Returns generated teams with metrics.

```json
{
  "teams": [
    {
      "id": 1,
      "name": "Equipo A",
      "average_ai_level": 3.2,
      "total_ai_score": 16,
      "members": [
        { "id": 1, "name": "Ana Perez", "ai_level": 5 }
      ]
    }
  ],
  "balance": {
    "highest_average": 3.4,
    "lowest_average": 3.0,
    "average_gap": 0.4
  }
}
```

`GET /sessions/{session_id}/teams`

### Assignments

`POST /sessions/{session_id}/use-cases/assign`

Assigns one unique use case per team.

```json
{
  "mode": "random"
}
```

`GET /sessions/{session_id}/results`

Returns final session results.

## Team Balancing Algorithm

### MVP Algorithm: Snake Draft

Steps:

1. Sort participants by `ai_level` descending.
2. Create empty teams.
3. Assign participants in a forward direction.
4. Reverse direction after each round.
5. Calculate each team's average and total AI score.

Example for 4 teams:

```txt
Round 1: A, B, C, D
Round 2: D, C, B, A
Round 3: A, B, C, D
```

Benefits:

- Simple to explain.
- Fast for live operation.
- Avoids grouping all experts or all beginners.
- Good enough for 10 to 30 participants.

Limitation:

- It does not always produce mathematically optimal score distribution.

### V2 Algorithm: Optimized Score Balancing

Future improvement:

1. Sort participants by AI level descending.
2. Assign each next participant to the team with the lowest current total score.
3. Use team size as a secondary constraint.
4. Compare final score gap against Snake Draft.

This can reduce score differences but is less intuitive to explain live.

## Use Case Assignment

The MVP uses random assignment without replacement:

1. Validate that number of use cases is greater than or equal to number of teams.
2. Shuffle available use cases.
3. Assign the first use case to the first team, second to second team, and so on.
4. Persist assignments.
5. Return assigned results.

No use case can repeat in a session.

## Tombola Experience

The tombola should use visual tickets or cards instead of a wheel.

Reason:

- Corporate use cases can have long names.
- Cards are easier to read on a projector.
- The animation can be playful without hurting readability.

Suggested interaction:

1. Organizer clicks "Iniciar tombola".
2. Case cards shuffle or cycle quickly.
3. The app reveals one assignment at a time.
4. Each reveal has a short celebration animation.
5. Final results become available after all teams receive a case.

Sounds are optional and should be disabled by default.

## Frontend Pages

### SessionsPage

Purpose:

- Create a new session.
- Continue latest session.
- Open previous sessions.
- Show status and date.

### DashboardPage

Purpose:

- Show session progress.
- Show participant count, use case count, team count, and assignment status.
- Provide primary next action.

### ParticipantsPage

Purpose:

- Add participants manually.
- Edit and delete participants.
- Import CSV/Excel.
- Show distribution by AI level.

### UseCasesPage

Purpose:

- Add use cases for the current session.
- Edit and delete use cases.
- Show whether there are enough use cases for the number of teams.

### TeamsPage

Purpose:

- Select number of teams.
- Generate teams.
- Review balance metrics.
- Regenerate teams if needed.

### TombolaPage

Purpose:

- Run the visual tombola.
- Reveal one assigned use case per team.
- Transition to results.

### ResultsPage

Purpose:

- Show all teams, members, average level, and assigned use case.
- Provide a projector-friendly layout with large typography and high contrast.

## UX Principles

- The organizer should always know the next step.
- Live-event actions should be large, clear, and hard to trigger accidentally.
- Destructive actions require confirmation.
- Completed sessions can be reopened, but only through an explicit action.
- Projector views prioritize readability over controls.
- Tables should be compact and scannable.
- Animations should support the event flow, not slow it down.

## Visual Direction

Style: Modern Innovation Lab.

Traits:

- Clean corporate layout.
- Neutral background.
- Accents in cyan, green, and blue.
- Compact panels and cards.
- Subtle motion.
- Strong contrast in projector mode.
- No marketing landing page; the first screen is the working app.

## Error Handling

Validation cases:

- Cannot generate teams with fewer participants than teams.
- Cannot assign use cases before teams exist.
- Cannot assign use cases when there are fewer use cases than teams.
- Cannot import rows with missing name or invalid AI level.
- Cannot delete a participant after teams are generated without warning that teams will need regeneration.

Suggested behavior:

- Use clear inline validation.
- Return structured API errors.
- Show toast notifications for successful actions.
- Warn when an action invalidates generated teams or assignments.

## Testing Strategy

Backend unit tests:

- Team balancing with different participant counts.
- Random assignment without duplicates.
- Session state transitions.
- CSV/Excel import validation.

Backend API tests:

- Create session.
- CRUD participants.
- CRUD use cases.
- Generate teams.
- Assign cases.
- Get results.

Frontend tests:

- Smoke test main pages.
- Verify form validation.
- Verify navigation flow.

Manual verification:

- Create session.
- Add 15 participants.
- Add 5 use cases.
- Generate 4 teams.
- Run tombola.
- Show projector results.

## MVP Roadmap

1. Scaffold frontend and backend.
2. Implement SQLite models and database setup.
3. Implement sessions API.
4. Implement participants API and manual UI.
5. Implement CSV/Excel import.
6. Implement use cases API and UI.
7. Implement team balancing service and teams UI.
8. Implement use case assignment service.
9. Build tombola visual flow.
10. Build projector-friendly results view.
11. Add tests for balancing, assignment, and critical API paths.
12. Polish visual style and run end-to-end manual test.

## V2 Roadmap

- QR registration.
- Public deployment.
- Authentication.
- Role separation between organizer and viewer.
- Optimized team balancing comparison.
- Export results to PDF or CSV.
- Reuse previous session templates.
- Real-time projector updates.
- Event branding configuration.

## Technical Risks

- Excel imports can fail if users provide unexpected column names.
- SQLite is ideal locally but not suitable for concurrent public access.
- Tombola animation should not depend on assignment randomness after the backend has already persisted results.
- Reopening completed sessions can create historical ambiguity unless actions are explicit.
- If QR returns in V2, networking and deployment choices become more important.

## Implementation Examples

The backend implementation should use Python as the source of truth for team generation and use case assignment. TypeScript examples can still be useful for frontend typing, previews, or future client-side simulations.

### Python Snake Draft

```py
from dataclasses import dataclass, field


@dataclass
class Participant:
    id: int
    name: str
    ai_level: int


@dataclass
class Team:
    name: str
    members: list[Participant] = field(default_factory=list)
    total_score: int = 0
    average_score: float = 0


def generate_snake_draft_teams(
    participants: list[Participant],
    number_of_teams: int,
) -> list[Team]:
    if number_of_teams < 1:
        raise ValueError("number_of_teams must be greater than 0")

    if len(participants) < number_of_teams:
        raise ValueError("There must be at least one participant per team")

    sorted_participants = sorted(participants, key=lambda item: item.ai_level, reverse=True)
    teams = [Team(name=f"Equipo {chr(65 + index)}") for index in range(number_of_teams)]

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

### Python Random Use Case Assignment

```py
import random
from dataclasses import dataclass


@dataclass
class UseCase:
    id: int
    title: str


def assign_use_cases(team_ids: list[int], use_cases: list[UseCase]) -> dict[int, UseCase]:
    if len(use_cases) < len(team_ids):
        raise ValueError("There must be at least one use case per team")

    shuffled = use_cases[:]
    random.shuffle(shuffled)

    return {
        team_id: shuffled[index]
        for index, team_id in enumerate(team_ids)
    }
```

### Snake Draft

```ts
type Participant = {
  id: number;
  name: string;
  aiLevel: number;
};

type Team = {
  name: string;
  members: Participant[];
  totalScore: number;
  averageScore: number;
};

export function generateSnakeDraftTeams(
  participants: Participant[],
  numberOfTeams: number
): Team[] {
  if (numberOfTeams < 1) {
    throw new Error("numberOfTeams must be greater than 0");
  }

  if (participants.length < numberOfTeams) {
    throw new Error("There must be at least one participant per team");
  }

  const sorted = [...participants].sort((a, b) => b.aiLevel - a.aiLevel);

  const teams: Team[] = Array.from({ length: numberOfTeams }, (_, index) => ({
    name: `Equipo ${String.fromCharCode(65 + index)}`,
    members: [],
    totalScore: 0,
    averageScore: 0,
  }));

  let direction = 1;
  let teamIndex = 0;

  for (const participant of sorted) {
    teams[teamIndex].members.push(participant);

    if (teamIndex === numberOfTeams - 1 && direction === 1) {
      direction = -1;
    } else if (teamIndex === 0 && direction === -1) {
      direction = 1;
    } else {
      teamIndex += direction;
    }
  }

  return teams.map((team) => {
    const totalScore = team.members.reduce((sum, member) => sum + member.aiLevel, 0);
    const averageScore = totalScore / team.members.length;

    return {
      ...team,
      totalScore,
      averageScore: Number(averageScore.toFixed(2)),
    };
  });
}
```

### Random Use Case Assignment

```ts
type UseCase = {
  id: number;
  title: string;
};

type UseCaseAssignment = {
  teamName: string;
  useCase: UseCase;
};

export function assignUseCases(
  teams: Team[],
  useCases: UseCase[]
): UseCaseAssignment[] {
  if (useCases.length < teams.length) {
    throw new Error("There must be at least one use case per team");
  }

  const shuffled = [...useCases].sort(() => Math.random() - 0.5);

  return teams.map((team, index) => ({
    teamName: team.name,
    useCase: shuffled[index],
  }));
}
```
