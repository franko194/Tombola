import { api } from "./client";
import type { Assignment, Participant, Results, Session, TeamsResponse, UseCase } from "../types";

export const resources = {
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
  },
  results: {
    assign: (sessionId: number) =>
      api<Assignment[]>(`/sessions/${sessionId}/use-cases/assign`, { method: "POST", json: { mode: "random" } }),
    get: (sessionId: number) => api<Results>(`/sessions/${sessionId}/results`),
  },
};
