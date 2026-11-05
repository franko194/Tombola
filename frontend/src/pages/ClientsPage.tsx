import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { resources } from "../api/resources";
import { useDialogs } from "../components/Dialogs";
import type { ClientVisit, ClientVisitInput } from "../types";

const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const monthNames = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

type Draft = {
  id: number | null;
  company_name: string;
  contact: string;
  notes: string;
  visit_date: string;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function monthKey(year: number, monthIndex: number) {
  return `${year}-${pad(monthIndex + 1)}`;
}

function emptyDraft(date: string): Draft {
  return { id: null, company_name: "", contact: "", notes: "", visit_date: date };
}

export function ClientsPage() {
  const { confirm } = useDialogs();
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const [cursor, setCursor] = useState({ year: today.getFullYear(), monthIndex: today.getMonth() });
  const [visits, setVisits] = useState<ClientVisit[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const month = monthKey(cursor.year, cursor.monthIndex);

  async function load() {
    try {
      setError("");
      setVisits(await resources.clients.list(month));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    void load();
  }, [month]);

  const visitsByDate = useMemo(() => {
    const byDate = new Map<string, ClientVisit[]>();
    for (const visit of visits) {
      byDate.set(visit.visit_date, [...(byDate.get(visit.visit_date) ?? []), visit]);
    }
    return byDate;
  }, [visits]);

  const cells = useMemo(() => {
    // Weeks start on Monday. Fridays are marked because they belong to the internal IA Friday sessions.
    const offset = (new Date(cursor.year, cursor.monthIndex, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(cursor.year, cursor.monthIndex + 1, 0).getDate();
    const list: Array<{ iso: string; day: number; isFriday: boolean } | null> = Array.from({ length: offset }, () => null);
    for (let day = 1; day <= daysInMonth; day++) {
      const weekday = new Date(cursor.year, cursor.monthIndex, day).getDay();
      list.push({ iso: `${month}-${pad(day)}`, day, isFriday: weekday === 5 });
    }
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [cursor, month]);

  function shiftMonth(delta: number) {
    const date = new Date(cursor.year, cursor.monthIndex + delta, 1);
    setCursor({ year: date.getFullYear(), monthIndex: date.getMonth() });
  }

  function openEdit(visit: ClientVisit) {
    setDraft({
      id: visit.id,
      company_name: visit.company_name,
      contact: visit.contact ?? "",
      notes: visit.notes ?? "",
      visit_date: visit.visit_date,
    });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const payload: ClientVisitInput = {
      company_name: draft.company_name.trim(),
      contact: draft.contact.trim() || null,
      notes: draft.notes.trim() || null,
      visit_date: draft.visit_date,
    };
    try {
      if (draft.id === null) {
        await resources.clients.create(payload);
      } else {
        await resources.clients.update(draft.id, payload);
      }
      setDraft(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(visit: ClientVisit) {
    const accepted = await confirm({
      title: "Eliminar visita",
      message: `¿Eliminar la visita de ${visit.company_name}?`,
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!accepted) return;
    try {
      await resources.clients.remove(visit.id);
      if (draft?.id === visit.id) setDraft(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main className="min-h-[calc(100vh-57px)] bg-[#eef3f8] px-4 py-8">
      <section className="mx-auto grid max-w-6xl gap-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">Innovation Lab</p>
            <h1 className="mt-1 text-3xl font-black text-slate-950">Calendario de clientes</h1>
            <p className="mt-1 font-medium text-slate-600">Visitas de clientes externos. Es independiente de las sesiones de IA Friday.</p>
          </div>
        </div>

        {error ? <p className="rounded-lg bg-red-50 p-3 font-semibold text-red-700">{error}</p> : null}

        <div className="lab-surface grid gap-4 rounded-lg p-5">
          <div className="flex items-center justify-between gap-3">
            <button className="btn-secondary !min-h-9 !px-2" onClick={() => shiftMonth(-1)} title="Mes anterior">
              <ChevronLeft size={18} />
            </button>
            <h2 className="text-xl font-black text-slate-950">
              {monthNames[cursor.monthIndex]} {cursor.year}
            </h2>
            <button className="btn-secondary !min-h-9 !px-2" onClick={() => shiftMonth(1)} title="Mes siguiente">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-black uppercase tracking-wide text-slate-500">
            {weekdays.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, index) => {
              if (!cell) return <span key={`empty-${index}`} />;
              // The highlighted day follows the date of the open form, so it always matches what will be saved.
              const selected = draft?.visit_date === cell.iso;
              const isToday = cell.iso === todayIso;
              return (
                <button
                  key={cell.iso}
                  aria-pressed={selected}
                  onClick={() => setDraft(emptyDraft(cell.iso))}
                  className={`flex min-h-20 flex-col gap-1 rounded-lg border p-1.5 text-left transition hover:border-teal-500 ${
                    selected
                      ? "border-teal-600 bg-teal-50 ring-2 ring-teal-600"
                      : cell.isFriday
                        ? "border-blue-200 bg-blue-50/60"
                        : "border-slate-200 bg-white"
                  }`}
                >
                  <span className="flex items-center justify-between text-sm font-black text-slate-800">
                    <span
                      className={isToday ? "grid h-6 w-6 place-items-center rounded-full bg-teal-600 text-xs text-white" : ""}
                      title={isToday ? "Hoy" : undefined}
                    >
                      {cell.day}
                    </span>
                    {cell.isFriday ? <span className="text-[10px] font-bold text-blue-700">IA Friday</span> : null}
                  </span>
                  {(visitsByDate.get(cell.iso) ?? []).slice(0, 2).map((visit) => (
                    <span key={visit.id} className="truncate rounded bg-teal-600 px-1 text-[11px] font-bold text-white">
                      {visit.company_name}
                    </span>
                  ))}
                  {(visitsByDate.get(cell.iso)?.length ?? 0) > 2 ? (
                    <span className="text-[11px] font-bold text-slate-500">+{(visitsByDate.get(cell.iso)?.length ?? 0) - 2} más</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {draft ? (
          <form className="lab-surface grid gap-4 rounded-lg p-5" onSubmit={(event) => void save(event)}>
            <h2 className="text-xl font-black text-slate-950">{draft.id === null ? "Nueva visita" : "Editar visita"}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-slate-600">
                Empresa
                <input
                  className="input"
                  required
                  value={draft.company_name}
                  onChange={(event) => setDraft({ ...draft, company_name: event.target.value })}
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-600">
                Fecha
                <input
                  className="input"
                  type="date"
                  required
                  value={draft.visit_date}
                  onChange={(event) => setDraft({ ...draft, visit_date: event.target.value })}
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-600">
                Contacto
                <input className="input" value={draft.contact} onChange={(event) => setDraft({ ...draft, contact: event.target.value })} />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-600">
                Notas
                <textarea className="input min-h-20" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" disabled={!draft.company_name.trim()}>
                {draft.id === null ? <Plus size={18} /> : <Pencil size={18} />}
                Guardar
              </button>
              <button type="button" className="btn-secondary" onClick={() => setDraft(null)}>
                Cancelar
              </button>
            </div>
          </form>
        ) : null}

        <div className="lab-surface overflow-hidden rounded-lg">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-600">
            Clientes de {monthNames[cursor.monthIndex]}
          </div>
          {visits.map((visit) => (
            <div key={visit.id} className="grid gap-2 border-b border-slate-100 px-4 py-3 md:grid-cols-[120px_1fr_1fr_auto] md:items-center">
              <span className="text-sm font-bold text-slate-500">{visit.visit_date}</span>
              <div>
                <p className="font-black text-slate-900">{visit.company_name}</p>
                {visit.contact ? <p className="text-sm font-semibold text-slate-600">{visit.contact}</p> : null}
              </div>
              <p className="text-sm font-medium text-slate-600">{visit.notes ?? ""}</p>
              <div className="flex gap-2">
                <button className="btn-secondary !min-h-9 !px-2" onClick={() => openEdit(visit)} title="Editar">
                  <Pencil size={16} />
                </button>
                <button className="btn-secondary !min-h-9 !px-2" onClick={() => void remove(visit)} title="Eliminar">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {!visits.length ? <p className="p-4 font-semibold text-slate-500">No hay clientes planificados este mes.</p> : null}
        </div>
      </section>
    </main>
  );
}
