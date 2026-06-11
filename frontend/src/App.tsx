import { useEffect, useState } from "react";
import { Layout } from "./components/Layout";
import { DashboardPage } from "./pages/DashboardPage";
import { ParticipantsPage } from "./pages/ParticipantsPage";
import { ResultsPage } from "./pages/ResultsPage";
import { SessionsPage } from "./pages/SessionsPage";
import { TeamsPage } from "./pages/TeamsPage";
import { TombolaPage } from "./pages/TombolaPage";
import { UseCasesPage } from "./pages/UseCasesPage";
import type { PageKey, Session } from "./types";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [page, setPage] = useState<PageKey>("dashboard");

  useEffect(() => {
    const saved = window.localStorage.getItem("ia-friday-session");
    if (saved) {
      setSession(JSON.parse(saved) as Session);
    }
  }, []);

  function selectSession(next: Session) {
    setSession(next);
    setPage("dashboard");
    window.localStorage.setItem("ia-friday-session", JSON.stringify(next));
  }

  function returnToSessions() {
    setSession(null);
    setPage("dashboard");
    window.localStorage.removeItem("ia-friday-session");
  }

  if (!session) {
    return <SessionsPage onSelect={selectSession} />;
  }

  return (
    <Layout session={session} page={page} onPageChange={setPage} onBackToSessions={returnToSessions}>
      {page === "dashboard" && <DashboardPage session={session} onPageChange={setPage} />}
      {page === "participants" && <ParticipantsPage session={session} />}
      {page === "usecases" && <UseCasesPage session={session} />}
      {page === "teams" && <TeamsPage session={session} />}
      {page === "tombola" && <TombolaPage session={session} onPageChange={setPage} />}
      {page === "results" && <ResultsPage session={session} onSessionUpdate={selectSession} onReturnHome={returnToSessions} />}
    </Layout>
  );
}
