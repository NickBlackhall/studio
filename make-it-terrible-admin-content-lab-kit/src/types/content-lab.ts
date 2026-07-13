export type ContentCandidate = {
  id: string;
  session_id: string;
  source_scenario_id: string | null;
  original_response_text: string;
  response_text: string;
  character_count: number;
  premise_attack: string | null;
  portability: "high" | "medium" | "low" | null;
  spicy_level: "clean" | "dark" | "crude" | "explicit" | null;
  generation_rank: number | null;
  status: "generated" | "approved" | "rejected" | "needs_edit" | "published";
  admin_notes: string | null;
  rejection_reason: string | null;
  duplicate_score: number;
  duplicate_against: string | null;
  moderation_flagged: boolean;
  moderation_categories: Record<string, boolean>;
  created_at: string;
};

export type ScenarioOption = {
  id: string;
  text: string;
  category: string | null;
};
