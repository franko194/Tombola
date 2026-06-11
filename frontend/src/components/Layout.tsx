import { BarChart3, ClipboardCheck, ClipboardList, Home, Play, Presentation, Users } from "lucide-react";
import type { PageKey, Session } from "../types";
import { StatusBadge } from "./StatusBadge";

const tabs: Array<{ key: PageKey; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { key: "dashboard", label: "Dashboard", icon: Home },
  { key: "participants", label: "Participantes", icon: Users },
  { key: "usecases", label: "Casos", icon: ClipboardList },
  { key: "teams", label: "Equipos", icon: BarChart3 },
  { key: "tombola", label: "Tombola", icon: Play },
  { key: "evaluation", label: "Evaluacion", icon: ClipboardCheck },
  { key: "results", label: "Resultados", icon: Presentation },
];

type Props = {
  session: Session;
  page: PageKey;
  onPageChange: (page: PageKey) => void;
  onBackToSessions: () => void;
  children: React.ReactNode;
};

export function Layout({ session, page, onPageChange, onBackToSessions, children }: Props) {
  return (
    <div className="min-h-screen bg-[#eef3f8]">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">IA Friday</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-black text-slate-950">{session.name}</h1>
              <StatusBadge status={session.status} />
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-500">{session.date}</p>
          </div>
          <button className="btn-secondary" onClick={onBackToSessions}>
            Cambiar sesion
          </button>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[230px_1fr]">
        <nav className="lab-surface grid gap-2 rounded-lg p-3 lg:self-start">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.key === page;
            return (
              <button
                key={tab.key}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm font-bold transition ${
                  active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
                onClick={() => onPageChange(tab.key)}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </nav>
        <main>{children}</main>
      </div>
    </div>
  );
}
