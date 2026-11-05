import { useEffect, useState } from "react";
import { resources } from "./api/resources";
import { Layout } from "./components/Layout";
import { DashboardPage } from "./pages/DashboardPage";
import { EvaluationPage } from "./pages/EvaluationPage";
import { JudgePage } from "./pages/JudgePage";
import { LoginPage } from "./pages/LoginPage";
import { ClientsPage } from "./pages/ClientsPage";
import { HistoryPage } from "./pages/HistoryPage";
import { OrganizersPage } from "./pages/OrganizersPage";
import { ParticipantsPage } from "./pages/ParticipantsPage";
import { ResultsPage } from "./pages/ResultsPage";
import { SessionsPage } from "./pages/SessionsPage";
import { TopBar, type AppView } from "./components/TopBar";
import { TeamsPage } from "./pages/TeamsPage";
import { TombolaPage } from "./pages/TombolaPage";
import { UseCasesPage } from "./pages/UseCasesPage";
import type { PageKey, Session } from "./types";

const SESSION_STORAGE_KEY = "ia-friday-session";

function readSavedSession() {
  try {
    const saved = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!saved) return null;
    return JSON.parse(saved) as Session;
  } catch {
    try {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Some browsers can block storage. The app should still render.
    }
    return null;
  }
}

function saveSession(next: Session) {
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage is optional; keeping the session in React state is enough.
  }
}

function clearSavedSession() {
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore blocked storage.
  }
}

export default function App() {
  const judgeMatch = window.location.pathname.match(/^\/judge\/([^/]+)/);
  const judgeToken = judgeMatch ? decodeURIComponent(judgeMatch[1]) : null;
  const [session, setSession] = useState<Session | null>(null);
  const [page, setPage] = useState<PageKey>("dashboard");
  const [authState, setAuthState] = useState<"checking" | "in" | "out">("checking");
  const [view, setView] = useState<AppView>("sessions");
  const [me, setMe] = useState<{ email: string; is_admin: boolean } | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    if (judgeToken) return;
    const saved = readSavedSession();
    setSession(saved);
    resources.auth
      .me()
      .then((current) => {
        setMe(current);
        setAuthState("in");
      })
      .catch(() => {
        // A saved session means the organizer was working here before, so the login cookie must have expired.
        if (saved) setSessionExpired(true);
        setAuthState("out");
      });
  }, [judgeToken]);

  useEffect(() => {
    const expire = () => {
      setSessionExpired(true);
      setAuthState("out");
    };
    window.addEventListener("auth:expired", expire);
    return () => window.removeEventListener("auth:expired", expire);
  }, []);

  if (judgeToken) {
    return <JudgePage token={judgeToken} />;
  }

  function selectSession(next: Session) {
    setSession(next);
    setPage("dashboard");
    setView("sessions");
    saveSession(next);
  }

  function returnToSessions() {
    setSession(null);
    setPage("dashboard");
    clearSavedSession();
  }

  function logout() {
    void resources.auth.logout().finally(() => {
      returnToSessions();
      setView("sessions");
      setMe(null);
      setAuthState("out");
    });
  }

  if (authState === "checking") {
    return <div className="min-h-screen bg-[#eef3f8] p-5 font-bold text-slate-700">Cargando...</div>;
  }

  if (authState === "out") {
    return (
      <LoginPage
        notice={sessionExpired ? "Tu sesión expiró. Inicia sesión de nuevo para continuar." : undefined}
        onLogin={() => {
          resources.auth.me().then(setMe).catch(() => setMe(null));
          setSessionExpired(false);
          setAuthState("in");
        }}
      />
    );
  }

  // Only admins can open the organizers screen, even if the view state says so.
  const activeView: AppView = view === "organizers" && !me?.is_admin ? "sessions" : view;

  let content: React.ReactNode;
  if (activeView === "clients") {
    content = <ClientsPage />;
  } else if (activeView === "organizers" && me) {
    content = <OrganizersPage currentEmail={me.email} />;
  } else if (!session) {
    content = <SessionsPage onSelect={selectSession} />;
  } else {
    content = (
      <Layout session={session} page={page} onPageChange={setPage} onBackToSessions={returnToSessions}>
        {page === "dashboard" && <DashboardPage session={session} onPageChange={setPage} />}
        {page === "participants" && <ParticipantsPage session={session} />}
        {page === "usecases" && <UseCasesPage session={session} />}
        {page === "teams" && <TeamsPage session={session} />}
        {page === "tombola" && <TombolaPage session={session} onPageChange={setPage} />}
        {page === "evaluation" && <EvaluationPage session={session} />}
        {page === "results" && <ResultsPage session={session} onSessionUpdate={selectSession} onReturnHome={returnToSessions} />}
        {page === "history" && <HistoryPage session={session} />}
      </Layout>
    );
  }

  return (
    <>
      <TopBar
        email={me?.email ?? ""}
        isAdmin={Boolean(me?.is_admin)}
        view={activeView}
        openSessionName={session?.name ?? null}
        onOpenSessions={() => {
          returnToSessions();
          setView("sessions");
        }}
        onResumeSession={() => setView("sessions")}
        onOpenClients={() => setView("clients")}
        onOpenOrganizers={() => setView("organizers")}
        onLogout={logout}
      />
      {content}
    </>
  );
}
