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

export type TeamInsights = {
  summary: string;
  strengths: string[];
  recommendations: string[];
  generated_by: "cloud" | "local" | string;
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

export type Judge = {
  id: number;
  name: string;
  email: string;
  organization?: string | null;
  active: boolean;
};

export type EvaluationCriterion = {
  id: number;
  session_id: number;
  name: string;
  weight: number;
  max_score: number;
  order: number;
  active: boolean;
};

export type SessionJudge = {
  judge: Judge;
  status: string;
  checked_in_at?: string | null;
  voted_teams: number;
};

export type TeamRanking = {
  team_id: number;
  team_name: string;
  average_score: number;
  votes_count: number;
  judges_count: number;
};

export type TeamJudgeFeedback = {
  team_id: number;
  team_name: string;
  summary: string;
  strengths: string[];
  opportunities: string[];
  final_recommendation: string;
  average_score: number;
  judge_comments: string[];
};

export type EvaluationReport = {
  session: Session;
  generated_by: "cloud" | "local" | string;
  executive_summary: string;
  learnings: string[];
  recommendations: string[];
  ranking: TeamRanking[];
  team_feedback: TeamJudgeFeedback[];
  markdown: string;
};

export type Evaluation = {
  id: number;
  session: Session;
  token: string;
  status: "open" | "closed" | string;
  judge_url: string;
  criteria: EvaluationCriterion[];
  judges: SessionJudge[];
  ranking: TeamRanking[];
};

export type PublicEvaluation = {
  session: Session;
  token: string;
  status: "open" | "closed" | string;
  criteria: EvaluationCriterion[];
  teams: Team[];
  assignments: Assignment[];
};

export type JudgeScore = {
  team_id: number;
  criterion_id: number;
  score: number;
  comment?: string | null;
};

export type PageKey = "dashboard" | "participants" | "usecases" | "teams" | "tombola" | "evaluation" | "results";
