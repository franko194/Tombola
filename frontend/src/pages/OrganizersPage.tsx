import { ArrowLeft, KeyRound, ShieldCheck, UserPlus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { resources } from "../api/resources";
import type { Organizer } from "../types";

const MIN_PASSWORD_LENGTH = 8;

export function OrganizersPage({ currentEmail, onBack }: { currentEmail: string; onBack: () => void }) {
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [makeAdmin, setMakeAdmin] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [passwordFor, setPasswordFor] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");

  async function load() {
    try {
      setError("");
      setOrganizers(await resources.organizers.list());
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    // Messages render at the top of the page, so bring them into view after an action.
    if (notice || error) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [notice, error]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      const created = await resources.organizers.create({ email, password, is_admin: makeAdmin });
      setNotice(`Listo: ${created.email} ya puede iniciar sesion. Comparte la contrasena por un canal privado.`);
      setEmail("");
      setPassword("");
      setMakeAdmin(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function update(organizer: Organizer, changes: Parameters<typeof resources.organizers.update>[1], message: string) {
    setError("");
    setNotice("");
    try {
      await resources.organizers.update(organizer.id, changes);
      setNotice(message);
      await load();
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    }
  }

  function openPasswordForm(organizer: Organizer) {
    setError("");
    setNotice("");
    setNewPassword("");
    setPasswordFor(passwordFor === organizer.id ? null : organizer.id);
  }

  async function savePassword(event: FormEvent<HTMLFormElement>, organizer: Organizer) {
    event.preventDefault();
    const saved = await update(organizer, { password: newPassword }, `Contrasena cambiada para ${organizer.email}.`);
    if (saved) {
      setPasswordFor(null);
      setNewPassword("");
    }
  }

  function toggleActive(organizer: Organizer) {
    const next = !organizer.active;
    const message = next ? `${organizer.email} reactivado.` : `${organizer.email} desactivado.`;
    if (!next && !confirm(`Desactivar el acceso de ${organizer.email}?`)) return;
    void update(organizer, { active: next }, message);
  }

  function toggleAdmin(organizer: Organizer) {
    const next = !organizer.is_admin;
    const message = next ? `${organizer.email} ahora es administrador.` : `${organizer.email} ya no es administrador.`;
    void update(organizer, { is_admin: next }, message);
  }

  return (
    <main className="min-h-screen bg-[#eef3f8] px-4 py-8">
      <section className="mx-auto grid max-w-4xl gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-700">Administracion</p>
            <h1 className="mt-1 text-3xl font-black text-slate-950">Organizadores</h1>
          </div>
          <button className="btn-secondary" onClick={onBack}>
            <ArrowLeft size={18} />
            Volver
          </button>
        </div>

        {error ? <div className="rounded-lg bg-red-50 p-3 font-semibold text-red-700">{error}</div> : null}
        {notice ? <div className="rounded-lg bg-emerald-50 p-3 font-semibold text-emerald-800">{notice}</div> : null}

        <form className="lab-surface grid gap-4 rounded-lg p-5" onSubmit={create}>
          <div className="flex items-center gap-3">
            <UserPlus className="text-teal-700" />
            <h2 className="text-xl font-black text-slate-900">Crear organizador</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-slate-600">
              Correo
              <input className="input" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-600">
              Contrasena inicial
              <input
                className="input"
                type="password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
            <input type="checkbox" checked={makeAdmin} onChange={(event) => setMakeAdmin(event.target.checked)} />
            Dar rol de administrador
          </label>
          <button className="btn-primary w-full md:w-auto md:justify-self-start" type="submit">
            Crear organizador
          </button>
        </form>

        <div className="lab-surface grid gap-3 rounded-lg p-5">
          {organizers.map((organizer) => {
            const isMe = organizer.email === currentEmail;
            return (
              <article key={organizer.id} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="font-black text-slate-950">
                    {organizer.email} {isMe ? <span className="text-sm font-semibold text-slate-500">(tu cuenta)</span> : null}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs font-bold">
                    <span className={organizer.active ? "text-emerald-700" : "text-red-700"}>
                      {organizer.active ? "Activo" : "Desactivado"}
                    </span>
                    {organizer.is_admin ? <span className="text-teal-700">Administrador</span> : null}
                    {!organizer.has_password ? <span className="text-amber-700">Sin contrasena</span> : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary" onClick={() => openPasswordForm(organizer)}>
                    <KeyRound size={16} />
                    Contrasena
                  </button>
                  <button className="btn-secondary" disabled={isMe} onClick={() => toggleAdmin(organizer)} title={isMe ? "No puedes cambiar tu propio rol" : ""}>
                    <ShieldCheck size={16} />
                    {organizer.is_admin ? "Quitar admin" : "Hacer admin"}
                  </button>
                  <button className="btn-danger" disabled={isMe} onClick={() => toggleActive(organizer)} title={isMe ? "No puedes desactivarte a ti mismo" : ""}>
                    {organizer.active ? "Desactivar" : "Activar"}
                  </button>
                </div>
                {passwordFor === organizer.id ? (
                  <form className="flex flex-wrap items-end gap-2 md:col-span-2" onSubmit={(event) => void savePassword(event, organizer)}>
                    <label className="grid flex-1 gap-1 text-sm font-bold text-slate-600">
                      Nueva contrasena (minimo {MIN_PASSWORD_LENGTH} caracteres)
                      <input
                        className="input"
                        type="password"
                        required
                        minLength={MIN_PASSWORD_LENGTH}
                        autoComplete="new-password"
                        autoFocus
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                      />
                    </label>
                    <button className="btn-primary" type="submit">
                      Guardar
                    </button>
                    <button className="btn-secondary" type="button" onClick={() => setPasswordFor(null)}>
                      Cancelar
                    </button>
                  </form>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
