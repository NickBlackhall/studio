
// We will rely on database.types.ts for the core database object.
// These types can be specific to application logic or client-side state if needed.

export interface PlayerClientState { // Example if we need client-specific player view models
  id: string;
  name: string;
  avatar: string;
  score: number;
  isJudge: boolean;
  hand: string[]; // Array of response card TEXTS (derived from player_hands and response_cards)
  isReady: boolean;
}

export interface ScenarioClientState { // Example
  id: string;
  category: string;
  text: string;
}

export interface SubmissionClientState { // Example
  playerId: string;
  cardText: string;
}

export type GamePhaseClientState =
  | "lobby"
  | "category_selection"
  | "player_submission"
  | "judging"
  | "winner_announcement"
  | "game_over";


export interface GameClientState { // Represents the overall game state as the client might see it
  gameId: string;
  players: PlayerClientState[];
  currentRound: number;
  currentJudgeId: string | null;
  currentScenario: ScenarioClientState | null;
  gamePhase: GamePhaseClientState;
  submissions: SubmissionClientState[]; // Player submissions for the current round
  
  // For displaying winner announcement
  lastWinner?: {
    player: PlayerClientState;
    cardText: string;
  };
  
  // For game over state
  winningPlayerId?: string | null; 

  // For lobby/category selection
  categories: string[]; // List of available categories
  
  // Not directly from DB Game row, but useful for client logic
  // scenariosByCategory?: Record<string, ScenarioClientState[]>;
  // responseCardsDeck?: string[]; // Deck is now managed server-side with DB
  readyPlayerOrder?: string[];
}


export const POINTS_TO_WIN = 3;
export const CARDS_PER_HAND = 5;

// The main Database types are now in src/lib/database.types.ts
// This keeps a clean separation.
// If you had Json or other generic types here, they can remain if used by client state,
// or be removed if database.types.ts covers them.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

