import { CheckCircle2, Circle, Loader2, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../api/client";
import { resources } from "../api/resources";
import { criterionLabel, scoreLabels } from "../lib/scoring";
import type { Judge, JudgeScore, PublicEvaluation, Team } from "../types";

// Scores and comment a judge is editing for one team.
type TeamDraft = { scores: Record<number, number>; comment: string };

const REFRESH_MS = 8000;

// The judge's identity and vote token stay on this device, so votes can only be sent by the judge who identified here.
type StoredIdentity = { judge: Judge; voteToken: string };

function storageKey(token: string) {
  return `ia-friday-judge:${token}`;
}

function readStoredIdentity(token: string): StoredIdentity | null {
  try {
    const raw = window.localStorage.getItem(storageKey(token));
    return raw ? (JSON.parse(raw) as StoredIdentity) : null;
  } catch {
    return null;
  }
}

function writeStoredIdentity(token: string, identity: StoredIdentity | null) {
  try {
    if (identity) {
      window.localStorage.setItem(storageKey(token), JSON.stringify(identity));
    } else {
      window.localStorage.removeItem(storageKey(token));
    }
  } catch {
    // Storage can be blocked; the judge then has to identify again after a reload.
  }
}

function savedDraft(scores: JudgeScore[], teamId: number): TeamDraft {
  const teamScores = scores.filter((score) => score.team_id === teamId);
  return {
    scores: Object.fromEntries(teamScores.map((score) => [score.criterion_id, score.score])),
    comment: teamScores.find((score) => score.comment)?.comment ?? "",
  };
}

export function JudgePage({ token }: { token: string }) {
  const [evaluation, setEvaluation] = useState<PublicEvaluation | null>(null);
  const [identity, setIdentity] = useState<StoredIdentity | null>(() => readStoredIdentity(token));
  const judge = identity?.judge ?? null;
  const [scores, setScores] = useState<JudgeScore[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  // Unsaved edits per team, so switching teams or reloading the page does not lose them.
  const [drafts, setDrafts] = useState<Record<number, TeamDraft>>({});
  const [name, setName] = useState("");
  const [duplicateName, setDuplicateName] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const draftKey = identity ? `ia-friday-judge-drafts:${token}:${identity.judge.id}` : null;

  async function refresh() {
    const data = await resources.evaluation.publicGet(token);
    // Keep the same object when nothing changed so periodic refreshes do not re-render the screen.
    setEvaluation((current) => (current && JSON.stringify(current) === JSON.stringify(data) ? current : data));
  }

  useEffect(() => {
    void refresh().catch((err) => setError((err as Error).message));
  }, [token]);

  // The organizer opens and closes voting while judges wait with the page open, so keep it up to date.
  useEffect(() => {
    if (evaluation?.status === "closed") return;
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh().catch(() => undefined);
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [token, evaluation?.status]);

  useEffect(() => {
    if (!identity) return;
    resources.evaluation
      .scores(token, identity.judge.id, identity.voteToken)
      .then(setScores)
      .catch((err) => {
        // The vote token was revoked (judge removed or identified again elsewhere): ask for the name again.
        writeStoredIdentity(token, null);
        setIdentity(null);
        setError((err as Error).message);
      });
  }, [identity?.judge.id, identity?.voteToken, token]);

  useEffect(() => {
    if (!draftKey) {
      setDrafts({});
      return;
    }
    try {
      const raw = window.localStorage.getItem(draftKey);
      setDrafts(raw ? (JSON.parse(raw) as Record<number, TeamDraft>) : {});
    } catch {
      setDrafts({});
    }
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey) return;
    try {
      if (Object.keys(drafts).length) window.localStorage.setItem(draftKey, JSON.stringify(drafts));
      else window.localStorage.removeItem(draftKey);
    } catch {
      // Drafts are a convenience; they still work in memory when storage is blocked.
    }
  }, [drafts, draftKey]);

  const teams = evaluation?.teams ?? [];
  const criteria = evaluation?.criteria ?? [];
  const selectedTeam = useMemo(() => teams.find((team) => team.id === selectedTeamId) ?? null, [teams, selectedTeamId]);
  const assignmentByTeam = useMemo(() => new Map(evaluation?.assignments.map((item) => [item.team_id, item]) ?? []), [evaluation?.assignments]);

  function teamVoted(team: Team, savedScores: JudgeScore[] = scores) {
    return criteria.length > 0 && criteria.every((criterion) => savedScores.some((score) => score.team_id === team.id && score.criterion_id === criterion.id));
  }

  const votedCount = teams.filter((team) => teamVoted(team)).length;
  const allVoted = teams.length > 0 && votedCount === teams.length;

  // Start on the first team the judge has not voted yet.
  useEffect(() => {
    if (selectedTeamId !== null || !teams.length) return;
    setSelectedTeamId((teams.find((team) => !teamVoted(team)) ?? teams[0]).id);
  }, [teams, scores, selectedTeamId]);

  const current: TeamDraft | null = selectedTeam ? drafts[selectedTeam.id] ?? savedDraft(scores, selectedTeam.id) : null;
  const hasUnsavedChanges = selectedTeam ? Boolean(drafts[selectedTeam.id]) : false;
  const missingCriteria = current ? criteria.filter((criterion) => current.scores[criterion.id] === undefined).length : 0;
  const votingOpen = evaluation?.status === "open";

  function updateCurrent(change: (draft: TeamDraft) => TeamDraft) {
    if (!selectedTeam) return;
    const teamId = selectedTeam.id;
    setDrafts((previous) => ({ ...previous, [teamId]: change(previous[teamId] ?? savedDraft(scores, teamId)) }));
  }

  useEffect(() => {
    if (!notification) return;
    const timeout = window.setTimeout(() => setNotification(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [notification]);

  async function identify(event: React.SyntheticEvent, confirmExisting = false) {
    event.preventDefault();
    try {
      setError("");
      const result = await resources.evaluation.identify(token, { name, confirm_existing: confirmExisting });
      const next = { judge: result.judge, voteToken: result.vote_token };
      writeStoredIdentity(token, next);
      setIdentity(next);
      setDuplicateName(null);
    } catch (err) {
      // The name is already registered: it may be another person with the same name, so ask before taking it over.
      if (err instanceof ApiError && err.status === 409) {
        setDuplicateName(name.trim());
        return;
      }
      setError((err as Error).message);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!identity || !selectedTeam || !current || missingCriteria > 0 || saving) return;
    const team = selectedTeam;
    setSaving(true);
    try {
      setError("");
      const submitted = await resources.evaluation.submitScores(token, identity.voteToken, {
        judge_id: identity.judge.id,
        team_id: team.id,
        comment: current.comment,
        scores: criteria.map((criterion) => ({ criterion_id: criterion.id, score: current.scores[criterion.id] })),
      });
      setScores(submitted);
      setDrafts((previous) => {
        const next = { ...previous };
        delete next[team.id];
        return next;
      });
      // Move on to the next team that still needs a vote, so the judge never has to look for it.
      const startIndex = teams.findIndex((item) => item.id === team.id);
      const nextTeam = [...teams.slice(startIndex + 1), ...teams.slice(0, startIndex)].find((item) => !teamVoted(item, submitted));
      if (nextTeam) {
        setSelectedTeamId(nextTeam.id);
        setNotification(`Voto guardado para "${team.name}". Sigue "${nextTeam.name}".`);
        window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      } else {
        setNotification(`Voto guardado para "${team.name}". ¡Ya votaste a todos los equipos!`);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!evaluation) {
    return <div className="min-h-screen bg-[#eef3f8] p-5 font-bold text-slate-700">{error || "Cargando evaluación..."}</div>;
  }

  return (
    <div className="min-h-screen bg-[#eef3f8]">
      <main className="mx-auto grid w-full max-w-3xl gap-4 overflow-hidden px-4 py-5">
        <section className="lab-surface min-w-0 rounded-lg p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">Jurado IA Friday</p>
          <h1 className="mt-2 break-words text-2xl font-black leading-tight text-slate-950 sm:text-3xl">{evaluation.session.name}</h1>
          <p className="mt-1 font-semibold text-slate-500">{evaluation.session.date}</p>
          {judge ? (
            <p className="mt-3 text-sm font-semibold text-slate-600">
              Votando como <strong className="text-slate-900">{judge.name}</strong>{" "}
              <button
                type="button"
                className="font-bold text-slate-500 underline"
                onClick={() => {
                  writeStoredIdentity(token, null);
                  setIdentity(null);
                  setScores([]);
                  setSelectedTeamId(null);
                }}
              >
                No soy yo
              </button>
            </p>
          ) : null}
          {evaluation.status === "prepared" ? (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 font-bold text-amber-800">
              La votación aún no está abierta. Puedes registrarte ahora: esta pantalla se actualizará sola cuando el organizador la abra.
            </p>
          ) : null}
          {!judge && !evaluation.registration_open && evaluation.status !== "closed" ? (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 font-bold text-amber-800">
              El registro de jurados cerró. Si ya te registraste, escribe tu nombre exacto para continuar.
            </p>
          ) : null}
          {evaluation.status === "closed" ? (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 font-bold text-amber-800">La votación está cerrada. ¡Gracias por participar!</p>
          ) : null}
          {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 font-semibold text-red-700">{error}</p> : null}
        </section>

        {!judge ? (
          <form className="lab-surface grid min-w-0 gap-4 rounded-lg p-5" onSubmit={(event) => void identify(event)}>
            <div>
              <h2 className="text-xl font-black text-slate-950">¿Cómo te llamas?</h2>
              <p className="mt-1 font-medium text-slate-600">Escribe tu nombre para empezar a votar.</p>
            </div>
            <input
              className="input !min-h-12 text-lg"
              placeholder="Tu nombre"
              value={name}
              autoFocus
              autoComplete="name"
              enterKeyHint="go"
              onChange={(event) => {
                setName(event.target.value);
                setDuplicateName(null);
              }}
              required
            />
            {duplicateName ? (
              <div role="alert" className="grid gap-3 rounded-lg bg-amber-50 p-3 text-amber-900">
                <p className="font-bold">Ya hay un jurado llamado «{duplicateName}» en esta votación.</p>
                <p className="text-sm font-semibold">
                  Si eres tú (por ejemplo, cambiaste de celular), continúa. Si es otra persona, agrega tu apellido.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-primary" onClick={(event) => void identify(event, true)}>
                    Sí, soy yo
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => setDuplicateName(null)}>
                    No, usaré otro nombre
                  </button>
                </div>
              </div>
            ) : null}
            <button className="btn-primary !min-h-12 text-lg" disabled={evaluation.status === "closed" || duplicateName !== null}>
              Continuar
            </button>
          </form>
        ) : evaluation.status === "prepared" ? (
          <section className="lab-surface min-w-0 rounded-lg p-5">
            <h2 className="text-xl font-black text-slate-950">Registro recibido</h2>
            <p className="mt-2 font-semibold text-slate-600">
              Gracias, {judge.name}. Ya quedaste registrado como jurado. Cuando el organizador abra la votación, aparecerán aquí los equipos para puntuar.
            </p>
          </section>
        ) : (
          <>
            <section className="lab-surface min-w-0 rounded-lg p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-xl font-black text-slate-950">Equipos</h2>
                <p className="text-sm font-black text-teal-800">
                  {votedCount} de {teams.length} votados
                </p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${teams.length ? (votedCount / teams.length) * 100 : 0}%` }} />
              </div>
              {allVoted ? (
                <p className="mt-3 rounded-lg bg-teal-50 p-3 font-bold text-teal-800">
                  ¡Gracias! Ya votaste a todos los equipos. Si cambias de opinión, puedes ajustar un voto mientras la votación siga abierta.
                </p>
              ) : null}
              <div className="mt-3 grid gap-2">
                {teams.map((team) => {
                  const voted = teamVoted(team);
                  const selected = selectedTeamId === team.id;
                  return (
                    <button
                      key={team.id}
                      type="button"
                      aria-pressed={selected}
                      className={`flex min-h-14 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition ${
                        selected ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-700"
                      }`}
                      onClick={() => setSelectedTeamId(team.id)}
                    >
                      <span className="min-w-0">
                        <span className="block break-words font-bold">{team.name}</span>
                        <span className={`block break-words text-sm font-medium ${selected ? "text-slate-300" : "text-slate-500"}`}>
                          {assignmentByTeam.get(team.id)?.use_case_title ?? "Sin caso asignado"}
                        </span>
                      </span>
                      {voted ? (
                        <CheckCircle2 size={22} className={selected ? "shrink-0 text-teal-300" : "shrink-0 text-teal-600"} />
                      ) : (
                        <Circle size={22} className={selected ? "shrink-0 text-slate-500" : "shrink-0 text-slate-300"} />
                      )}
                    </button>
                  );
                })}
                {!teams.length ? <p className="rounded-lg bg-slate-50 p-3 font-semibold text-slate-500">Aún no hay equipos para votar.</p> : null}
              </div>
            </section>

            {selectedTeam && current ? (
              <form
                key={selectedTeam.id}
                ref={formRef}
                className="lab-surface grid min-w-0 gap-5 rounded-lg p-5"
                onSubmit={(event) => void submit(event)}
              >
                <div>
                  <h2 className="break-words text-2xl font-black leading-tight text-slate-950">{selectedTeam.name}</h2>
                  <p className="break-words font-semibold text-slate-500">Caso: {assignmentByTeam.get(selectedTeam.id)?.use_case_title ?? "Sin caso asignado"}</p>
                  <p className="mt-2 text-sm font-bold text-slate-500">
                    Puntúa de 1 a {criteria[0]?.max_score ?? 5}: 1 = {scoreLabels[1]}, {criteria[0]?.max_score ?? 5} = {scoreLabels[criteria[0]?.max_score ?? 5]}
                  </p>
                </div>

                {criteria.map((criterion) => {
                  const value = current.scores[criterion.id];
                  return (
                    <div key={criterion.id} role="group" aria-label={criterionLabel(criterion.name)} className="grid gap-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="break-words text-base font-black leading-5 text-slate-800">{criterionLabel(criterion.name)}</span>
                        <span className={`text-sm font-bold ${value === undefined ? "text-slate-400" : "text-teal-800"}`}>
                          {value === undefined ? "Toca un número" : `${value} · ${scoreLabels[value] ?? ""}`}
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {Array.from({ length: criterion.max_score }, (_, index) => index + 1).map((option) => (
                          <button
                            key={option}
                            type="button"
                            aria-pressed={value === option}
                            disabled={!votingOpen}
                            className={`min-h-14 rounded-xl border-2 text-xl font-black transition disabled:opacity-50 ${
                              value === option
                                ? "border-teal-600 bg-teal-600 text-white"
                                : "border-slate-200 bg-white text-slate-700 active:bg-slate-100"
                            }`}
                            onClick={() => updateCurrent((draft) => ({ ...draft, scores: { ...draft.scores, [criterion.id]: option } }))}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <label className="grid gap-2 text-sm font-bold text-slate-700">
                  Comentario (opcional)
                  <textarea
                    className="input min-h-24 text-base font-normal"
                    placeholder="¿Qué te gustó o qué mejorarías?"
                    value={current.comment}
                    disabled={!votingOpen}
                    onChange={(event) => updateCurrent((draft) => ({ ...draft, comment: event.target.value }))}
                  />
                </label>

                <div className="sticky bottom-0 -mx-5 -mb-5 grid gap-2 rounded-b-lg border-t border-slate-200 bg-white/95 p-4 backdrop-blur">
                  {error ? (
                    <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">
                      No se pudo guardar tu voto: {error}
                    </p>
                  ) : null}
                  {votingOpen && missingCriteria > 0 ? (
                    <p className="text-center text-sm font-bold text-amber-800">
                      {missingCriteria === 1 ? "Falta 1 criterio por calificar" : `Faltan ${missingCriteria} criterios por calificar`}
                    </p>
                  ) : null}
                  {votingOpen && missingCriteria === 0 && hasUnsavedChanges ? (
                    <p className="text-center text-sm font-bold text-slate-500">Cambios sin guardar</p>
                  ) : null}
                  <button className="btn-primary !min-h-12 text-lg" disabled={!votingOpen || missingCriteria > 0 || saving}>
                    {saving ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                    {saving ? "Guardando..." : teamVoted(selectedTeam) ? "Actualizar voto" : "Guardar voto"}
                  </button>
                </div>
              </form>
            ) : null}
          </>
        )}
      </main>
      {notification ? (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <div className="w-full max-w-lg rounded-2xl border border-teal-100 bg-white/95 px-4 py-3 shadow-2xl shadow-teal-200/30 backdrop-blur-xl ring-1 ring-slate-200">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white">
                <CheckCircle2 size={20} />
              </span>
              <p className="text-sm font-semibold leading-5 text-slate-900">{notification}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
