import { api } from "./client";
import { localResources } from "./localResources";
import type {
  Assignment,
  Evaluation,
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

const useLocalResources = import.meta.env.VITE_DATA_MODE === "local";

const apiResources = {
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
    insights: (sessionId: number) => api<TeamInsights>(`/sessions/${sessionId}/teams/insights`, { method: "POST" }),
  },
  results: {
    assign: (sessionId: number) =>
      api<Assignment[]>(`/sessions/${sessionId}/use-cases/assign`, { method: "POST", json: { mode: "random" } }),
    get: (sessionId: number) => api<Results>(`/sessions/${sessionId}/results`),
  },
  evaluation: {
    open: (sessionId: number) => api<Evaluation>(`/sessions/${sessionId}/evaluation/open`, { method: "POST" }),
    close: (sessionId: number) => api<Evaluation>(`/sessions/${sessionId}/evaluation/close`, { method: "POST" }),
    get: (sessionId: number) => api<Evaluation>(`/sessions/${sessionId}/evaluation`),
    publicGet: (token: string) => api<PublicEvaluation>(`/judge/${token}`),
    identify: (token: string, payload: { name: string; email: string; organization?: string }) =>
      api<Judge>(`/judge/${token}/identify`, { method: "POST", json: payload }),
    scores: (token: string, judgeId: number) => api<JudgeScore[]>(`/judge/${token}/scores?judge_id=${judgeId}`),
    submitScores: (
      token: string,
      payload: { judge_id: number; team_id: number; scores: Array<{ criterion_id: number; score: number }>; comment?: string },
    ) => api<JudgeScore[]>(`/judge/${token}/scores`, { method: "POST", json: payload }),
  },
};

export const resources = useLocalResources ? localResources : apiResources;
