import { BarChart3, Clipboard, ClipboardList, QrCode, Sparkles, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { resources } from "../api/resources";
import { MetricCard } from "../components/MetricCard";
import type { Evaluation, PageKey, Participant, Session, Team, UseCase } from "../types";

function buildJudgeUrl(token?: string, fallbackUrl?: string) {
  if (!token) return fallbackUrl ?? "";
  const configuredUrl = import.meta.env.VITE_PUBLIC_APP_URL?.replace(/\/$/, "");
  const baseUrl = configuredUrl || window.location.origin;
  return `${baseUrl}/judge/${token}`;
}

function isLocalUrl(url: string) {
  try {
    const hostname = new URL(url).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

export function DashboardPage({ session, onPageChange }: { session: Session; onPageChange: (page: PageKey) => void }) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [useCases, setUseCases] = useState<UseCase[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [evaluationError, setEvaluationError] = useState("");

  useEffect(() => {
    void Promise.all([
      resources.participants.list(session.id).then(setParticipants),
      resources.useCases.list(session.id).then(setUseCases),
      resources.teams.list(session.id).then((data) => setTeams(data.teams)),
    ]);
    void resources.evaluation
      .prepare(session.id)
      .then(setEvaluation)
      .catch((err) => setEvaluationError((err as Error).message));
  }, [session.id]);

  const judgeUrl = useMemo(() => buildJudgeUrl(evaluation?.token, evaluation?.judge_url), [evaluation?.judge_url, evaluation?.token]);

  const qrUrl = useMemo(() => {
    if (!judgeUrl) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(judgeUrl)}`;
  }, [judgeUrl]);

  const qrNeedsPublicUrl = judgeUrl ? isLocalUrl(judgeUrl) : false;

  async function copyJudgeLink() {
    if (!judgeUrl) return;
    await navigator.clipboard.writeText(judgeUrl);
  }

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

      <div className="lab-surface rounded-lg p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <QrCode className="text-teal-700" size={22} />
              <h3 className="text-xl font-black text-slate-950">Ingreso de jurados</h3>
            </div>
            <p className="mt-2 max-w-2xl font-medium text-slate-600">
              Comparte este QR desde el inicio. Los jurados pueden registrarse antes de abrir la votacion y quedaran asociados a esta fecha.
            </p>
            {judgeUrl ? <p className="mt-3 break-all rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-600">{judgeUrl}</p> : null}
            {qrNeedsPublicUrl ? (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-800">
                Este QR usa localhost. Para escanearlo desde un celular, abre la app desplegada en Vercel o configura VITE_PUBLIC_APP_URL con una URL publica.
              </p>
            ) : null}
            {evaluationError ? <p className="mt-3 rounded-lg bg-red-50 p-3 font-semibold text-red-700">{evaluationError}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-secondary" onClick={() => void copyJudgeLink()} disabled={!judgeUrl}>
                <Clipboard size={18} />
                Copiar link
              </button>
              <button className="btn-primary" onClick={() => onPageChange("evaluation")}>
                Ir a evaluacion
              </button>
            </div>
          </div>
          <div className="grid place-items-center rounded-lg bg-white p-4">
            {qrUrl ? <img src={qrUrl} alt="QR para registro de jurados" width={180} height={180} /> : <p className="p-8 font-bold text-slate-500">Preparando QR...</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
