export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          created_at: string
          group_id: string
          id: string
          player_id: string
          present: boolean
          session_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          player_id: string
          present?: boolean
          session_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          player_id?: string
          present?: boolean
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          metadata: Json | null
          new_values: Json | null
          old_values: Json | null
          operation: string
          record_id: string | null
          table_name: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          operation: string
          record_id?: string | null
          table_name: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          operation?: string
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          block_number: number
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean
          name: string | null
          start_date: string | null
        }
        Insert: {
          block_number: number
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name?: string | null
          start_date?: string | null
        }
        Update: {
          block_number?: number
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name?: string | null
          start_date?: string | null
        }
        Relationships: []
      }
      coaches: {
        Row: {
          coach_name: string
          created_at: string
          id: string
        }
        Insert: {
          coach_name: string
          created_at?: string
          id?: string
        }
        Update: {
          coach_name?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      feed_posts: {
        Row: {
          coach_name: string | null
          content: string
          created_at: string
          id: string
          is_player_note: boolean
          player_id: string | null
          source_note_id: string | null
          updated_at: string
          written_by: string | null
        }
        Insert: {
          coach_name?: string | null
          content: string
          created_at?: string
          id?: string
          is_player_note?: boolean
          player_id?: string | null
          source_note_id?: string | null
          updated_at?: string
          written_by?: string | null
        }
        Update: {
          coach_name?: string | null
          content?: string
          created_at?: string
          id?: string
          is_player_note?: boolean
          player_id?: string | null
          source_note_id?: string | null
          updated_at?: string
          written_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_posts_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_posts_source_note_id_fkey"
            columns: ["source_note_id"]
            isOneToOne: false
            referencedRelation: "player_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      group_coaches: {
        Row: {
          coach_id: string
          created_at: string
          group_id: string
          id: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          group_id: string
          id?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_coaches_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_coaches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_players: {
        Row: {
          created_at: string
          group_id: string
          id: string
          player_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          player_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_players_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          block_id: string
          created_at: string
          group_number: number
          id: string
        }
        Insert: {
          block_id: string
          created_at?: string
          group_number: number
          id?: string
        }
        Update: {
          block_id?: string
          created_at?: string
          group_number?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      match_ratings: {
        Row: {
          carrying: number
          catching: number
          created_at: string
          group_id: string
          handling: number
          id: string
          iq: number
          kicking: number
          player_id: string
          rated_by: string | null
          rucking: number
          session_id: string
          tackling: number
        }
        Insert: {
          carrying?: number
          catching: number
          created_at?: string
          group_id: string
          handling?: number
          id?: string
          iq: number
          kicking: number
          player_id: string
          rated_by?: string | null
          rucking: number
          session_id: string
          tackling: number
        }
        Update: {
          carrying?: number
          catching?: number
          created_at?: string
          group_id?: string
          handling?: number
          id?: string
          iq?: number
          kicking?: number
          player_id?: string
          rated_by?: string | null
          rucking?: number
          session_id?: string
          tackling?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_ratings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_ratings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_ratings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      player_notes: {
        Row: {
          coach_name: string | null
          created_at: string
          id: string
          note: string
          player_id: string
          updated_at: string
          written_by: string | null
        }
        Insert: {
          coach_name?: string | null
          created_at?: string
          id?: string
          note: string
          player_id: string
          updated_at?: string
          written_by?: string | null
        }
        Update: {
          coach_name?: string | null
          created_at?: string
          id?: string
          note?: string
          player_id?: string
          updated_at?: string
          written_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_notes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          carrying: number
          catching: number
          created_at: string
          handling: number
          id: string
          iq: number
          kicking: number
          player_name: string
          repeatability: number
          rucking: number
          speed: number
          strength: number
          tackling: number
        }
        Insert: {
          carrying?: number
          catching?: number
          created_at?: string
          handling?: number
          id?: string
          iq?: number
          kicking?: number
          player_name: string
          repeatability?: number
          rucking?: number
          speed?: number
          strength?: number
          tackling?: number
        }
        Update: {
          carrying?: number
          catching?: number
          created_at?: string
          handling?: number
          id?: string
          iq?: number
          kicking?: number
          player_name?: string
          repeatability?: number
          rucking?: number
          speed?: number
          strength?: number
          tackling?: number
        }
        Relationships: []
      }
      session_player_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          override_group_id: string | null
          player_id: string
          session_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          override_group_id?: string | null
          player_id: string
          session_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          override_group_id?: string | null
          player_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_player_overrides_override_group_id_fkey"
            columns: ["override_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_player_overrides_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_player_overrides_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          block_id: string
          created_at: string
          id: string
          opponent: string | null
          session_date: string
          session_type: string
          venue: string | null
          week_number: number | null
        }
        Insert: {
          block_id: string
          created_at?: string
          id?: string
          opponent?: string | null
          session_date: string
          session_type: string
          venue?: string | null
          week_number?: number | null
        }
        Update: {
          block_id?: string
          created_at?: string
          id?: string
          opponent?: string | null
          session_date?: string
          session_type?: string
          venue?: string | null
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_ratings: {
        Row: {
          block_id: string
          carrying: number
          catching: number
          coach_names: string[]
          created_at: string
          entered_by: string | null
          entered_by_name: string | null
          group_number: number
          handling: number
          id: string
          iq: number
          kicking: number
          player_id: string
          player_name: string
          rucking: number
          session_id: string
          tackling: number
          updated_at: string
          week_number: number | null
        }
        Insert: {
          block_id: string
          carrying: number
          catching: number
          coach_names?: string[]
          created_at?: string
          entered_by?: string | null
          entered_by_name?: string | null
          group_number: number
          handling: number
          id?: string
          iq: number
          kicking: number
          player_id: string
          player_name: string
          rucking: number
          session_id: string
          tackling: number
          updated_at?: string
          week_number?: number | null
        }
        Update: {
          block_id?: string
          carrying?: number
          catching?: number
          coach_names?: string[]
          created_at?: string
          entered_by?: string | null
          entered_by_name?: string | null
          group_number?: number
          handling?: number
          id?: string
          iq?: number
          kicking?: number
          player_id?: string
          player_name?: string
          rucking?: number
          session_id?: string
          tackling?: number
          updated_at?: string
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "skill_ratings_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_ratings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_ratings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          coach_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          coach_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          coach_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "block_builder" | "coach"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["block_builder", "coach"],
    },
  },
} as const
