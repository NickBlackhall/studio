
// We will rely on database.types.ts for the core database object.
// These types can be specific to application logic or client-side state if needed.

export interface PlayerHandCard { // Explicit type for cards in a player's hand
  id: string;
  text: string;
  isNew?: boolean; // Flag for newly dealt cards
}

export interface PlayerClientState { 
  id: string;
  name: string;
  avatar: string;
  score: number;
  isJudge: boolean;
  hand: PlayerHandCard[]; // Array of PlayerHandCard objects
  isReady: boolean;
}

export interface ScenarioClientState { 
  id: string;
  category: string;
  text: string;
}

export interface SubmissionClientState { 
  playerId: string;
  cardId: string; // Keep track of the card ID submitted
  cardText: string;
}

export type GamePhaseClientState =
  | "lobby"
  | "category_selection"
  | "player_submission"
  | "judging"
  | "judge_approval_pending" // New phase for judge to approve custom card
  | "winner_announcement"
  | "game_over";


export interface GameClientState { 
  gameId: string;
  players: PlayerClientState[];
  currentRound: number;
  currentJudgeId: string | null;
  currentScenario: ScenarioClientState | null;
  gamePhase: GamePhaseClientState;
  submissions: SubmissionClientState[]; 
  
  lastWinner?: { // Used for display during winner_announcement and judge_approval_pending
    player: PlayerClientState;
    cardText: string;
  };
  
  winningPlayerId?: string | null; // Overall game winner

  categories: string[]; 
  
  ready_player_order: string[]; // Populated on client by parsing ready_player_order_str
  ready_player_order_str?: string; // Sent by server

  // Fields to temporarily hold custom card info for judge approval
  pendingCustomCardAuthorId?: string | null;
  pendingCustomCardText?: string | null;
}


export const POINTS_TO_WIN = 3;
export const CARDS_PER_HAND = 5;
export const MIN_PLAYERS_TO_START = 2;

export const ACTIVE_PLAYING_PHASES: GamePhaseClientState[] = [
  'category_selection', 
  'player_submission', 
  'judging',
  'judge_approval_pending'
];

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]


    
