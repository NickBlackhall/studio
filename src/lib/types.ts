
export interface Player {
  id: string;
  name: string;
  avatar: string;
  score: number;
  isJudge: boolean;
  hand: string[]; // Array of response card texts
}

export interface Scenario {
  id: string;
  category: string;
  text: string;
}

export interface ResponseCard {
  id: string;
  text: string;
}

export interface Submission {
  playerId: string;
  cardText: string;
  // cardId: string; // Could be useful if cards have unique IDs
}

export type GamePhase =
  | "welcome"
  | "waiting_for_players"
  | "category_selection"
  | "player_submission"
  | "judging"
  | "winner_announcement"
  | "game_over";

export interface GameState {
  players: Player[];
  currentRound: number;
  currentJudgeId: string | null;
  currentScenario: Scenario | null;
  gamePhase: GamePhase;
  submissions: Submission[];
  lastWinner?: { player: Player; cardText: string };
  winningPlayerId?: string | null; // Player who won the game
  categories: string[];
  scenariosByCategory: Record<string, Scenario[]>;
  responseCardsDeck: string[];
}

export const POINTS_TO_WIN = 5; // Example win condition
export const CARDS_PER_HAND = 7; // Example hand size
