
export interface Player {
  id: string; // This will likely be the Supabase user ID or a generated UUID
  name: string;
  avatar: string;
  score: number;
  is_judge: boolean; // Column name often uses snake_case in DB
  hand: string[]; // Array of response card TEXTS. We'll fetch card IDs from Supabase later.
  is_ready: boolean; 
  // game_id?: string; // Foreign key if players are in a global table linked to a game
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
  player_id: string; // Foreign key to player
  card_text: string; 
  // scenario_id?: string; // Foreign key to scenario
  // game_id?: string; // Foreign key to game
}

export type GamePhase =
  | "lobby"
  | "category_selection"
  | "player_submission"
  | "judging"
  | "winner_announcement"
  | "game_over";

// This will represent a row in a 'games' table in Supabase
export interface Game {
  id: string; // Primary key for the game session (e.g., a short unique code or UUID)
  current_round: number;
  current_judge_id: string | null; // Foreign key to player
  current_scenario_id: string | null; // Foreign key to scenario
  game_phase: GamePhase;
  // submissions might be a separate table linking to game_id, player_id, card_id
  last_winner_player_id?: string | null;
  last_winner_card_text?: string | null;
  winning_player_id?: string | null;
  ready_player_order: string[]; // Array of player_ids in the order they became ready
  // players: Player[]; // Player data will be in its own table, linked by game_id if needed
  // categories: string[]; // Will be derived from Supabase scenarios
  // scenariosByCategory: Record<string, Scenario[]>; // Will be fetched as needed
  // responseCardsDeck: string[]; // Deck management will change with Supabase
  created_at?: string;
  updated_at?: string;
}


export const POINTS_TO_WIN = 3; 
export const CARDS_PER_HAND = 5;


// Placeholder for Supabase generated types. We will run a command to generate this.
// For now, it allows the createClient<Database> to compile.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      // We will define these based on your actual table names later
      // e.g., games: { Row: Game; Insert: Partial<Game>; Update: Partial<Game> };
      // e.g., players: { Row: Player; Insert: Partial<Player>; Update: Partial<Player> };
      // e.g., scenarios: { Row: Scenario; Insert: Partial<Scenario>; Update: Partial<Scenario> };
      // e.g., response_cards: { Row: ResponseCard; Insert: Partial<ResponseCard>; Update: Partial<ResponseCard> };
      // e.g., submissions: { Row: Submission; Insert: Partial<Submission>; Update: Partial<Submission> };
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
