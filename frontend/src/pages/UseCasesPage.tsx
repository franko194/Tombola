import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { resources } from "../api/resources";
import type { Session, UseCase } from "../types";

export function UseCasesPage({ session }: { session: Session }) {
  const [useCases, setUseCases] = useState<UseCase[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  async function load() {
    setUseCases(await resources.useCases.list(session.id));
  }

  useEffect(() => {
    void load();
  }, [session.id]);

  async function add() {
    await resources.useCases.create(session.id, { title, description });
    setTitle("");
    setDescription("");
    await load();
  }

  async function update(item: UseCase) {
    const nextTitle = prompt("Titulo", item.title);
    if (!nextTitle) return;
    const nextDescription = prompt("Descripcion", item.description ?? "") ?? "";
    await resources.useCases.update(item.id, { title: nextTitle, description: nextDescription });
    await load();
  }

  async function remove(id: number) {
    if (!confirm("Eliminar caso de uso? Se limpiaran asignaciones si existian.")) return;
    await resources.useCases.remove(id);
    await load();
  }

  return (
    <section className="grid gap-5">
      <div className="lab-surface rounded-lg p-5">
        <h2 className="text-2xl font-black text-slate-950">Casos de uso</h2>
        <p className="mt-1 font-medium text-slate-600">Cada sesion parte con casos nuevos y no reutiliza sorteos anteriores.</p>
        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input className="input" placeholder="Titulo del caso" value={title} onChange={(event) => setTitle(event.target.value)} />
          <input className="input" placeholder="Descripcion breve" value={description} onChange={(event) => setDescription(event.target.value)} />
          <button className="btn-primary" disabled={!title.trim()} onClick={add}>
            <Plus size={18} />
            Agregar
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        {useCases.map((item) => (
          <div key={item.id} className="lab-surface rounded-lg p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-950">{item.title}</h3>
                {item.description ? <p className="mt-1 font-medium text-slate-600">{item.description}</p> : null}
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary !min-h-9 !px-2" onClick={() => void update(item)} title="Editar">
                  <Pencil size={16} />
                </button>
                <button className="btn-secondary !min-h-9 !px-2" onClick={() => void remove(item.id)} title="Eliminar">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
