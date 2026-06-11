import { PartyPopper, Play } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { resources } from "../api/resources";
import {
  buildWheelSegments,
  buildWheelStyle,
  calculateWheelSpin,
  getNextRevealIndex,
  getTombolaReadiness,
  isTombolaComplete,
} from "../lib/wheel";
import type { Assignment, PageKey, Results, Session, TeamsResponse, UseCase } from "../types";

const wheelColors = ["#0f7c80", "#315fbd", "#16a085", "#263b62", "#22a6b3", "#4f7dde"];

export function TombolaPage({ session, onPageChange }: { session: Session; onPageChange: (page: PageKey) => void }) {
  const [teamsData, setTeamsData] = useState<TeamsResponse | null>(null);
  const [useCases, setUseCases] = useState<UseCase[]>([]);
  const [results, setResults] = useState<Results | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [activeAssignmentIndex, setActiveAssignmentIndex] = useState<number | null>(null);
  const [pendingAssignmentIndex, setPendingAssignmentIndex] = useState<number | null>(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [wheelStartRotation, setWheelStartRotation] = useState(0);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [error, setError] = useState("");

  async function load({ markExistingComplete = false } = {}) {
    const [teams, cases, sessionResults] = await Promise.all([
      resources.teams.list(session.id),
      resources.useCases.list(session.id),
      resources.results.get(session.id),
    ]);
    setTeamsData(teams);
    setUseCases(cases);
    setResults(sessionResults);

    if (markExistingComplete && sessionResults.assignments.length) {
      setRevealedCount(sessionResults.assignments.length);
      setActiveAssignmentIndex(sessionResults.assignments.length - 1);
    }
  }

  useEffect(() => {
    void load({ markExistingComplete: true }).catch((err) => setError((err as Error).message));
  }, [session.id]);

  const assignments = results?.assignments ?? [];
  const segments = useMemo(() => buildWheelSegments(useCases), [useCases]);
  const revealedAssignments = assignments.slice(0, revealedCount);
  const activeAssignment = activeAssignmentIndex === null ? null : assignments[activeAssignmentIndex];
  const pendingAssignment = pendingAssignmentIndex === null ? null : assignments[pendingAssignmentIndex];
  const allDone = isTombolaComplete({ assignmentCount: assignments.length, revealedCount });
  const readiness = getTombolaReadiness({
    teamCount: teamsData?.teams.length ?? 0,
    useCaseCount: useCases.length,
  });
  const activeUseCaseIndex = activeAssignment ? useCases.findIndex((item) => item.id === activeAssignment.use_case_id) : -1;

  const wheelBackground = segments.length
    ? `conic-gradient(${segments
        .map((segment, index) => `${wheelColors[index % wheelColors.length]} ${segment.startAngle}deg ${segment.endAngle}deg`)
        .join(", ")})`
    : "#d8e3ee";

  const wheelStyle = buildWheelStyle({
    background: wheelBackground,
    rotation: wheelRotation,
    startRotation: wheelStartRotation,
    spinning: wheelSpinning,
  });

  const buttonLabel = wheelSpinning
    ? "Girando..."
    : !assignments.length
      ? "Asignar casos y girar"
      : allDone
        ? "Sorteo completo"
        : `Girar para ${assignments[revealedCount]?.team_name ?? "siguiente equipo"}`;

  async function spinWheel() {
    try {
      setError("");
      if (!readiness.ready) {
        throw new Error(readiness.message);
      }

      let currentResults = results;
      if (!currentResults?.assignments.length) {
        await resources.results.assign(session.id);
        currentResults = await resources.results.get(session.id);
        setResults(currentResults);
        setRevealedCount(0);
        setActiveAssignmentIndex(null);
      }

      const nextRevealIndex = getNextRevealIndex({
        assignmentCount: currentResults.assignments.length,
        revealedCount,
      });
      if (nextRevealIndex === null) return;

      const assignment = currentResults.assignments[nextRevealIndex];
      const targetIndex = useCases.findIndex((item) => item.id === assignment.use_case_id);
      const spin = calculateWheelSpin({
        segmentCount: useCases.length,
        targetIndex,
        currentRotation: wheelRotation,
        extraTurns: 9,
      });

      setPendingAssignmentIndex(nextRevealIndex);
      setWheelStartRotation(wheelRotation);
      setWheelRotation(spin.finalRotation);
      setWheelSpinning(true);

      window.setTimeout(() => {
        setWheelSpinning(false);
        setActiveAssignmentIndex(nextRevealIndex);
        setRevealedCount(nextRevealIndex + 1);
        setPendingAssignmentIndex(null);
      }, 5200);
    } catch (err) {
      const message = (err as Error).message;
      setError(message.includes("There must be at least one use case") ? "Agrega al menos un caso de uso para sortear." : message);
      setWheelSpinning(false);
    }
  }

  return (
    <section className="grid gap-5">
      <div className="lab-surface wheel-hero rounded-lg p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">Tombola visual</p>
        <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-black text-slate-950">Sorteo de casos</h2>
            <p className="mt-2 max-w-2xl font-medium text-slate-600">Gira la ruleta para revelar un caso unico por equipo.</p>
          </div>
          <button className="btn-secondary" onClick={() => onPageChange("results")}>
            <PartyPopper size={18} />
            Resultados
          </button>
        </div>
        {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 font-semibold text-red-700">{error}</p> : null}
      </div>

      <div className="wheel-stage">
        <div className="lab-surface wheel-panel rounded-lg p-5">
          <div className="light-ring">
            {Array.from({ length: 20 }).map((_, index) => (
              <span key={index} style={{ "--dot": index } as CSSProperties} />
            ))}
          </div>
          <div className="wheel-pointer" />
          <div className="wheel-glow" />
          <div className={`wheel-status ${wheelSpinning ? "live" : ""}`}>
            {wheelSpinning ? `Girando para ${pendingAssignment?.team_name ?? "el equipo"}` : allDone ? "Sorteo completo" : "Listo para girar"}
          </div>
          <div className="wheel-frame">
            <div id="case-wheel" className={`wheel ${wheelSpinning ? "spinning" : ""}`} style={wheelStyle}>
              {segments.map((segment) => {
                const angle = segment.midAngle;
                return (
                  <span
                    key={segment.id}
                    className="wheel-label"
                    style={{ transform: `rotate(${angle}deg) translateY(-132px) rotate(${-angle}deg)` }}
                  >
                    {segment.label}
                  </span>
                );
              })}
            </div>
            <div className="wheel-center">
              <strong>IA</strong>
              <span>Friday</span>
            </div>
          </div>
          <button className="btn-primary spin-btn" onClick={() => void spinWheel()} disabled={!readiness.ready || wheelSpinning || allDone}>
            <Play size={18} />
            {buttonLabel}
          </button>
          <p className={`wheel-help ${readiness.ready ? "ready" : "blocked"}`}>{readiness.message}</p>
        </div>

        <div className={`lab-surface reveal-card rounded-lg p-6 ${wheelSpinning ? "is-waiting" : ""}`}>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-200">
            {wheelSpinning ? "En movimiento" : activeAssignment ? activeAssignment.team_name : "Equipo en espera"}
          </p>
          <h3>
            {wheelSpinning
              ? "El caso se esta decidiendo..."
              : activeAssignment
                ? `Caso asignado: ${activeAssignment.use_case_title}`
                : "La ruleta esta lista"}
          </h3>
          <p className="muted">
            {wheelSpinning
              ? "Mantente atento: el resultado aparece cuando la ruleta se detiene."
              : activeAssignment
                ? activeAssignment.use_case_description || "Caso asignado para el reto."
                : "Carga equipos y casos, luego presiona Girar."}
          </p>
          <div className="case-number">{activeUseCaseIndex >= 0 ? `Caso ${activeUseCaseIndex + 1}` : wheelSpinning ? "..." : "LISTO"}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {revealedAssignments.map((assignment, index) => (
          <div key={assignment.id} className={`ticket reveal rounded-lg p-5 ${index === activeAssignmentIndex ? "active-ticket" : ""}`}>
            <p className="text-sm font-black uppercase tracking-[0.12em] text-teal-800">{assignment.team_name}</p>
            <h3 className="mt-2 text-2xl font-black text-slate-950">{assignment.use_case_title}</h3>
            {assignment.use_case_description ? <p className="mt-2 font-medium text-slate-600">{assignment.use_case_description}</p> : null}
          </div>
        ))}
        {!revealedAssignments.length ? <div className="lab-surface rounded-lg p-6 font-bold text-slate-500">Los resultados apareceran aqui despues de cada giro.</div> : null}
      </div>
    </section>
  );
}
