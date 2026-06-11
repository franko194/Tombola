import { RefreshCw, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { resources } from "../api/resources";
import type { Session, TeamsResponse } from "../types";

export function TeamsPage({ session }: { session: Session }) {
  const [numberOfTeams, setNumberOfTeams] = useState(3);
  const [data, setData] = useState<TeamsResponse | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setData(await resources.teams.list(session.id));
  }

  useEffect(() => {
    void load();
  }, [session.id]);

  async function generate() {
    try {
      setError("");
      setData(await resources.teams.generate(session.id, numberOfTeams));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="grid gap-5">
      <div className="lab-surface rounded-lg p-5">
        <h2 className="text-2xl font-black text-slate-950">Generacion de equipos</h2>
        <p className="mt-1 font-medium text-slate-600">Snake Draft balancea la experiencia para evitar concentrar expertos o principiantes.</p>
        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-end">
          <label className="grid gap-2 text-sm font-bold text-slate-600">
            Numero de equipos
            <input className="input w-48" type="number" min={1} value={numberOfTeams} onChange={(event) => setNumberOfTeams(Number(event.target.value))} />
          </label>
          <button className="btn-primary" onClick={generate}>
            <RefreshCw size={18} />
            Generar equipos
          </button>
        </div>
        {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 font-semibold text-red-700">{error}</p> : null}
      </div>

      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="lab-surface rounded-lg p-4">
              <p className="text-sm font-bold text-slate-500">Promedio mas alto</p>
              <p className="text-3xl font-black text-slate-950">{data.balance.highest_average}</p>
            </div>
            <div className="lab-surface rounded-lg p-4">
              <p className="text-sm font-bold text-slate-500">Promedio mas bajo</p>
              <p className="text-3xl font-black text-slate-950">{data.balance.lowest_average}</p>
            </div>
            <div className="lab-surface rounded-lg p-4">
              <p className="text-sm font-bold text-slate-500">Brecha</p>
              <p className="text-3xl font-black text-teal-800">{data.balance.average_gap}</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.teams.map((team) => (
              <div key={team.id} className="lab-surface rounded-lg p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xl font-black text-slate-950">{team.name}</h3>
                  <Users className="text-teal-700" size={20} />
                </div>
                <p className="text-sm font-bold text-slate-500">Promedio {team.average_ai_level} | Score {team.total_ai_score}</p>
                <ul className="mt-4 grid gap-2">
                  {team.members.map((member) => (
                    <li key={member.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                      <span className="font-bold text-slate-800">{member.name}</span>
                      <span className="text-sm font-black text-teal-800">{member.ai_level}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
