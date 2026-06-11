import { CheckCircle, Presentation, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { resources } from "../api/resources";
import type { Assignment, Results, Session } from "../types";

export function ResultsPage({
  session,
  onSessionUpdate,
  onReturnHome,
}: {
  session: Session;
  onSessionUpdate: (session: Session) => void;
  onReturnHome: () => void;
}) {
  const [results, setResults] = useState<Results | null>(null);

  async function load() {
    setResults(await resources.results.get(session.id));
  }

  useEffect(() => {
    void load();
  }, [session.id]);

  async function complete() {
    const participantsCount = results?.teams.flatMap((team) => team.members).length ?? 0;
    const message = [
      "Completar sesion?",
      "",
      `Equipos: ${results?.teams.length ?? 0}`,
      `Participantes: ${participantsCount}`,
      `Casos asignados: ${results?.assignments.length ?? 0}`,
      "",
      "Se guardara un snapshot historico de estos resultados.",
    ].join("\n");
    if (!confirm(message)) return;
    await resources.sessions.complete(session.id);
    onReturnHome();
  }

  async function reopen() {
    const updated = await resources.sessions.reopen(session.id);
    onSessionUpdate(updated);
  }

  function assignmentFor(teamId: number): Assignment | undefined {
    return results?.assignments.find((item) => item.team_id === teamId);
  }

  if (!results) {
    return <div className="lab-surface rounded-lg p-6 font-bold text-slate-600">Cargando resultados...</div>;
  }

  if (!results.teams.length) {
    return (
      <section className="grid gap-5">
        <div className="lab-surface rounded-lg p-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">Vista para pantalla</p>
          <h2 className="mt-2 text-3xl font-black text-slate-950">Resultados IA Friday</h2>
          <p className="mt-2 font-semibold text-slate-600">Esta sesion no tiene equipos, participantes o casos guardados para mostrar.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-5">
      <div className="lab-surface rounded-lg p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">Vista para pantalla</p>
            <h2 className="mt-2 text-3xl font-black text-slate-950">Resultados IA Friday</h2>
            <p className="mt-1 font-semibold text-slate-500">{results.session.date}</p>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={reopen}>
              <RotateCcw size={18} />
              Reabrir
            </button>
            <button className="btn-primary" onClick={complete}>
              <CheckCircle size={18} />
              Completar
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {results.teams.map((team) => {
          const assignment = assignmentFor(team.id);
          return (
            <article key={team.id} className="lab-surface rounded-lg p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.14em] text-blue-700">{team.name}</p>
                  <h3 className="mt-1 text-2xl font-black text-slate-950">{assignment?.use_case_title ?? "Sin caso asignado"}</h3>
                </div>
                <Presentation className="text-teal-700" />
              </div>
              {assignment?.use_case_description ? <p className="mt-3 font-medium text-slate-600">{assignment.use_case_description}</p> : null}
              <div className="mt-5 grid gap-3 md:grid-cols-[1fr_140px]">
                <ul className="grid gap-2">
                  {team.members.map((member) => (
                    <li key={member.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                      <span className="font-bold text-slate-800">{member.name}</span>
                      <span className="font-black text-teal-800">{member.ai_level}</span>
                    </li>
                  ))}
                </ul>
                <div className="rounded-lg bg-slate-900 p-4 text-white">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-300">Promedio</p>
                  <p className="text-4xl font-black">{team.average_ai_level}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-300">Score {team.total_ai_score}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
