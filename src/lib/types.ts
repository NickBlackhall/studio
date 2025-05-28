
export interface Player {
  id: string;
  name: string;
  avatar: string;
  score: number;
  isJudge: boolean;
  hand: string[]; // Array of response card texts
  isReady: boolean; // New: To track if a player is ready in the lobby
}

export interface Scenario {
  id: string; // Could be a UUID from Supabase
  category: string;
  text: string;
}

export interface ResponseCard {
  id: string; // Could be a UUID from Supabase
  text: string;
}

export interface Submission {
  playerId: string;
  cardText: string;
  // cardId: string; // Could be useful if cards have unique IDs from Supabase
}

export type GamePhase =
  | "lobby" // New: For players waiting and getting ready
  | "category_selection"
  | "player_submission"
  | "judging"
  | "winner_announcement"
  | "game_over";

export interface GameState {
  // These might be stored in a single 'game' row in Supabase
  id?: string; // Unique ID for this game session if storing multiple games
  players: Player[]; // This might become a list of player IDs, with player data in a separate table
  currentRound: number;
  currentJudgeId: string | null;
  currentScenario: Scenario | null; // Or currentScenarioId
  gamePhase: GamePhase;
  submissions: Submission[]; // Or submission IDs
  lastWinner?: { player: Player; cardText: string }; // May store player ID and card text/ID
  winningPlayerId?: string | null;
  
  // Data primarily fetched from Supabase now, not stored directly in this JS object long-term
  categories: string[]; // Will be derived from Supabase scenarios
  // scenariosByCategory: Record<string, Scenario[]>; // Will be fetched as needed
  // responseCardsDeck: string[]; // Deck management will change with Supabase

  // New for lobby and ready system
  readyPlayerOrder: string[]; // Array of player IDs in the order they became ready
}

export const POINTS_TO_WIN = 3; // Changed to 3 for faster testing, can be 5 later
export const CARDS_PER_HAND = 5; // Changed as per your request

    