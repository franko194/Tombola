import { Clipboard, Lock, QrCode, RefreshCw, Trash2, Trophy, Unlock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { resources } from "../api/resources";
import { JudgeQrCode } from "../components/JudgeQrCode";
import { buildJudgeUrl, isLocalUrl } from "../lib/publicUrl";
import type { Evaluation, Session } from "../types";

export function EvaluationPage({ session }: { session: Session }) {
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [loading, setLoading] = useState(false);
  const [removingJudgeId, setRemovingJudgeId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      setEvaluation(await resources.evaluation.prepare(session.id));
    } catch {
      setEvaluation(null);
    }
  }

  useEffect(() => {
    void load();
  }, [session.id]);

  const judgeUrl = useMemo(() => buildJudgeUrl(evaluation?.token, evaluation?.judge_url), [evaluation?.judge_url, evaluation?.token]);

  const qrNeedsPublicUrl = judgeUrl ? isLocalUrl(judgeUrl) : false;

  async function openEvaluation() {
    try {
      setError("");
      setLoading(true);
      setEvaluation(await resources.evaluation.open(session.id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function closeEvaluation() {
    try {
      setError("");
      setLoading(true);
      setEvaluation(await resources.evaluation.close(session.id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!judgeUrl) return;
    await navigator.clipboard.writeText(judgeUrl);
  }

  async function removeJudge(judgeId: number, judgeName: string) {
    const shouldRemove = window.confirm(`Eliminar al jurado "${judgeName}" de esta sesion? Tambien se eliminaran sus votos.`);
    if (!shouldRemove) return;

    try {
      setError("");
      setRemovingJudgeId(judgeId);
      setEvaluation(await resources.evaluation.removeJudge(session.id, judgeId));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRemovingJudgeId(null);
    }
  }

  return (
    <section className="grid gap-5">
      <div className="lab-surface rounded-lg p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">Jurado y premiacion</p>
        <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950">Evaluacion por fecha</h2>
            <p className="mt-1 max-w-2xl font-medium text-slate-600">
              El QR esta disponible desde el inicio. Los jurados pueden registrarse antes de abrir la votacion.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={() => void load()}>
              <RefreshCw size={18} />
              Actualizar
            </button>
            {!evaluation || evaluation.status === "closed" || evaluation.status === "prepared" ? (
              <button className="btn-primary" onClick={() => void openEvaluation()} disabled={loading}>
                <Unlock size={18} />
                {evaluation?.status === "closed" ? "Reabrir evaluacion" : "Abrir votacion"}
              </button>
            ) : (
              <button className="btn-danger" onClick={() => void closeEvaluation()} disabled={loading}>
                <Lock size={18} />
                Cerrar evaluacion
              </button>
            )}
          </div>
        </div>
        {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 font-semibold text-red-700">{error}</p> : null}
      </div>

      {evaluation ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
            <div className="lab-surface rounded-lg p-5">
              <div className="flex items-center gap-2">
                <QrCode className="text-teal-700" size={22} />
                <h3 className="text-xl font-black text-slate-950">QR para jurados</h3>
              </div>
              <div className="mt-4 grid place-items-center rounded-lg bg-white p-4">
                <JudgeQrCode url={judgeUrl} alt="QR de evaluacion para jurados" size={300} />
              </div>
              <div className="mt-3 rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Destino del QR</p>
                <p className="mt-1 break-all text-sm font-bold text-slate-600">{judgeUrl}</p>
              </div>
              {qrNeedsPublicUrl ? (
                <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-800">
                  Este QR usa localhost. Para abrirlo desde otro dispositivo, usa la URL desplegada en Vercel o configura VITE_PUBLIC_APP_URL.
                </p>
              ) : null}
              <button className="btn-secondary mt-3 w-full" onClick={() => void copyLink()}>
                <Clipboard size={18} />
                Copiar link
              </button>
              <a className="btn-secondary mt-3 w-full" href={judgeUrl || undefined} target="_blank" rel="noreferrer" aria-disabled={!judgeUrl}>
                Abrir link
              </a>
              <p className="mt-3 text-sm font-bold text-slate-500">
                Estado: {evaluation.status === "open" ? "Abierta" : evaluation.status === "prepared" ? "Registro previo" : "Cerrada"}
              </p>
            </div>

            <div className="lab-surface rounded-lg p-5">
              <div className="flex items-center gap-2">
                <Trophy className="text-teal-700" size={22} />
                <h3 className="text-xl font-black text-slate-950">Ranking en vivo</h3>
              </div>
              <div className="mt-4 grid gap-3">
                {evaluation.ranking.map((item, index) => (
                  <div key={item.team_id} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-black uppercase tracking-[0.12em] text-slate-400">#{index + 1}</p>
                      <p className="text-lg font-black text-slate-950">{item.team_name}</p>
                      <p className="text-sm font-bold text-slate-500">
                        Jurados que votaron: {item.votes_count}/{item.judges_count}
                      </p>
                    </div>
                    <p className="text-3xl font-black text-teal-800">{item.average_score}</p>
                  </div>
                ))}
                {!evaluation.ranking.length ? <p className="rounded-lg bg-slate-50 p-4 font-bold text-slate-500">Aun no hay equipos para rankear.</p> : null}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="lab-surface rounded-lg p-5">
              <h3 className="text-xl font-black text-slate-950">Criterios</h3>
              <ul className="mt-3 grid gap-2">
                {evaluation.criteria.map((criterion) => (
                  <li key={criterion.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="font-bold text-slate-800">{criterion.name}</span>
                    <span className="text-sm font-black text-teal-800">1 Very Bad - {criterion.max_score} Very Good</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lab-surface rounded-lg p-5">
              <h3 className="text-xl font-black text-slate-950">Jurados de esta sesion</h3>
              <ul className="mt-3 grid gap-2">
                {evaluation.judges.map((item) => (
                  <li key={item.judge.id} className="grid gap-3 rounded-lg bg-slate-50 px-3 py-2 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="break-words font-black text-slate-900">{item.judge.name}</p>
                      <p className="text-sm font-semibold text-slate-500">Equipos votados: {item.voted_teams}</p>
                    </div>
                    <button
                      className="btn-danger justify-center"
                      onClick={() => void removeJudge(item.judge.id, item.judge.name)}
                      disabled={removingJudgeId === item.judge.id}
                      title="Eliminar jurado"
                    >
                      <Trash2 size={16} />
                      {removingJudgeId === item.judge.id ? "Eliminando" : "Eliminar"}
                    </button>
                  </li>
                ))}
                {!evaluation.judges.length ? <li className="rounded-lg bg-slate-50 p-3 font-bold text-slate-500">Aun no hay jurados registrados.</li> : null}
              </ul>
            </div>
          </div>
        </>
      ) : (
        <div className="lab-surface rounded-lg p-6 font-bold text-slate-500">Preparando QR de jurados...</div>
      )}
    </section>
  );
}
