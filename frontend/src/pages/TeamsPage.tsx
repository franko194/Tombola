import { RefreshCw, Save, Sparkles, Users } from "lucide-react";
import { useEffect, useState, type PointerEvent } from "react";
import { resources } from "../api/resources";
import type { Session, Team, TeamInsights, TeamsResponse } from "../types";

function sourceLabel(source: string) {
  if (source === "cloud") return "IA Cloud";
  if (source === "local") return "analisis local";
  return source;
}

function buildBalance(teams: Team[]) {
  const averages = teams.map((team) => team.average_ai_level);
  const highest_average = averages.length ? Math.max(...averages) : 0;
  const lowest_average = averages.length ? Math.min(...averages) : 0;
  return {
    highest_average,
    lowest_average,
    average_gap: Number((highest_average - lowest_average).toFixed(2)),
  };
}

function recalculateTeam(team: Team): Team {
  const total_ai_score = team.members.reduce((total, member) => total + member.ai_level, 0);
  return {
    ...team,
    total_ai_score,
    average_ai_level: team.members.length ? Number((total_ai_score / team.members.length).toFixed(2)) : 0,
  };
}

export function TeamsPage({ session }: { session: Session }) {
  const [numberOfTeams, setNumberOfTeams] = useState(3);
  const [data, setData] = useState<TeamsResponse | null>(null);
  const [insights, setInsights] = useState<TeamInsights | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [savingTeams, setSavingTeams] = useState(false);
  const [teamsDirty, setTeamsDirty] = useState(false);
  const [draggingMember, setDraggingMember] = useState<{ memberId: number; sourceTeamId: number } | null>(null);
  const [dropTeamId, setDropTeamId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setData(await resources.teams.list(session.id));
  }

  useEffect(() => {
    void load();
  }, [session.id]);

  async function generate() {
    try {
      const hasTeams = Boolean(data?.teams.length);
      if (hasTeams || teamsDirty) {
        const confirmed = window.confirm(
          "Regenerar equipos reemplazara la distribucion actual y limpiara las asignaciones de casos. Quieres continuar?",
        );
        if (!confirmed) return;
      }
      setError("");
      setData(await resources.teams.generate(session.id, numberOfTeams));
      setInsights(null);
      setTeamsDirty(false);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function moveMember(memberId: number, sourceTeamId: number, targetTeamId: number) {
    if (!data || sourceTeamId === targetTeamId) return;
    const sourceTeam = data.teams.find((team) => team.id === sourceTeamId);
    const member = sourceTeam?.members.find((item) => item.id === memberId);
    if (!sourceTeam || !member) return;

    const teams = data.teams.map((team) => {
      if (team.id === sourceTeamId) {
        return recalculateTeam({ ...team, members: team.members.filter((item) => item.id !== memberId) });
      }
      if (team.id === targetTeamId) {
        return recalculateTeam({ ...team, members: [...team.members, member] });
      }
      return team;
    });

    setData({ teams, balance: buildBalance(teams) });
    setInsights(null);
    setTeamsDirty(true);
  }

  function startDragging(event: PointerEvent<HTMLLIElement>, memberId: number, sourceTeamId: number) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingMember({ memberId, sourceTeamId });
  }

  function dragOverTeam(event: PointerEvent<HTMLLIElement>) {
    if (!draggingMember) return;
    event.preventDefault();
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const target = element?.closest<HTMLElement>("[data-team-drop-zone]");
    const targetTeamId = Number(target?.dataset.teamId);
    setDropTeamId(targetTeamId && targetTeamId !== draggingMember.sourceTeamId ? targetTeamId : null);
  }

  function finishDragging(event: PointerEvent<HTMLLIElement>) {
    if (!draggingMember) return;
    event.preventDefault();
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const target = element?.closest<HTMLElement>("[data-team-drop-zone]");
    const targetTeamId = Number(target?.dataset.teamId);
    if (targetTeamId) {
      moveMember(draggingMember.memberId, draggingMember.sourceTeamId, targetTeamId);
    }
    stopDragging();
  }

  function stopDragging() {
    setDraggingMember(null);
    setDropTeamId(null);
  }

  async function saveManualTeams() {
    if (!data) return;
    try {
      setError("");
      setSavingTeams(true);
      const saved = await resources.teams.updateManual(session.id, {
        teams: data.teams.map((team) => ({
          team_id: team.id,
          participant_ids: team.members.map((member) => member.id),
        })),
      });
      setData(saved);
      setTeamsDirty(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingTeams(false);
    }
  }

  async function generateInsights() {
    try {
      setError("");
      setLoadingInsights(true);
      setInsights(await resources.teams.insights(session.id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingInsights(false);
    }
  }

  return (
    <section className="grid gap-5">
      <div className="lab-surface rounded-lg p-5">
        <h2 className="text-2xl font-black text-slate-950">Generacion de equipos</h2>
        <p className="mt-1 font-medium text-slate-600">Snake Draft balancea la experiencia para evitar concentrar expertos o principiantes.</p>
        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-end">
          <label className="grid gap-2 text-sm font-bold text-slate-600">
            Numero de equipos
            <input className="input w-48" type="number" min={1} value={numberOfTeams} onChange={(event) => setNumberOfTeams(Number(event.target.value))} />
          </label>
          <button className="btn-primary" onClick={generate}>
            <RefreshCw size={18} />
            {data?.teams.length ? "Regenerar equipos" : "Generar equipos"}
          </button>
        </div>
        {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 font-semibold text-red-700">{error}</p> : null}
      </div>

      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="lab-surface rounded-lg p-4">
              <p className="text-sm font-bold text-slate-500">Promedio mas alto</p>
              <p className="text-3xl font-black text-slate-950">{data.balance.highest_average}</p>
            </div>
            <div className="lab-surface rounded-lg p-4">
              <p className="text-sm font-bold text-slate-500">Promedio mas bajo</p>
              <p className="text-3xl font-black text-slate-950">{data.balance.lowest_average}</p>
            </div>
            <div className="lab-surface rounded-lg p-4">
              <p className="text-sm font-bold text-slate-500">Brecha</p>
              <p className="text-3xl font-black text-teal-800">{data.balance.average_gap}</p>
            </div>
          </div>
          <div className="lab-surface rounded-lg p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-950">Explicacion inteligente de balance</h3>
                <p className="mt-1 font-medium text-slate-600">Genera una lectura ejecutiva para explicar por que los equipos quedaron equilibrados.</p>
              </div>
              <button className="btn-secondary" onClick={() => void generateInsights()} disabled={loadingInsights || !data.teams.length}>
                <Sparkles size={18} />
                {loadingInsights ? "Generando..." : "Generar explicacion"}
              </button>
            </div>
            {insights ? (
              <div className="mt-4 grid gap-4">
                <p className="rounded-lg bg-teal-50 p-4 font-bold text-teal-950">{insights.summary}</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.12em] text-slate-500">Fortalezas</p>
                    <ul className="mt-2 grid gap-2">
                      {insights.strengths.map((item) => (
                        <li key={item} className="rounded-lg bg-slate-50 px-3 py-2 font-semibold text-slate-700">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.12em] text-slate-500">Recomendaciones</p>
                    <ul className="mt-2 grid gap-2">
                      {insights.recommendations.map((item) => (
                        <li key={item} className="rounded-lg bg-slate-50 px-3 py-2 font-semibold text-slate-700">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                  Fuente: {sourceLabel(insights.generated_by)}
                </p>
              </div>
            ) : null}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.teams.map((team) => (
              <div
                key={team.id}
                data-team-drop-zone
                data-team-id={team.id}
                className={`lab-surface rounded-lg p-5 transition ${
                  dropTeamId === team.id ? "border-teal-500 bg-teal-50/80 ring-2 ring-teal-200" : ""
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xl font-black text-slate-950">{team.name}</h3>
                  <Users className="text-teal-700" size={20} />
                </div>
                <p className="text-sm font-bold text-slate-500">Promedio {team.average_ai_level} | Score {team.total_ai_score}</p>
                <ul className="mt-4 grid min-h-12 gap-2">
                  {team.members.map((member) => (
                    <li
                      key={member.id}
                      className={`flex touch-none select-none items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 cursor-grab active:cursor-grabbing ${
                        draggingMember?.memberId === member.id ? "opacity-50 ring-2 ring-teal-300" : ""
                      }`}
                      onPointerDown={(event) => startDragging(event, member.id, team.id)}
                      onPointerMove={dragOverTeam}
                      onPointerUp={finishDragging}
                      onPointerCancel={stopDragging}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-bold text-slate-800">{member.name}</span>
                        <span className="text-sm font-black text-teal-800">{member.ai_level}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="lab-surface flex flex-col gap-3 rounded-lg p-4 md:flex-row md:items-center md:justify-between">
            <p className="font-semibold text-slate-600">
              {teamsDirty ? "Hay cambios manuales sin guardar. Al guardar se limpiaran las asignaciones de casos actuales." : "Puedes mover participantes entre equipos y guardar la distribucion manual."}
            </p>
            <button className="btn-primary" onClick={() => void saveManualTeams()} disabled={!teamsDirty || savingTeams}>
              <Save size={18} />
              {savingTeams ? "Guardando..." : "Guardar equipos"}
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
