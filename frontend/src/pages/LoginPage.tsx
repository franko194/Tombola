import { useState, type FormEvent } from "react";
import { resources } from "../api/resources";

export function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await resources.auth.login(email, password);
      onLogin();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef3f8] p-4">
      <section className="lab-surface grid w-full max-w-md gap-5 rounded-lg p-6">
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">IA Friday</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950">Acceso de organizadores</h1>
        </div>
        <form className="grid gap-4" onSubmit={submit}>
          <label className="grid gap-2 text-sm font-bold text-slate-600">
            Correo
            <input
              className="input"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-600">
            Contraseña
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error ? <p className="rounded-lg bg-red-50 p-3 font-semibold text-red-700">{error}</p> : null}
          <button className="btn-primary w-full" type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </section>
    </div>
  );
}
