import type { SessionStatus } from "../types";

const labels: Record<SessionStatus, string> = {
  draft: "Borrador",
  teams_generated: "Equipos listos",
  cases_assigned: "Casos asignados",
  completed: "Completada",
  archived: "Archivada",
};

const tones: Record<SessionStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  teams_generated: "bg-blue-100 text-blue-800",
  cases_assigned: "bg-teal-100 text-teal-800",
  completed: "bg-emerald-100 text-emerald-800",
  archived: "bg-slate-200 text-slate-700",
};

export function StatusBadge({ status }: { status: SessionStatus }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${tones[status]}`}>{labels[status]}</span>;
}
