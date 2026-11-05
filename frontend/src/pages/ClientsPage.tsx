import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { resources } from "../api/resources";
import { useDialogs } from "../components/Dialogs";
import { chileanHolidays, occupancyPercent, suggestedSlot } from "../lib/calendar";
import type { ClientVisit, ClientVisitInput } from "../types";

const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie"];
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
  is_internal: boolean;
  tentative: boolean;
  start_time: string;
  end_time: string;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function monthKey(year: number, monthIndex: number) {
  return `${year}-${pad(monthIndex + 1)}`;
}

// Internal events are navy, external ones blue. Tentative events are dashed and lighter.
function eventStyle(visit: Pick<ClientVisit, "is_internal" | "tentative">) {
  if (visit.tentative) {
    return visit.is_internal
      ? "border-dashed border-inst-navy bg-inst-navyPale text-inst-navy"
      : "border-dashed border-inst-blue bg-inst-bluePale text-inst-navy";
  }
  return visit.is_internal ? "border-inst-navy bg-inst-navy text-white" : "border-inst-blue bg-inst-blue text-white";
}

function occupancyColor(percent: number) {
  return percent >= 80 ? "bg-inst-alert" : "bg-inst-blue";
}

const shortWeekdays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function noteDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return `${shortWeekdays[new Date(year, month - 1, day).getDay()]} ${day}`;
}

function emptyDraft(date: string, dayVisits: ClientVisit[] = []): Draft {
  // A busy day starts the new event in the first free block instead of the whole workday.
  const slot = suggestedSlot(dayVisits);
  return { id: null, company_name: "", contact: "", notes: "", visit_date: date, is_internal: false, tentative: false, start_time: slot.start, end_time: slot.end };
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
    // Monday to Friday only. Weekends are not shown.
    const daysInMonth = new Date(cursor.year, cursor.monthIndex + 1, 0).getDate();
    const list: Array<{ iso: string; day: number; holiday?: string } | null> = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const weekday = new Date(cursor.year, cursor.monthIndex, day).getDay();
      if (weekday === 0 || weekday === 6) continue;
      if (list.length === 0) for (let i = 1; i < weekday; i++) list.push(null);
      const iso = `${month}-${pad(day)}`;
      list.push({ iso, day, holiday: chileanHolidays[iso] });
    }
    while (list.length % 5 !== 0) list.push(null);
    return list;
  }, [cursor, month]);

  const tentativeNotes = useMemo(() => visits.filter((visit) => visit.tentative), [visits]);

  const summary = useMemo(() => {
    const confirmed = visits.filter((visit) => !visit.tentative);
    const days = [...new Set(confirmed.map((visit) => visit.visit_date))];
    const average = days.length
      ? Math.round(days.reduce((total, day) => total + occupancyPercent(confirmed.filter((visit) => visit.visit_date === day)), 0) / days.length)
      : 0;
    return {
      internal: confirmed.filter((visit) => visit.is_internal).length,
      external: confirmed.filter((visit) => !visit.is_internal).length,
      average,
      hasDays: days.length > 0,
    };
  }, [visits]);

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
      is_internal: visit.is_internal,
      tentative: visit.tentative,
      start_time: visit.start_time,
      end_time: visit.end_time,
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
      is_internal: draft.is_internal,
      tentative: draft.tentative,
      start_time: draft.start_time,
      end_time: draft.end_time,
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
      title: "Eliminar evento",
      message: `¿Eliminar el evento «${visit.company_name}»?`,
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
    <main className="min-h-[calc(100vh-57px)] bg-[#eef3f8] px-4 py-6">
      <section className="mx-auto grid max-w-5xl gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-inst-blue">Innovation Lab</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950">Calendario de eventos</h1>
          <p className="mt-1 text-sm font-medium text-slate-600">Planifica los eventos internos y externos del laboratorio y ve cuánto de la jornada ocupa cada día.</p>
        </div>

        {error ? <p className="rounded-lg bg-red-50 p-3 font-semibold text-red-700">{error}</p> : null}

        <div className="grid items-start gap-4 lg:grid-cols-[200px_1fr]">
          <aside className="grid gap-3 lg:sticky lg:top-4">
            <div>
              <h2 className="text-sm font-black text-slate-950">Posibles sesiones</h2>
              <p className="text-xs font-semibold text-slate-500">Tentativas de {monthNames[cursor.monthIndex]}. No cuentan en la ocupación.</p>
            </div>
            {tentativeNotes.map((visit, index) => (
              <button
                key={visit.id}
                onClick={() => openEdit(visit)}
                title="Editar"
                className={`relative grid gap-1 rounded-sm border border-inst-blueBorder bg-inst-bluePale px-3 pb-3 pt-4 text-left shadow-md transition hover:-translate-y-0.5 hover:shadow-lg ${
                  index % 2 ? "rotate-1" : "-rotate-1"
                }`}
              >
                <span className="absolute left-1/2 top-1.5 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-inst-alert shadow" />
                <span className="text-xs font-black text-inst-navy">
                  {noteDate(visit.visit_date)} · {visit.start_time}–{visit.end_time}
                </span>
                <span className="text-sm font-black text-slate-900">{visit.company_name}</span>
                <span className={`w-fit rounded px-1.5 text-[11px] font-bold ${visit.is_internal ? "bg-inst-navy text-white" : "bg-inst-blue text-white"}`}>
                  {visit.is_internal ? "Interno" : "Externo"}
                </span>
                {visit.notes ? <span className="line-clamp-3 text-xs font-medium text-slate-700">{visit.notes}</span> : null}
              </button>
            ))}
            {!tentativeNotes.length ? (
              <p className="rounded-sm border border-dashed border-inst-blueBorder bg-inst-bluePale p-3 text-xs font-semibold text-inst-navy">
                Sin tentativas este mes. Marca un evento como tentativo y aparecerá aquí.
              </p>
            ) : null}
          </aside>

          <div className="lab-surface grid gap-3 rounded-lg p-4">
            <div className="flex items-center justify-between gap-3">
              <button className="btn-secondary !min-h-8 !px-2" onClick={() => shiftMonth(-1)} title="Mes anterior">
                <ChevronLeft size={16} />
              </button>
              <div className="text-center">
                <h2 className="text-lg font-black text-slate-950">
                  {monthNames[cursor.monthIndex]} {cursor.year}
                </h2>
                <p className="text-xs font-semibold text-slate-500">
                  {summary.internal + summary.external
                    ? `${summary.internal + summary.external} confirmado${summary.internal + summary.external > 1 ? "s" : ""} · ${summary.internal} interno${summary.internal === 1 ? "" : "s"} · ${summary.external} externo${summary.external === 1 ? "" : "s"}${summary.hasDays ? ` · ocupación promedio ${summary.average}%` : ""}`
                    : "Sin eventos confirmados"}
                </p>
              </div>
              <button className="btn-secondary !min-h-8 !px-2" onClick={() => shiftMonth(1)} title="Mes siguiente">
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="flex flex-wrap gap-3 text-[11px] font-bold text-slate-600">
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-inst-navy" /> Interno</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-inst-blue" /> Externo</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded border border-inst-alertBorder bg-inst-alertPale" /> Feriado</span>
            </div>
            <div className="grid grid-cols-5 gap-1 text-center text-[11px] font-black uppercase tracking-wide text-slate-500">
              {weekdays.map((weekday) => (
                <span key={weekday}>{weekday}</span>
              ))}
            </div>
            <div className="grid grid-cols-5 gap-1">
              {cells.map((cell, index) => {
                if (!cell) return <span key={`empty-${index}`} />;
                // The highlighted day follows the date of the open form, so it always matches what will be saved.
                const selected = draft?.visit_date === cell.iso;
                const isToday = cell.iso === todayIso;
                const dayVisits = (visitsByDate.get(cell.iso) ?? []).filter((visit) => !visit.tentative);
                const tentativeCount = (visitsByDate.get(cell.iso) ?? []).length - dayVisits.length;
                const percent = occupancyPercent(dayVisits);
                const isPast = cell.iso < todayIso;
                return (
                  <button
                    key={cell.iso}
                    aria-pressed={selected}
                    onClick={() => setDraft(emptyDraft(cell.iso, visitsByDate.get(cell.iso) ?? []))}
                    className={`flex min-h-24 flex-col gap-0.5 rounded-lg border p-1.5 text-left transition hover:border-inst-blue ${
                      selected
                        ? "border-inst-blue bg-inst-bluePale ring-2 ring-inst-blue"
                        : cell.holiday
                          ? "border-inst-alertBorder bg-inst-alertPale"
                          : isToday
                            ? "border-inst-blueBorder bg-inst-bluePale/40"
                            : isPast
                              ? "border-slate-200 bg-slate-50"
                              : "border-slate-200 bg-white"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-1 text-xs font-black text-slate-800">
                      <span
                        className={isToday ? "grid h-5 w-5 place-items-center rounded-full bg-inst-blue text-[11px] text-white" : ""}
                        title={isToday ? "Hoy" : undefined}
                      >
                        {cell.day}
                      </span>
                      {cell.holiday ? <span className="truncate text-[10px] font-bold text-inst-alert" title={cell.holiday}>{cell.holiday}</span> : null}
                    </span>
                    {dayVisits.slice(0, 3).map((visit) => (
                      <span
                        key={visit.id}
                        title={`${visit.is_internal ? "Interno" : "Externo"} · ${visit.start_time}–${visit.end_time}`}
                        className={`flex gap-1 truncate rounded border px-1 text-[11px] font-bold leading-4 ${eventStyle(visit)}`}
                      >
                        <span className="font-semibold opacity-80">{visit.start_time}</span>
                        <span className="truncate">{visit.company_name}</span>
                      </span>
                    ))}
                    {dayVisits.length > 3 ? <span className="text-[11px] font-bold text-slate-500">+{dayVisits.length - 3} más</span> : null}
                    {tentativeCount ? <span className="text-[11px] font-bold text-inst-navy">📝 {tentativeCount} tentativo{tentativeCount > 1 ? "s" : ""}</span> : null}
                    {dayVisits.length ? (
                      <span className="mt-auto grid gap-0.5" title="Ocupación de la jornada (9:00–18:00, sin almuerzo)">
                        <span className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                          <span className={`block h-full ${occupancyColor(percent)}`} style={{ width: `${Math.min(percent, 100)}%` }} />
                        </span>
                        <span className="text-[11px] font-bold text-slate-600">{percent}% ocupado</span>
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {draft ? (
          <form className="lab-surface grid gap-4 rounded-lg p-5" onSubmit={(event) => void save(event)}>
            <h2 className="text-xl font-black text-slate-950">{draft.id === null ? "Nuevo evento" : "Editar evento"}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-slate-600">
                Nombre
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
                Hora de inicio
                <input
                  className="input"
                  type="time"
                  required
                  value={draft.start_time}
                  onChange={(event) => setDraft({ ...draft, start_time: event.target.value })}
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-600">
                Hora de término
                <input
                  className="input"
                  type="time"
                  required
                  value={draft.end_time}
                  onChange={(event) => setDraft({ ...draft, end_time: event.target.value })}
                />
              </label>
              <div className="grid gap-2 text-sm font-bold text-slate-600">
                Tipo
                <button
                  type="button"
                  role="switch"
                  aria-checked={draft.is_internal}
                  onClick={() => setDraft({ ...draft, is_internal: !draft.is_internal })}
                  className="flex items-center gap-3 text-left"
                >
                  <span className={`relative h-6 w-11 rounded-full transition ${draft.is_internal ? "bg-inst-navy" : "bg-inst-blue"}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${draft.is_internal ? "left-[22px]" : "left-0.5"}`} />
                  </span>
                  <span className="font-black text-slate-900">{draft.is_internal ? "Interno" : "Externo"}</span>
                </button>
              </div>
              <label className="flex items-center gap-2 self-end text-sm font-bold text-slate-600">
                <input type="checkbox" checked={draft.tentative} onChange={(event) => setDraft({ ...draft, tentative: event.target.checked })} />
                Tentativo (posible workshop, aún sin confirmar)
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
            Eventos de {monthNames[cursor.monthIndex]}
          </div>
          {visits.map((visit) => (
            <div key={visit.id} className="grid gap-2 border-b border-slate-100 px-4 py-3 md:grid-cols-[120px_1fr_1fr_auto] md:items-center">
              <span className="text-sm font-bold text-slate-500">{visit.visit_date}</span>
              <div>
                <p className="flex flex-wrap items-center gap-2 font-black text-slate-900">
                  {visit.company_name}
                  <span className={`rounded border px-1.5 text-[11px] font-bold ${eventStyle(visit)}`}>
                    {visit.is_internal ? "Interno" : "Externo"}
                    {visit.tentative ? " · Tentativo" : ""}
                  </span>
                </p>
                <p className="text-sm font-semibold text-slate-500">
                  {visit.start_time}–{visit.end_time}
                </p>
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
          {!visits.length ? <p className="p-4 font-semibold text-slate-500">No hay eventos planificados este mes.</p> : null}
        </div>
      </section>
    </main>
  );
}
