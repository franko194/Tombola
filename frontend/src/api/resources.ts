import { api } from "./client";
import type {
  Assignment,
  ClientVisit,
  ClientVisitInput,
  DrawHistory,
  Organizer,
  OrganizerCreateInput,
  OrganizerUpdateInput,
  Evaluation,
  EvaluationReport,
  Judge,
  JudgeScore,
  Participant,
  PublicEvaluation,
  Results,
  Session,
  TeamInsights,
  TeamsResponse,
  UseCase,
} from "../types";

export const resources = {
  auth: {
    me: () => api<{ email: string; is_admin: boolean }>("/auth/me"),
    login: (email: string, password: string) => api<{ email: string }>("/auth/login", { method: "POST", json: { email, password } }),
    logout: () => api<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  },
  organizers: {
    list: () => api<Organizer[]>("/organizers"),
    create: (input: OrganizerCreateInput) => api<Organizer>("/organizers", { method: "POST", json: input }),
    update: (id: number, input: OrganizerUpdateInput) => api<Organizer>(`/organizers/${id}`, { method: "PATCH", json: input }),
  },
  history: {
    list: (sessionId: number) => api<DrawHistory[]>(`/sessions/${sessionId}/draw-history`),
    updateNote: (sessionId: number, entryId: number, note: string) =>
      api<DrawHistory>(`/sessions/${sessionId}/draw-history/${entryId}`, { method: "PATCH", json: { note } }),
    remove: (sessionId: number, entryId: number) =>
      api<{ ok: boolean }>(`/sessions/${sessionId}/draw-history/${entryId}`, { method: "DELETE" }),
  },
  clients: {
    list: (month?: string) => api<ClientVisit[]>(month ? `/clients?month=${month}` : "/clients"),
    create: (payload: ClientVisitInput) => api<ClientVisit>("/clients", { method: "POST", json: payload }),
    update: (id: number, payload: Partial<ClientVisitInput>) => api<ClientVisit>(`/clients/${id}`, { method: "PATCH", json: payload }),
    remove: (id: number) => api<{ ok: boolean }>(`/clients/${id}`, { method: "DELETE" }),
  },
  sessions: {
    list: () => api<Session[]>("/sessions"),
    create: (payload: { name: string; date: string }) => api<Session>("/sessions", { method: "POST", json: payload }),
    update: (id: number, payload: Partial<Pick<Session, "name" | "date" | "status">>) =>
      api<Session>(`/sessions/${id}`, { method: "PATCH", json: payload }),
    reopen: (id: number) => api<Session>(`/sessions/${id}/reopen`, { method: "POST" }),
    remove: (id: number) => api<{ ok: boolean }>(`/sessions/${id}`, { method: "DELETE" }),
    archive: (id: number) => api<Session>(`/sessions/${id}/archive`, { method: "POST" }),
    duplicate: (id: number, payload: { name: string; date: string }) =>
      api<Session>(`/sessions/${id}/duplicate`, { method: "POST", json: payload }),
    complete: (id: number) => api<Results>(`/sessions/${id}/complete`, { method: "POST" }),
  },
  participants: {
    list: (sessionId: number) => api<Participant[]>(`/sessions/${sessionId}/participants`),
    create: (sessionId: number, payload: { name: string; ai_level: number }) =>
      api<Participant>(`/sessions/${sessionId}/participants`, { method: "POST", json: payload }),
    update: (id: number, payload: { name?: string; ai_level?: number }) =>
      api<Participant>(`/participants/${id}`, { method: "PATCH", json: payload }),
    remove: (id: number) => api<{ ok: boolean }>(`/participants/${id}`, { method: "DELETE" }),
    import: (sessionId: number, file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api<Participant[]>(`/sessions/${sessionId}/participants/import`, { method: "POST", body: form });
    },
  },
  useCases: {
    list: (sessionId: number) => api<UseCase[]>(`/sessions/${sessionId}/use-cases`),
    create: (sessionId: number, payload: { title: string; description?: string }) =>
      api<UseCase>(`/sessions/${sessionId}/use-cases`, { method: "POST", json: payload }),
    update: (id: number, payload: { title?: string; description?: string }) =>
      api<UseCase>(`/use-cases/${id}`, { method: "PATCH", json: payload }),
    remove: (id: number) => api<{ ok: boolean }>(`/use-cases/${id}`, { method: "DELETE" }),
  },
  teams: {
    list: (sessionId: number) => api<TeamsResponse>(`/sessions/${sessionId}/teams`),
    generate: (sessionId: number, number_of_teams: number) =>
      api<TeamsResponse>(`/sessions/${sessionId}/teams/generate`, { method: "POST", json: { number_of_teams } }),
    updateManual: (sessionId: number, payload: { teams: Array<{ team_id: number; participant_ids: number[] }> }) =>
      api<TeamsResponse>(`/sessions/${sessionId}/teams/manual`, { method: "PUT", json: payload }),
    insights: (sessionId: number) => api<TeamInsights>(`/sessions/${sessionId}/teams/insights`, { method: "POST" }),
  },
  results: {
    assign: (sessionId: number) =>
      api<Assignment[]>(`/sessions/${sessionId}/use-cases/assign`, { method: "POST", json: { mode: "random" } }),
    get: (sessionId: number) => api<Results>(`/sessions/${sessionId}/results`),
  },
  evaluation: {
    prepare: (sessionId: number) => api<Evaluation>(`/sessions/${sessionId}/evaluation/prepare`, { method: "POST" }),
    open: (sessionId: number) => api<Evaluation>(`/sessions/${sessionId}/evaluation/open`, { method: "POST" }),
    close: (sessionId: number) => api<Evaluation>(`/sessions/${sessionId}/evaluation/close`, { method: "POST" }),
    setRegistration: (sessionId: number, open: boolean) =>
      api<Evaluation>(`/sessions/${sessionId}/evaluation/registration`, { method: "POST", json: { open } }),
    get: (sessionId: number) => api<Evaluation>(`/sessions/${sessionId}/evaluation`),
    report: (sessionId: number) => api<EvaluationReport>(`/sessions/${sessionId}/evaluation/report`, { method: "POST" }),
    removeJudge: (sessionId: number, judgeId: number) =>
      api<Evaluation>(`/sessions/${sessionId}/evaluation/judges/${judgeId}`, { method: "DELETE" }),
    publicGet: (token: string) => api<PublicEvaluation>(`/judge/${token}`),
    identify: (token: string, payload: { name: string; confirm_existing?: boolean }) =>
      api<{ judge: Judge; vote_token: string }>(`/judge/${token}/identify`, { method: "POST", json: payload }),
    scores: (token: string, judgeId: number, voteToken: string) =>
      api<JudgeScore[]>(`/judge/${token}/scores?judge_id=${judgeId}`, { headers: { "X-Judge-Token": voteToken } }),
    submitScores: (
      token: string,
      voteToken: string,
      payload: { judge_id: number; team_id: number; scores: Array<{ criterion_id: number; score: number }>; comment?: string },
    ) => api<JudgeScore[]>(`/judge/${token}/scores`, { method: "POST", json: payload, headers: { "X-Judge-Token": voteToken } }),
  },
};
