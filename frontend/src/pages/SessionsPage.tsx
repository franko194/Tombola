import { CalendarPlus, FolderOpen, Play, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { resources } from "../api/resources";
import { useDialogs } from "../components/Dialogs";
import { StatusBadge } from "../components/StatusBadge";
import type { Session } from "../types";

// Compare without caring about case or accents, so "tombola" finds "Tómbola".
function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function SessionsPage({ onSelect }: { onSelect: (session: Session) => void }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [name, setName] = useState("IA Friday - Sesión semanal");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const { confirm, form } = useDialogs();

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

  const visibleSessions = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return sessions;
    return sessions.filter((item) => normalize(`${item.name} ${item.date}`).includes(needle));
  }, [sessions, query]);

  async function createSession() {
    try {
      const created = await resources.sessions.create({ name, date });
      onSelect(created);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function editSession(session: Session) {
    const values = await form({
      title: "Editar sesión",
      fields: [
        { name: "name", label: "Nombre de la sesión", value: session.name, required: true },
        { name: "date", label: "Fecha de la sesión", type: "date", value: session.date, required: true },
      ],
    });
    if (!values) return;
    try {
      await resources.sessions.update(session.id, { name: values.name, date: values.date });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function duplicateSession(session: Session) {
    const values = await form({
      title: "Duplicar sesión",
      fields: [
        { name: "name", label: "Nombre de la nueva sesión", value: `${session.name} - copia`, required: true },
        { name: "date", label: "Fecha de la nueva sesión", type: "date", value: new Date().toISOString().slice(0, 10), required: true },
      ],
      confirmLabel: "Duplicar",
    });
    if (!values) return;
    try {
      await resources.sessions.duplicate(session.id, { name: values.name, date: values.date });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function archiveSession(session: Session) {
    const accepted = await confirm({
      title: "Archivar sesión",
      message: `¿Archivar la sesión "${session.name}"? Dejará de mostrarse en el historial principal.`,
      confirmLabel: "Archivar",
      danger: true,
    });
    if (!accepted) return;
    try {
      await resources.sessions.archive(session.id);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main className="min-h-[calc(100vh-57px)] bg-[#eef3f8] px-4 py-8">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-700">Innovation Lab</p>
          <h1 className="mt-2 text-4xl font-black text-slate-950">IA Friday Tómbola</h1>
          <p className="mt-3 max-w-2xl text-base font-medium text-slate-600">
            Gestiona sesiones semanales, balancea equipos por experiencia en IA y asigna casos con una tómbola visual.
          </p>
        </div>

        {error ? <div className="mb-4 rounded-lg bg-red-50 p-3 font-semibold text-red-700">{error}</div> : null}

        <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <div className="lab-surface rounded-lg p-5">
            <div className="mb-4 flex items-center gap-3">
              <CalendarPlus className="text-teal-700" />
              <h2 className="text-xl font-black text-slate-900">Nueva sesión</h2>
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
            {sessions.length ? (
              <div className="relative mb-4">
                <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  className="input !pl-10 !pr-10"
                  type="text"
                  inputMode="search"
                  placeholder="Buscar por nombre o fecha"
                  aria-label="Buscar sesiones"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {query ? (
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 hover:text-slate-900"
                    aria-label="Borrar búsqueda"
                    onClick={() => setQuery("")}
                  >
                    <X size={18} />
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="grid gap-3">
              {visibleSessions.map((item) => (
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
              {!sessions.length ? <p className="rounded-lg bg-slate-50 p-4 font-semibold text-slate-500">Aún no hay sesiones.</p> : null}
              {sessions.length && !visibleSessions.length ? (
                <p className="rounded-lg bg-slate-50 p-4 font-semibold text-slate-500">Ninguna sesión coincide con «{query.trim()}».</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
