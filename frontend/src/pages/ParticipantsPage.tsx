import { FileUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { resources } from "../api/resources";
import { useDialogs } from "../components/Dialogs";
import { resetWarning } from "../lib/drawGuard";
import type { Participant, Session } from "../types";

const levelLabels = ["Sin experiencia", "Principiante", "Básico", "Intermedio", "Avanzado", "Experto"];

export function ParticipantsPage({ session }: { session: Session }) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [name, setName] = useState("");
  const [aiLevel, setAiLevel] = useState(3);
  const [error, setError] = useState("");
  const { confirm, form } = useDialogs();

  async function load() {
    setParticipants(await resources.participants.list(session.id));
  }

  useEffect(() => {
    void load();
  }, [session.id]);

  async function add() {
    const warning = await resetWarning(session.id, "teams");
    if (warning && !(await confirm({ message: warning, confirmLabel: "Continuar", danger: true }))) return;
    try {
      await resources.participants.create(session.id, { name, ai_level: aiLevel });
      setName("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(id: number) {
    const warning = await resetWarning(session.id, "teams");
    const accepted = await confirm({
      title: "Eliminar participante",
      message: warning ?? "¿Eliminar participante?",
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!accepted) return;
    try {
      await resources.participants.remove(id);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function update(item: Participant) {
    const warning = await resetWarning(session.id, "teams");
    if (warning && !(await confirm({ message: warning, confirmLabel: "Continuar", danger: true }))) return;
    const values = await form({
      title: "Editar participante",
      fields: [
        { name: "name", label: "Nombre", value: item.name, required: true },
        { name: "ai_level", label: "Nivel de IA (0 a 5)", type: "number", value: String(item.ai_level), required: true, min: 0, max: 5 },
      ],
    });
    if (!values) return;
    try {
      await resources.participants.update(item.id, { name: values.name, ai_level: Number(values.ai_level) });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function importFile(file?: File) {
    if (!file) return;
    const warning = await resetWarning(session.id, "teams");
    if (warning && !(await confirm({ message: warning, confirmLabel: "Continuar", danger: true }))) return;
    try {
      await resources.participants.import(session.id, file);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="grid gap-5">
      <div className="lab-surface rounded-lg p-5">
        <h2 className="text-2xl font-black text-slate-950">Participantes</h2>
        <p className="mt-1 font-medium text-slate-600">Agrega personas manualmente o importa columnas nombre/nivelIA.</p>
        {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 font-semibold text-red-700">{error}</p> : null}
        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_190px_auto]">
          <input className="input" placeholder="Nombre participante" value={name} onChange={(event) => setName(event.target.value)} />
          <select className="input" value={aiLevel} onChange={(event) => setAiLevel(Number(event.target.value))}>
            {levelLabels.map((label, index) => (
              <option key={label} value={index}>
                {index} - {label}
              </option>
            ))}
          </select>
          <button className="btn-primary" onClick={add} disabled={!name.trim()}>
            <Plus size={18} />
            Agregar
          </button>
        </div>
        <label className="btn-secondary mt-4 w-fit cursor-pointer">
          <FileUp size={18} />
          Importar CSV/Excel
          <input className="hidden" type="file" accept=".csv,.xlsx" onChange={(event) => void importFile(event.target.files?.[0])} />
        </label>
      </div>

      <div className="lab-surface overflow-hidden rounded-lg">
        <div className="grid grid-cols-[1fr_130px_100px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-600">
          <span>Nombre</span>
          <span>Nivel</span>
          <span>Acciones</span>
        </div>
        {participants.map((item) => (
          <div key={item.id} className="grid grid-cols-[1fr_130px_100px] items-center gap-3 border-b border-slate-100 px-4 py-3">
            <span className="font-bold text-slate-900">{item.name}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">{item.ai_level} - {levelLabels[item.ai_level]}</span>
            <div className="flex gap-2">
              <button className="btn-secondary !min-h-9 !px-2" onClick={() => void update(item)} title="Editar">
                <Pencil size={16} />
              </button>
              <button className="btn-secondary !min-h-9 !px-2" onClick={() => void remove(item.id)} title="Eliminar">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
