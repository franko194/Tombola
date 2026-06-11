import { BarChart3, ClipboardList, Sparkles, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { resources } from "../api/resources";
import { MetricCard } from "../components/MetricCard";
import type { PageKey, Participant, Session, Team, UseCase } from "../types";

export function DashboardPage({ session, onPageChange }: { session: Session; onPageChange: (page: PageKey) => void }) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [useCases, setUseCases] = useState<UseCase[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    void Promise.all([
      resources.participants.list(session.id).then(setParticipants),
      resources.useCases.list(session.id).then(setUseCases),
      resources.teams.list(session.id).then((data) => setTeams(data.teams)),
    ]);
  }, [session.id]);

  const next =
    participants.length < 2
      ? { label: "Agregar participantes", page: "participants" as PageKey }
      : useCases.length < 1
        ? { label: "Cargar casos", page: "usecases" as PageKey }
        : teams.length < 1
          ? { label: "Generar equipos", page: "teams" as PageKey }
          : session.status === "cases_assigned"
            ? { label: "Ver resultados", page: "results" as PageKey }
            : { label: "Iniciar tombola", page: "tombola" as PageKey };

  return (
    <section className="grid gap-5">
      <div className="lab-surface rounded-lg p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">Panel del organizador</p>
        <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-black text-slate-950">Preparacion de la sesion</h2>
            <p className="mt-2 max-w-2xl font-medium text-slate-600">
              Sigue el flujo de izquierda a derecha: participantes, casos, equipos, tombola y resultados.
            </p>
          </div>
          <button className="btn-primary" onClick={() => onPageChange(next.page)}>
            <Sparkles size={18} />
            {next.label}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Participantes" value={participants.length} icon={<Users size={24} />} />
        <MetricCard label="Casos de uso" value={useCases.length} icon={<ClipboardList size={24} />} />
        <MetricCard label="Equipos" value={teams.length} icon={<BarChart3 size={24} />} />
      </div>
    </section>
  );
}
