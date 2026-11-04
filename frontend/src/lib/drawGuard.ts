import { resources } from "../api/resources";

type ResetScope = "teams" | "assignments";

const resetMessages: Record<ResetScope, string> = {
  teams: "Esto borrará los equipos y el sorteo de casos ya generados. ¿Continuar?",
  assignments: "Esto borrará el sorteo de casos ya realizado. Los equipos se conservan. ¿Continuar?",
};

// Returns a warning when the change would wipe an existing draw, or null when there is nothing to lose.
export async function resetWarning(sessionId: number, scope: ResetScope): Promise<string | null> {
  try {
    if (scope === "teams") {
      const { teams } = await resources.teams.list(sessionId);
      return teams.length ? resetMessages.teams : null;
    }
    const { assignments } = await resources.results.get(sessionId);
    return assignments.length ? resetMessages.assignments : null;
  } catch {
    return "No pude verificar si hay un sorteo guardado. ¿Continuar de todos modos?";
  }
}
