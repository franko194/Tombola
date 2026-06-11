import type { Assignment, Participant, Results, Session, SessionStatus, Team, TeamInsights, TeamsResponse, UseCase } from "../types";

type Store = {
  nextId: number;
  sessions: Session[];
  participants: Participant[];
  useCases: UseCase[];
  teamsBySession: Record<string, Team[]>;
  assignmentsBySession: Record<string, Assignment[]>;
  snapshotsBySession: Record<string, Results>;
};

const STORAGE_KEY = "ia-friday-tombola-local-store-v1";

function now() {
  return new Date().toISOString();
}

function createStore(): Store {
  return {
    nextId: 1,
    sessions: [],
    participants: [],
    useCases: [],
    teamsBySession: {},
    assignmentsBySession: {},
    snapshotsBySession: {},
  };
}

function readStore(): Store {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return createStore();
  return { ...createStore(), ...JSON.parse(raw) };
}

function writeStore(store: Store) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function withStore<T>(callback: (store: Store) => T): T {
  const store = readStore();
  const result = callback(store);
  writeStore(store);
  return result;
}

function nextId(store: Store) {
  const id = store.nextId;
  store.nextId += 1;
  return id;
}

function getSession(store: Store, sessionId: number) {
  const session = store.sessions.find((item) => item.id === sessionId);
  if (!session) throw new Error("Session not found");
  return session;
}

function updateSessionStatus(store: Store, sessionId: number, status: SessionStatus) {
  const session = getSession(store, sessionId);
  session.status = status;
  session.updated_at = now();
  return session;
}

function buildBalance(teams: Team[]) {
  const averages = teams.map((team) => team.average_ai_level);
  const highest_average = averages.length ? Math.max(...averages) : 0;
  const lowest_average = averages.length ? Math.min(...averages) : 0;
  return {
    highest_average,
    lowest_average,
    average_gap: Number((highest_average - lowest_average).toFixed(4)),
  };
}

function buildLocalTeamInsights(teamsResponse: TeamsResponse): TeamInsights {
  const balance = teamsResponse.balance;
  const teamSummary = teamsResponse.teams
    .map((team) => `${team.name}: promedio ${team.average_ai_level}, score ${team.total_ai_score}`)
    .join("; ");
  return {
    summary:
      balance.average_gap <= 0.5
        ? `Los equipos quedaron muy equilibrados: la brecha entre el promedio mas alto y mas bajo es ${balance.average_gap}.`
        : `Los equipos estan distribuidos con una brecha de promedio de ${balance.average_gap}; conviene reforzar colaboracion entre perfiles avanzados y principiantes.`,
    strengths: [
      "La distribucion combina niveles altos y bajos para evitar concentrar expertos.",
      "Los equipos mantienen tamanos comparables y scores faciles de revisar.",
      "El promedio por equipo permite explicar rapidamente la equidad del sorteo.",
    ],
    recommendations: [
      "Pide a los perfiles avanzados que faciliten decisiones tecnicas dentro de su equipo.",
      "Usa la brecha de promedio como senal para ajustar manualmente solo si el contexto lo requiere.",
      `Resumen operativo: ${teamSummary}.`,
    ],
    generated_by: "local",
  };
}

function recalculateTeam(team: Team) {
  team.total_ai_score = team.members.reduce((total, member) => total + member.ai_level, 0);
  team.average_ai_level = team.members.length ? Number((team.total_ai_score / team.members.length).toFixed(2)) : 0;
}

function averageGap(teams: Team[]) {
  return buildBalance(teams).average_gap;
}

function improveAverageBalanceWithSwaps(teams: Team[]) {
  let improved = true;
  while (improved) {
    improved = false;
    let currentGap = averageGap(teams);

    for (let leftIndex = 0; leftIndex < teams.length && !improved; leftIndex += 1) {
      const leftTeam = teams[leftIndex];
      for (let rightIndex = leftIndex + 1; rightIndex < teams.length && !improved; rightIndex += 1) {
        const rightTeam = teams[rightIndex];
        for (let leftMemberIndex = 0; leftMemberIndex < leftTeam.members.length && !improved; leftMemberIndex += 1) {
          for (let rightMemberIndex = 0; rightMemberIndex < rightTeam.members.length; rightMemberIndex += 1) {
            const leftMember = leftTeam.members[leftMemberIndex];
            const rightMember = rightTeam.members[rightMemberIndex];
            if (leftMember.ai_level === rightMember.ai_level) continue;

            leftTeam.members[leftMemberIndex] = rightMember;
            rightTeam.members[rightMemberIndex] = leftMember;
            recalculateTeam(leftTeam);
            recalculateTeam(rightTeam);

            const nextGap = averageGap(teams);
            if (nextGap < currentGap) {
              currentGap = nextGap;
              improved = true;
              break;
            }

            leftTeam.members[leftMemberIndex] = leftMember;
            rightTeam.members[rightMemberIndex] = rightMember;
            recalculateTeam(leftTeam);
            recalculateTeam(rightTeam);
          }
        }
      }
    }
  }
}

function generateBalancedTeams(store: Store, sessionId: number, numberOfTeams: number): TeamsResponse {
  if (numberOfTeams < 1) throw new Error("number_of_teams must be greater than 0");

  const participants = store.participants.filter((item) => item.session_id === sessionId);
  if (participants.length < numberOfTeams) throw new Error("There must be at least one participant per team");

  const sortedParticipants = [...participants].sort((left, right) => right.ai_level - left.ai_level);
  const maxTeamSize = Math.ceil(participants.length / numberOfTeams);
  const teams: Team[] = Array.from({ length: numberOfTeams }, (_, index) => ({
    id: nextId(store),
    name: `Equipo ${String.fromCharCode(65 + index)}`,
    average_ai_level: 0,
    total_ai_score: 0,
    members: [],
  }));

  for (const participant of sortedParticipants) {
    const availableTeams = teams.filter((team) => team.members.length < maxTeamSize);
    const targetTeam = availableTeams.sort(
      (left, right) =>
        left.total_ai_score - right.total_ai_score ||
        left.members.length - right.members.length ||
        left.name.localeCompare(right.name),
    )[0];
    targetTeam.members.push({ id: participant.id, name: participant.name, ai_level: participant.ai_level });
    recalculateTeam(targetTeam);
  }

  improveAverageBalanceWithSwaps(teams);
  store.teamsBySession[String(sessionId)] = teams;
  store.assignmentsBySession[String(sessionId)] = [];
  delete store.snapshotsBySession[String(sessionId)];
  updateSessionStatus(store, sessionId, "teams_generated");
  return { teams, balance: buildBalance(teams) };
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

function assignUseCases(store: Store, sessionId: number) {
  const teams = store.teamsBySession[String(sessionId)] ?? [];
  if (!teams.length) throw new Error("Generate teams before assigning use cases");

  const useCases = store.useCases.filter((item) => item.session_id === sessionId);
  if (!useCases.length) throw new Error("There must be at least one use case");

  const assignedAt = now();
  const assignments: Assignment[] = [];
  let available: UseCase[] = [];

  for (const team of teams) {
    if (!available.length) available = shuffle(useCases);
    const useCase = available.shift() as UseCase;
    assignments.push({
      id: nextId(store),
      team_id: team.id,
      use_case_id: useCase.id,
      assigned_at: assignedAt,
      team_name: team.name,
      use_case_title: useCase.title,
      use_case_description: useCase.description,
    });
  }

  store.assignmentsBySession[String(sessionId)] = assignments;
  delete store.snapshotsBySession[String(sessionId)];
  updateSessionStatus(store, sessionId, "cases_assigned");
  return assignments;
}

function getResultsFromStore(store: Store, sessionId: number): Results {
  const snapshot = store.snapshotsBySession[String(sessionId)];
  if (snapshot) return snapshot;
  const session = getSession(store, sessionId);
  return {
    session,
    teams: store.teamsBySession[String(sessionId)] ?? [],
    assignments: store.assignmentsBySession[String(sessionId)] ?? [],
  };
}

async function parseParticipantFile(file: File) {
  const text = await file.text();
  const rows = text
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);
  const [, ...dataRows] = rows;
  return dataRows.map((row) => {
    const [name, level] = row.split(",").map((value) => value.trim());
    const aiLevel = Number(level);
    if (!name || Number.isNaN(aiLevel) || aiLevel < 0 || aiLevel > 5) {
      throw new Error("El archivo contiene filas invalidas. Usa columnas nombre,nivelIA.");
    }
    return { name, ai_level: aiLevel };
  });
}

export const localResources = {
  sessions: {
    list: () =>
      Promise.resolve(
        withStore((store) =>
          store.sessions
            .filter((session) => session.status !== "archived")
            .sort((left, right) => right.date.localeCompare(left.date) || right.id - left.id),
        ),
      ),
    create: (payload: { name: string; date: string }) =>
      Promise.resolve(
        withStore((store) => {
          const session: Session = {
            id: nextId(store),
            name: payload.name.trim(),
            date: payload.date,
            status: "draft",
            created_at: now(),
            updated_at: now(),
          };
          store.sessions.push(session);
          return session;
        }),
      ),
    update: (id: number, payload: Partial<Pick<Session, "name" | "date" | "status">>) =>
      Promise.resolve(
        withStore((store) => {
          const session = getSession(store, id);
          Object.assign(session, payload, { updated_at: now() });
          return session;
        }),
      ),
    reopen: (id: number) => Promise.resolve(withStore((store) => updateSessionStatus(store, id, "cases_assigned"))),
    remove: (id: number) =>
      Promise.resolve(
        withStore((store) => {
          store.sessions = store.sessions.filter((session) => session.id !== id);
          store.participants = store.participants.filter((participant) => participant.session_id !== id);
          store.useCases = store.useCases.filter((useCase) => useCase.session_id !== id);
          delete store.teamsBySession[String(id)];
          delete store.assignmentsBySession[String(id)];
          delete store.snapshotsBySession[String(id)];
          return { ok: true };
        }),
      ),
    archive: (id: number) => Promise.resolve(withStore((store) => updateSessionStatus(store, id, "archived"))),
    duplicate: (id: number, payload: { name: string; date: string }) =>
      Promise.resolve(
        withStore((store) => {
          const source = getSession(store, id);
          const duplicated: Session = {
            ...source,
            id: nextId(store),
            name: payload.name.trim(),
            date: payload.date,
            status: "draft",
            created_at: now(),
            updated_at: now(),
          };
          store.sessions.push(duplicated);
          for (const participant of store.participants.filter((item) => item.session_id === id)) {
            store.participants.push({ ...participant, id: nextId(store), session_id: duplicated.id });
          }
          for (const useCase of store.useCases.filter((item) => item.session_id === id)) {
            store.useCases.push({ ...useCase, id: nextId(store), session_id: duplicated.id });
          }
          return duplicated;
        }),
      ),
    complete: (id: number) =>
      Promise.resolve(
        withStore((store) => {
          updateSessionStatus(store, id, "completed");
          const snapshot = JSON.parse(JSON.stringify(getResultsFromStore(store, id))) as Results;
          snapshot.session = getSession(store, id);
          store.snapshotsBySession[String(id)] = snapshot;
          return snapshot;
        }),
      ),
  },
  participants: {
    list: (sessionId: number) =>
      Promise.resolve(withStore((store) => store.participants.filter((item) => item.session_id === sessionId))),
    create: (sessionId: number, payload: { name: string; ai_level: number }) =>
      Promise.resolve(
        withStore((store) => {
          const participant = { id: nextId(store), session_id: sessionId, ...payload };
          store.participants.push(participant);
          delete store.teamsBySession[String(sessionId)];
          delete store.assignmentsBySession[String(sessionId)];
          delete store.snapshotsBySession[String(sessionId)];
          return participant;
        }),
      ),
    update: (id: number, payload: { name?: string; ai_level?: number }) =>
      Promise.resolve(
        withStore((store) => {
          const participant = store.participants.find((item) => item.id === id);
          if (!participant) throw new Error("Participant not found");
          Object.assign(participant, payload);
          delete store.teamsBySession[String(participant.session_id)];
          delete store.assignmentsBySession[String(participant.session_id)];
          delete store.snapshotsBySession[String(participant.session_id)];
          return participant;
        }),
      ),
    remove: (id: number) =>
      Promise.resolve(
        withStore((store) => {
          const participant = store.participants.find((item) => item.id === id);
          store.participants = store.participants.filter((item) => item.id !== id);
          if (participant) {
            delete store.teamsBySession[String(participant.session_id)];
            delete store.assignmentsBySession[String(participant.session_id)];
            delete store.snapshotsBySession[String(participant.session_id)];
          }
          return { ok: true };
        }),
      ),
    import: async (sessionId: number, file: File) => {
      const rows = await parseParticipantFile(file);
      return withStore((store) => {
        const imported = rows.map((row) => ({ id: nextId(store), session_id: sessionId, ...row }));
        store.participants.push(...imported);
        delete store.teamsBySession[String(sessionId)];
        delete store.assignmentsBySession[String(sessionId)];
        delete store.snapshotsBySession[String(sessionId)];
        return imported;
      });
    },
  },
  useCases: {
    list: (sessionId: number) =>
      Promise.resolve(withStore((store) => store.useCases.filter((item) => item.session_id === sessionId))),
    create: (sessionId: number, payload: { title: string; description?: string }) =>
      Promise.resolve(
        withStore((store) => {
          const useCase = { id: nextId(store), session_id: sessionId, description: null, ...payload };
          store.useCases.push(useCase);
          delete store.assignmentsBySession[String(sessionId)];
          delete store.snapshotsBySession[String(sessionId)];
          return useCase;
        }),
      ),
    update: (id: number, payload: { title?: string; description?: string }) =>
      Promise.resolve(
        withStore((store) => {
          const useCase = store.useCases.find((item) => item.id === id);
          if (!useCase) throw new Error("Use case not found");
          Object.assign(useCase, payload);
          delete store.assignmentsBySession[String(useCase.session_id)];
          delete store.snapshotsBySession[String(useCase.session_id)];
          return useCase;
        }),
      ),
    remove: (id: number) =>
      Promise.resolve(
        withStore((store) => {
          const useCase = store.useCases.find((item) => item.id === id);
          store.useCases = store.useCases.filter((item) => item.id !== id);
          if (useCase) {
            delete store.assignmentsBySession[String(useCase.session_id)];
            delete store.snapshotsBySession[String(useCase.session_id)];
          }
          return { ok: true };
        }),
      ),
  },
  teams: {
    list: (sessionId: number) =>
      Promise.resolve(
        withStore((store) => {
          const teams = store.teamsBySession[String(sessionId)] ?? [];
          return { teams, balance: buildBalance(teams) };
        }),
      ),
    generate: (sessionId: number, numberOfTeams: number) =>
      Promise.resolve(withStore((store) => generateBalancedTeams(store, sessionId, numberOfTeams))),
    insights: (sessionId: number) =>
      Promise.resolve(
        withStore((store) => {
          const teams = store.teamsBySession[String(sessionId)] ?? [];
          if (!teams.length) throw new Error("Generate teams before requesting insights");
          return buildLocalTeamInsights({ teams, balance: buildBalance(teams) });
        }),
      ),
  },
  results: {
    assign: (sessionId: number) => Promise.resolve(withStore((store) => assignUseCases(store, sessionId))),
    get: (sessionId: number) => Promise.resolve(withStore((store) => getResultsFromStore(store, sessionId))),
  },
};
