
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
      games: {
        Row: {
          id: string // uuid
          created_at: string // timestamptz
          updated_at: string // timestamptz
          game_phase: string // text; e.g., 'lobby', 'category_selection', etc.
          current_round: number // integer
          current_judge_id: string | null // uuid, FK to players.id
          current_scenario_id: string | null // uuid, FK to scenarios.id
          ready_player_order: string[] | null // uuid[]
          last_round_winner_player_id: string | null // uuid, FK to players.id
          last_round_winning_card_text: string | null // text
          overall_winner_player_id: string | null // uuid, FK to players.id
          used_scenarios: string[] | null // uuid[]
          used_responses: string[] | null // uuid[]
          transition_state: string // text, e.g., 'idle', 'starting_game'
          transition_message: string | null // text
          room_code: string // varchar(6), unique room identifier
          is_public: boolean // boolean, whether game appears in public browser
          max_players: number // integer, maximum players allowed (2-20)
          room_name: string | null // text, optional custom room name
          created_by_player_id: string | null // uuid, FK to players.id, room creator
        }
        Insert: {
          id?: string // uuid, defaults to gen_random_uuid()
          created_at?: string // timestamptz, defaults to now()
          updated_at?: string // timestamptz, defaults to now()
          game_phase: string // text
          current_round?: number // integer, defaults to 0
          current_judge_id?: string | null // uuid
          current_scenario_id?: string | null // uuid
          ready_player_order?: string[] | null // uuid[]
          last_round_winner_player_id?: string | null // uuid
          last_round_winning_card_text?: string | null // text
          overall_winner_player_id?: string | null // uuid
          used_scenarios?: string[] | null // uuid[], defaults to {}
          used_responses?: string[] | null // uuid[], defaults to {}
          transition_state?: string // text, defaults to 'idle'
          transition_message?: string | null // text
          room_code: string // varchar(6), unique room identifier
          is_public?: boolean // boolean, defaults to true
          max_players?: number // integer, defaults to 10
          room_name?: string | null // text, optional custom room name
          created_by_player_id?: string | null // uuid, room creator
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          game_phase?: string
          current_round?: number
          current_judge_id?: string | null
          current_scenario_id?: string | null
          ready_player_order?: string[] | null
          last_round_winner_player_id?: string | null
          last_round_winning_card_text?: string | null
          overall_winner_player_id?: string | null
          used_scenarios?: string[] | null
          used_responses?: string[] | null
          transition_state?: string
          transition_message?: string | null
          room_code?: string
          is_public?: boolean
          max_players?: number
          room_name?: string | null
          created_by_player_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_current_judge_id_fkey"
            columns: ["current_judge_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_current_scenario_id_fkey"
            columns: ["current_scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_last_round_winner_player_id_fkey"
            columns: ["last_round_winner_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_overall_winner_player_id_fkey"
            columns: ["overall_winner_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          }
        ]
      }
      players: {
        Row: {
          id: string // uuid
          created_at: string // timestamptz
          name: string // text
          game_id: string // uuid, FK to games.id
          is_judge: boolean // boolean
          joined_at: string // timestamptz
          avatar: string // text
          score: number // integer
          is_ready: boolean // boolean
        }
        Insert: {
          id?: string // uuid, defaults to gen_random_uuid()
          created_at?: string // timestamptz, defaults to now()
          name: string // text
          game_id: string // uuid
          is_judge?: boolean // boolean, defaults to false
          joined_at?: string // timestamptz, defaults to now()
          avatar: string // text
          score?: number // integer, defaults to 0
          is_ready?: boolean // boolean, defaults to false
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          game_id?: string
          is_judge?: boolean
          joined_at?: string
          avatar?: string
          score?: number
          is_ready?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          }
        ]
      }
      scenarios: {
        Row: {
          id: string // uuid
          created_at: string // timestamptz
          text: string // text
          category: string // text
        }
        Insert: {
          id?: string // uuid, defaults to gen_random_uuid()
          created_at?: string // timestamptz, defaults to now()
          text: string // text
          category: string // text
        }
        Update: {
          id?: string
          created_at?: string
          text?: string
          category?: string
        }
        Relationships: []
      }
      response_cards: {
        Row: {
          id: string // uuid
          created_at: string // timestamptz
          text: string // text
          is_active: boolean // boolean
          author_player_id: string | null // uuid, FK to players.id
          author_name: string | null // text
        }
        Insert: {
          id?: string // uuid, defaults to gen_random_uuid()
          created_at?: string // timestamptz, defaults to now()
          text: string // text
          is_active?: boolean // boolean, defaults to true
          author_player_id?: string | null // uuid
          author_name?: string | null // text
        }
        Update: {
          id?: string
          created_at?: string
          text?: string
          is_active?: boolean
          author_player_id?: string | null
          author_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_response_cards_author_player"
            columns: ["author_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_hands: {
        Row: {
          id: string // uuid
          created_at: string // timestamptz
          player_id: string // uuid, FK to players.id
          game_id: string // uuid, FK to games.id
          response_card_id: string // uuid, FK to response_cards.id
          is_new: boolean // boolean
        }
        Insert: {
          id?: string // uuid, defaults to gen_random_uuid()
          created_at?: string // timestamptz, defaults to now()
          player_id: string // uuid
          game_id: string // uuid
          response_card_id: string // uuid
          is_new?: boolean // boolean, defaults to false
        }
        Update: {
          id?: string
          created_at?: string
          player_id?: string
          game_id?: string
          response_card_id?: string
          is_new?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "player_hands_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_hands_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_hands_response_card_id_fkey"
            columns: ["response_card_id"]
            isOneToOne: false
            referencedRelation: "response_cards"
            referencedColumns: ["id"]
          }
        ]
      }
      responses: { // Player submissions
        Row: {
          id: string // uuid
          created_at: string // timestamptz
          player_id: string // uuid, FK to players.id
          response_card_id: string | null // uuid, FK to response_cards.id
          submitted_text: string | null // text
          game_id: string // uuid, FK to games.id
          round_number: number // integer
        }
        Insert: {
          id?: string // uuid, defaults to gen_random_uuid()
          created_at?: string // timestamptz, defaults to now()
          player_id: string // uuid
          response_card_id?: string | null // uuid
          submitted_text?: string | null // text
          game_id: string // uuid
          round_number: number // integer
        }
        Update: {
          id?: string
          created_at?: string
          player_id?: string
          response_card_id?: string | null
          submitted_text?: string | null
          game_id?: string
          round_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "responses_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_response_card_id_fkey"
            columns: ["response_card_id"]
            isOneToOne: false
            referencedRelation: "response_cards"
            referencedColumns: ["id"]
          }
        ]
      }
      winners: { // Historical round winners
        Row: {
          id: string // uuid
          created_at: string // timestamptz
          game_id: string // uuid, FK to games.id
          round_number: number // integer
          winner_player_id: string // uuid, FK to players.id
          winning_response_card_id: string // uuid, FK to response_cards.id
        }
        Insert: {
          id?: string // uuid, defaults to gen_random_uuid()
          created_at?: string // timestamptz, defaults to now()
          game_id: string // uuid
          round_number: number // integer
          winner_player_id: string // uuid
          winning_response_card_id: string // uuid
        }
        Update: {
          id?: string
          created_at?: string
          game_id?: string
          round_number?: number
          winner_player_id?: string
          winning_response_card_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "winners_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "winners_winner_player_id_fkey"
            columns: ["winner_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "winners_winning_response_card_id_fkey"
            columns: ["winning_response_card_id"]
            isOneToOne: false
            referencedRelation: "response_cards"
            referencedColumns: ["id"]
          }
        ]
      }
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

// Helper types for convenience, often included by Supabase CLI
export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
        Database["public"]["Views"])
    ? (Database["public"]["Tables"] &
        Database["public"]["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof Database["public"]["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
    ? Database["public"]["Enums"][PublicEnumNameOrOptions]
    : never

    
