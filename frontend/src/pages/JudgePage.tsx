import { CheckCircle2, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { resources } from "../api/resources";
import type { Judge, JudgeScore, PublicEvaluation, Team } from "../types";

type ScoreDraft = Record<string, number>;

const scoreLabels: Record<number, string> = {
  1: "Very Bad",
  2: "Insufficient",
  3: "Acceptable",
  4: "Good",
  5: "Very Good",
};

export function JudgePage({ token }: { token: string }) {
  const [evaluation, setEvaluation] = useState<PublicEvaluation | null>(null);
  const [judge, setJudge] = useState<Judge | null>(null);
  const [scores, setScores] = useState<JudgeScore[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [draft, setDraft] = useState<ScoreDraft>({});
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [savedTeamName, setSavedTeamName] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  async function load() {
    const data = await resources.evaluation.publicGet(token);
    setEvaluation(data);
    setSelectedTeamId(data.teams[0]?.id ?? null);
  }

  useEffect(() => {
    void load().catch((err) => setError((err as Error).message));
  }, [token]);

  useEffect(() => {
    if (!judge) return;
    void resources.evaluation.scores(token, judge.id).then(setScores).catch((err) => setError((err as Error).message));
  }, [judge?.id, token]);

  const selectedTeam = useMemo(() => evaluation?.teams.find((team) => team.id === selectedTeamId) ?? null, [evaluation?.teams, selectedTeamId]);
  const assignmentByTeam = useMemo(() => new Map(evaluation?.assignments.map((item) => [item.team_id, item]) ?? []), [evaluation?.assignments]);

  useEffect(() => {
    if (!evaluation || !selectedTeamId) return;
    const nextDraft: ScoreDraft = {};
    for (const criterion of evaluation.criteria) {
      const existing = scores.find((score) => score.team_id === selectedTeamId && score.criterion_id === criterion.id);
      nextDraft[String(criterion.id)] = existing?.score ?? 3;
      if (existing?.comment) setComment(existing.comment);
    }
    setDraft(nextDraft);
    setSaved(false);
    setSavedTeamName(null);
  }, [evaluation, selectedTeamId, scores]);

  useEffect(() => {
    if (!notification) return;
    const timeout = window.setTimeout(() => setNotification(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [notification]);

  async function identify(event: React.FormEvent) {
    event.preventDefault();
    try {
      setError("");
      setJudge(await resources.evaluation.identify(token, { name }));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!judge || !selectedTeamId || !evaluation) return;
    try {
      setError("");
      const submitted = await resources.evaluation.submitScores(token, {
        judge_id: judge.id,
        team_id: selectedTeamId,
        comment,
        scores: evaluation.criteria.map((criterion) => ({
          criterion_id: criterion.id,
          score: draft[String(criterion.id)] ?? 3,
        })),
      });
      setScores(submitted);
      setSaved(true);
      const teamName = selectedTeam?.name ?? null;
      setSavedTeamName(teamName);
      setNotification(teamName ? `Puntuaste correctamente al equipo "${teamName}".` : "Puntuación guardada correctamente.");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function teamVoted(team: Team) {
    if (!evaluation) return false;
    return evaluation.criteria.every((criterion) => scores.some((score) => score.team_id === team.id && score.criterion_id === criterion.id));
  }

  if (!evaluation) {
    return <div className="min-h-screen bg-[#eef3f8] p-5 font-bold text-slate-700">{error || "Cargando evaluacion..."}</div>;
  }

  return (
    <div className="min-h-screen bg-[#eef3f8]">
      <main className="mx-auto grid max-w-3xl gap-5 px-4 py-5">
        <section className="lab-surface rounded-lg p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">Jurado IA Friday</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">{evaluation.session.name}</h1>
          <p className="mt-1 font-semibold text-slate-500">{evaluation.session.date}</p>
          {evaluation.status === "prepared" ? (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 font-bold text-amber-800">
              La votacion aun no esta abierta, pero puedes registrarte como jurado de esta fecha.
            </p>
          ) : null}
          {evaluation.status === "closed" ? <p className="mt-3 rounded-lg bg-amber-50 p-3 font-bold text-amber-800">La evaluacion esta cerrada.</p> : null}
          {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 font-semibold text-red-700">{error}</p> : null}
        </section>

        {!judge ? (
          <form className="lab-surface grid gap-4 rounded-lg p-5" onSubmit={(event) => void identify(event)}>
            <h2 className="text-xl font-black text-slate-950">Identificate como jurado</h2>
            <input className="input" placeholder="Nombre" value={name} onChange={(event) => setName(event.target.value)} required />
            <button className="btn-primary" disabled={evaluation.status === "closed"}>
              Continuar
            </button>
          </form>
        ) : (
          evaluation.status === "prepared" ? (
            <section className="lab-surface rounded-lg p-5">
              <h2 className="text-xl font-black text-slate-950">Registro recibido</h2>
              <p className="mt-2 font-semibold text-slate-600">
                Gracias, {judge.name}. Ya quedaste registrado como jurado para esta sesion. Cuando el organizador abra la votacion, actualiza esta pagina para puntuar los equipos.
              </p>
            </section>
          ) : (
          <>
            <section className="lab-surface rounded-lg p-5">
              <h2 className="text-xl font-black text-slate-950">Equipos</h2>
              <div className="mt-3 grid gap-2">
                {evaluation.teams.map((team) => (
                  <button
                    key={team.id}
                    className={`flex items-center justify-between rounded-lg px-3 py-3 text-left font-bold ${
                      selectedTeamId === team.id ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-700"
                    }`}
                    onClick={() => setSelectedTeamId(team.id)}
                  >
                    <span>{team.name}</span>
                    {teamVoted(team) ? <CheckCircle2 size={18} className="text-teal-400" /> : null}
                  </button>
                ))}
              </div>
            </section>

            {selectedTeam ? (
              <form className="lab-surface grid gap-4 rounded-lg p-5" onSubmit={(event) => void submit(event)}>
                <div>
                  <h2 className="text-2xl font-black text-slate-950">{selectedTeam.name}</h2>
                  <p className="font-semibold text-slate-500">
                    Caso: {assignmentByTeam.get(selectedTeam.id)?.use_case_title ?? "Sin caso asignado"}
                  </p>
                </div>
                {evaluation.criteria.map((criterion) => (
                  <label key={criterion.id} className="grid gap-2 font-bold text-slate-700">
                    <span className="flex items-center justify-between">
                      {criterion.name}
                      <strong className="text-teal-800">
                        {draft[String(criterion.id)] ?? 3} - {scoreLabels[draft[String(criterion.id)] ?? 3]}
                      </strong>
                    </span>
                    <input
                      type="range"
                      min={1}
                      max={criterion.max_score}
                      value={draft[String(criterion.id)] ?? 3}
                      onChange={(event) => setDraft((current) => ({ ...current, [String(criterion.id)]: Number(event.target.value) }))}
                    />
                    <div className="grid grid-cols-5 gap-1 text-center text-[11px] font-black uppercase tracking-[0.04em] text-slate-400">
                      <span>1 Very Bad</span>
                      <span>2 Insufficient</span>
                      <span>3 Acceptable</span>
                      <span>4 Good</span>
                      <span>5 Very Good</span>
                    </div>
                  </label>
                ))}
                <textarea className="input min-h-24" placeholder="Comentario opcional" value={comment} onChange={(event) => setComment(event.target.value)} />
                <button className="btn-primary" disabled={evaluation.status !== "open"}>
                  <Send size={18} />
                  Guardar puntuacion
                </button>
                {saved ? (
                  <p className="rounded-lg bg-teal-50 p-3 font-bold text-teal-800">
                    Puntuaste correctamente al equipo {savedTeamName ? `"${savedTeamName}".` : ""}
                  </p>
                ) : null}
              </form>
            ) : null}
          </>
          )
        )}
      </main>
      {notification ? (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:bottom-6">
          <div className="w-full max-w-lg rounded-3xl border border-teal-100 bg-white/95 px-4 py-3 shadow-2xl shadow-teal-200/30 backdrop-blur-xl ring-1 ring-slate-200 sm:px-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-teal-600 text-white shadow-lg shadow-teal-500/20">
                <CheckCircle2 size={20} />
              </span>
              <p className="text-sm font-semibold leading-6 text-slate-900">{notification}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
