import { CalendarPlus, FolderOpen, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { resources } from "../api/resources";
import { StatusBadge } from "../components/StatusBadge";
import type { Session } from "../types";

export function SessionsPage({ onSelect }: { onSelect: (session: Session) => void }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [name, setName] = useState("IA Friday - Sesion semanal");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");

  async function load() {
    try {
      setSessions(await resources.sessions.list());
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createSession() {
    try {
      const created = await resources.sessions.create({ name, date });
      onSelect(created);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function editSession(session: Session) {
    const nextName = prompt("Nombre de la sesion", session.name);
    if (!nextName) return;
    const nextDate = prompt("Fecha de la sesion", session.date);
    if (!nextDate) return;
    try {
      await resources.sessions.update(session.id, { name: nextName, date: nextDate });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function duplicateSession(session: Session) {
    const nextName = prompt("Nombre de la nueva sesion", `${session.name} - copia`);
    if (!nextName) return;
    const nextDate = prompt("Fecha de la nueva sesion", new Date().toISOString().slice(0, 10));
    if (!nextDate) return;
    try {
      await resources.sessions.duplicate(session.id, { name: nextName, date: nextDate });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function archiveSession(session: Session) {
    if (!confirm(`Archivar la sesion "${session.name}"? Dejare de mostrarla en el historial principal.`)) {
      return;
    }
    try {
      await resources.sessions.archive(session.id);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main className="min-h-screen bg-[#eef3f8] px-4 py-8">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-700">Innovation Lab</p>
          <h1 className="mt-2 text-4xl font-black text-slate-950">IA Friday Tombola</h1>
          <p className="mt-3 max-w-2xl text-base font-medium text-slate-600">
            Gestiona sesiones semanales, balancea equipos por experiencia en IA y asigna casos con una tombola visual.
          </p>
        </div>

        {error ? <div className="mb-4 rounded-lg bg-red-50 p-3 font-semibold text-red-700">{error}</div> : null}

        <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <div className="lab-surface rounded-lg p-5">
            <div className="mb-4 flex items-center gap-3">
              <CalendarPlus className="text-teal-700" />
              <h2 className="text-xl font-black text-slate-900">Nueva sesion</h2>
            </div>
            <label className="grid gap-2 text-sm font-bold text-slate-600">
              Nombre
              <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="mt-3 grid gap-2 text-sm font-bold text-slate-600">
              Fecha
              <input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <button className="btn-primary mt-5 w-full" onClick={createSession}>
              <Play size={18} />
              Crear y comenzar
            </button>
          </div>

          <div className="lab-surface rounded-lg p-5">
            <div className="mb-4 flex items-center gap-3">
              <FolderOpen className="text-blue-700" />
              <h2 className="text-xl font-black text-slate-900">Historial</h2>
            </div>
            <div className="grid gap-3">
              {sessions.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-3 md:grid-cols-[1fr_auto]"
                >
                  <button
                    className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-teal-500 md:flex-row md:items-center md:justify-between"
                    onClick={() => onSelect(item)}
                  >
                    <div>
                      <p className="text-lg font-black text-slate-900">{item.name}</p>
                      <p className="text-sm font-semibold text-slate-500">{item.date}</p>
                    </div>
                    <StatusBadge status={item.status} />
                  </button>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button className="btn-secondary" onClick={() => void editSession(item)}>
                      Editar
                    </button>
                    <button className="btn-secondary" onClick={() => void duplicateSession(item)}>
                      Duplicar
                    </button>
                    <button className="btn-danger" onClick={() => void archiveSession(item)}>
                      Archivar
                    </button>
                  </div>
                </div>
              ))}
              {!sessions.length ? <p className="rounded-lg bg-slate-50 p-4 font-semibold text-slate-500">Aun no hay sesiones.</p> : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
