import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { resources } from "../api/resources";
import { useDialogs } from "../components/Dialogs";
import type { DrawHistory, Session } from "../types";

const reasonLabels: Record<string, string> = {
  participant_added: "Se agregó un participante",
  participant_edited: "Se editó un participante",
  participant_deleted: "Se eliminó un participante",
  participants_imported: "Se importó la lista de participantes",
  teams_regenerated: "Se regeneraron los equipos",
  teams_edited_manually: "Se editaron equipos a mano",
  use_case_added: "Se agregó un caso",
  use_case_edited: "Se editó un caso",
  use_case_deleted: "Se eliminó un caso",
  cases_reassigned: "Se volvió a sortear los casos",
  session_deleted: "Se eliminó la sesión",
};

export function HistoryPage({ session }: { session: Session }) {
  const [entries, setEntries] = useState<DrawHistory[]>([]);
  const [error, setError] = useState("");
  const { confirm, form } = useDialogs();

  async function load() {
    try {
      setError("");
      setEntries(await resources.history.list(session.id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    void load();
  }, [session.id]);

  async function editNote(entry: DrawHistory) {
    const values = await form({
      title: "Nota del registro",
      fields: [{ name: "note", label: "Nota (déjala vacía para quitarla)", type: "textarea", value: entry.note ?? "" }],
    });
    if (!values) return;
    try {
      await resources.history.updateNote(session.id, entry.id, values.note);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(entry: DrawHistory) {
    const accepted = await confirm({
      title: "Eliminar registro",
      message: "¿Eliminar este registro del historial? No se puede deshacer.",
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!accepted) return;
    try {
      await resources.history.remove(session.id, entry.id);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="grid gap-5">
      <div className="lab-surface rounded-lg p-5">
        <h2 className="text-2xl font-black text-slate-950">Historial de sorteos</h2>
        <p className="mt-1 font-medium text-slate-600">
          Cada vez que se reemplaza o borra un sorteo, queda guardado aquí. Puedes agregarle una nota o eliminarlo.
        </p>
        {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 font-semibold text-red-700">{error}</p> : null}
      </div>

      {entries.map((entry) => (
        <article key={entry.id} className="lab-surface grid gap-3 rounded-lg p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="font-black text-slate-950">{reasonLabels[entry.reason] ?? entry.reason}</p>
              <p className="text-sm font-semibold text-slate-500">{new Date(entry.created_at).toLocaleString("es")}</p>
              {entry.note ? <p className="mt-2 font-medium text-slate-700">Nota: {entry.note}</p> : null}
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary !min-h-9 !px-2" onClick={() => void editNote(entry)} title="Editar nota">
                <Pencil size={16} />
              </button>
              <button className="btn-secondary !min-h-9 !px-2" onClick={() => void remove(entry)} title="Eliminar registro">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {entry.teams.map((team) => (
              <div key={team.name} className="rounded-lg bg-slate-50 p-3">
                <p className="font-black text-slate-900">
                  {team.name} <span className="text-sm font-semibold text-slate-500">promedio {team.average_ai_level}</span>
                </p>
                <p className="mt-1 text-sm font-medium text-slate-600">{team.members.join(", ") || "Sin integrantes"}</p>
              </div>
            ))}
          </div>
          {entry.assignments.length ? (
            <ul className="grid gap-1 text-sm font-semibold text-slate-700">
              {entry.assignments.map((assignment) => (
                <li key={`${assignment.team_name}-${assignment.use_case_title}`}>
                  {assignment.team_name}: {assignment.use_case_title}
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      ))}

      {!entries.length ? <p className="lab-surface rounded-lg p-5 font-semibold text-slate-500">Aún no hay sorteos reemplazados en esta sesión.</p> : null}
    </section>
  );
}
