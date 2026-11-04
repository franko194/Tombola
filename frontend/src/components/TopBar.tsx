import { CalendarDays, FolderOpen, LogOut, Menu, Undo2, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type AppView = "sessions" | "clients" | "organizers";

type Props = {
  email: string;
  isAdmin: boolean;
  view: AppView;
  openSessionName: string | null;
  onOpenSessions: () => void;
  onResumeSession: () => void;
  onOpenClients: () => void;
  onOpenOrganizers: () => void;
  onLogout: () => void;
};

type MenuItemProps = {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
};

function MenuItem({ icon, label, active, onClick }: MenuItemProps) {
  return (
    <button
      role="menuitem"
      className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-bold transition ${
        active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
      }`}
      onClick={onClick}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

export function TopBar({ email, isAdmin, view, openSessionName, onOpenSessions, onResumeSession, onOpenClients, onOpenOrganizers, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function go(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <header className="relative z-30 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2">
        <div ref={menuRef} className="relative flex items-center gap-3">
          <button
            className="btn-secondary !min-h-10 !px-3"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">IA Friday</span>

          {open ? (
            <nav role="menu" className="absolute left-0 top-12 grid w-72 max-w-[calc(100vw-2rem)] gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
              {openSessionName && view !== "sessions" ? (
                <MenuItem icon={<Undo2 size={18} />} label={`Volver a «${openSessionName}»`} onClick={() => go(onResumeSession)} />
              ) : null}
              <MenuItem
                icon={<FolderOpen size={18} />}
                label="Sesiones"
                active={view === "sessions" && !openSessionName}
                onClick={() => go(onOpenSessions)}
              />
              <MenuItem icon={<CalendarDays size={18} />} label="Calendario de clientes" active={view === "clients"} onClick={() => go(onOpenClients)} />
              {isAdmin ? (
                <MenuItem icon={<Users size={18} />} label="Organizadores" active={view === "organizers"} onClick={() => go(onOpenOrganizers)} />
              ) : null}
            </nav>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden max-w-[16rem] truncate text-sm font-semibold text-slate-500 sm:block" title={email}>
            {email}
          </span>
          <button className="btn-secondary !min-h-10" onClick={onLogout}>
            <LogOut size={18} />
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
