import { useEffect, useState } from "react";
import { Layout } from "./components/Layout";
import { DashboardPage } from "./pages/DashboardPage";
import { EvaluationPage } from "./pages/EvaluationPage";
import { JudgePage } from "./pages/JudgePage";
import { ParticipantsPage } from "./pages/ParticipantsPage";
import { ResultsPage } from "./pages/ResultsPage";
import { SessionsPage } from "./pages/SessionsPage";
import { TeamsPage } from "./pages/TeamsPage";
import { TombolaPage } from "./pages/TombolaPage";
import { UseCasesPage } from "./pages/UseCasesPage";
import type { PageKey, Session } from "./types";

export default function App() {
  const judgeMatch = window.location.pathname.match(/^\/judge\/([^/]+)/);
  const judgeToken = judgeMatch ? decodeURIComponent(judgeMatch[1]) : null;
  const [session, setSession] = useState<Session | null>(null);
  const [page, setPage] = useState<PageKey>("dashboard");

  useEffect(() => {
    if (judgeToken) return;
    const saved = window.localStorage.getItem("ia-friday-session");
    if (saved) {
      try {
        setSession(JSON.parse(saved) as Session);
      } catch {
        window.localStorage.removeItem("ia-friday-session");
      }
    }
  }, [judgeToken]);

  if (judgeToken) {
    return <JudgePage token={judgeToken} />;
  }

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
      {page === "evaluation" && <EvaluationPage session={session} />}
      {page === "results" && <ResultsPage session={session} onSessionUpdate={selectSession} onReturnHome={returnToSessions} />}
    </Layout>
  );
}
