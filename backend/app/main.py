from contextlib import asynccontextmanager
import os

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import require_organizer
from app.database import check_database, init_db
from app.routers import ai, auth, clients, evaluation, organizers, participants, results, sessions, teams, usecases


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="IA Friday Tombola API", lifespan=lifespan)

allowed_origins = [
    origin.strip()
    for origin in os.environ.get(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/db")
def database_health() -> dict[str, str]:
    return check_database()


# Every organizer route requires a logged-in organizer. Only login and judge routes are public.
organizer = [Depends(require_organizer)]

app.include_router(auth.router)
app.include_router(sessions.router, dependencies=organizer)
app.include_router(participants.router, dependencies=organizer)
app.include_router(usecases.router, dependencies=organizer)
app.include_router(teams.router, dependencies=organizer)
app.include_router(results.router, dependencies=organizer)
app.include_router(ai.router, dependencies=organizer)
app.include_router(evaluation.router, dependencies=organizer)
app.include_router(clients.router, dependencies=organizer)
app.include_router(organizers.router)
app.include_router(evaluation.public_router)
