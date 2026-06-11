export type SessionStatus = "draft" | "teams_generated" | "cases_assigned" | "completed" | "archived";

export type Session = {
  id: number;
  name: string;
  date: string;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
};

export type Participant = {
  id: number;
  session_id: number;
  name: string;
  ai_level: number;
};

export type UseCase = {
  id: number;
  session_id: number;
  title: string;
  description?: string | null;
};

export type TeamMember = {
  id: number;
  name: string;
  ai_level: number;
};

export type Team = {
  id: number;
  name: string;
  average_ai_level: number;
  total_ai_score: number;
  members: TeamMember[];
};

export type TeamsResponse = {
  teams: Team[];
  balance: {
    highest_average: number;
    lowest_average: number;
    average_gap: number;
  };
};

export type Assignment = {
  id: number;
  team_id: number;
  use_case_id: number;
  assigned_at: string;
  team_name: string;
  use_case_title: string;
  use_case_description?: string | null;
};

export type Results = {
  session: Session;
  teams: Team[];
  assignments: Assignment[];
};

export type PageKey = "dashboard" | "participants" | "usecases" | "teams" | "tombola" | "results";
