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
      cameras: {
        Row: {
          camera_type: string
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          name: string
          notes: string | null
          source_url: string | null
          status: string
          zone_id: string | null
        }
        Insert: {
          camera_type?: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          notes?: string | null
          source_url?: string | null
          status?: string
          zone_id?: string | null
        }
        Update: {
          camera_type?: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          notes?: string | null
          source_url?: string | null
          status?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cameras_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      datasets: {
        Row: {
          created_at: string
          id: string
          images_count: number | null
          licence: string | null
          name: string
          notes: string | null
          purpose: string | null
          source_url: string
          status: string
          videos_count: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          images_count?: number | null
          licence?: string | null
          name: string
          notes?: string | null
          purpose?: string | null
          source_url: string
          status?: string
          videos_count?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          images_count?: number | null
          licence?: string | null
          name?: string
          notes?: string | null
          purpose?: string | null
          source_url?: string
          status?: string
          videos_count?: number | null
        }
        Relationships: []
      }
      evidence: {
        Row: {
          caption: string | null
          captured_at: string
          id: string
          image_url: string | null
          incident_id: string | null
          severity_score: number
          water_coverage: number
        }
        Insert: {
          caption?: string | null
          captured_at?: string
          id?: string
          image_url?: string | null
          incident_id?: string | null
          severity_score?: number
          water_coverage?: number
        }
        Update: {
          caption?: string | null
          captured_at?: string
          id?: string
          image_url?: string | null
          incident_id?: string | null
          severity_score?: number
          water_coverage?: number
        }
        Relationships: [
          {
            foreignKeyName: "evidence_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      frame_metrics: {
        Row: {
          camera_id: string | null
          created_at: string
          id: string
          incident_id: string | null
          people_count: number
          road_coverage: number
          severity_score: number
          source_label: string | null
          texture_score: number
          vehicle_count: number
          verdict: string
          water_coverage: number
        }
        Insert: {
          camera_id?: string | null
          created_at?: string
          id?: string
          incident_id?: string | null
          people_count?: number
          road_coverage?: number
          severity_score?: number
          source_label?: string | null
          texture_score?: number
          vehicle_count?: number
          verdict?: string
          water_coverage?: number
        }
        Update: {
          camera_id?: string | null
          created_at?: string
          id?: string
          incident_id?: string | null
          people_count?: number
          road_coverage?: number
          severity_score?: number
          source_label?: string | null
          texture_score?: number
          vehicle_count?: number
          verdict?: string
          water_coverage?: number
        }
        Relationships: [
          {
            foreignKeyName: "frame_metrics_camera_id_fkey"
            columns: ["camera_id"]
            isOneToOne: false
            referencedRelation: "cameras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frame_metrics_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          ai_summary: string | null
          ai_verified: boolean
          archived_at: string | null
          camera_id: string | null
          created_at: string
          deleted_at: string | null
          first_seen: string
          id: string
          last_seen: string
          model_version: string
          people_count: number
          persistence_seconds: number
          resolution_note: string | null
          resolved_at: string | null
          road_blocked_ratio: number
          severity_band: string
          severity_score: number
          status: string
          vehicle_count: number
          water_coverage: number
          zone_id: string | null
        }
        Insert: {
          ai_summary?: string | null
          ai_verified?: boolean
          archived_at?: string | null
          camera_id?: string | null
          created_at?: string
          deleted_at?: string | null
          first_seen?: string
          id?: string
          last_seen?: string
          model_version?: string
          people_count?: number
          persistence_seconds?: number
          resolution_note?: string | null
          resolved_at?: string | null
          road_blocked_ratio?: number
          severity_band?: string
          severity_score?: number
          status?: string
          vehicle_count?: number
          water_coverage?: number
          zone_id?: string | null
        }
        Update: {
          ai_summary?: string | null
          ai_verified?: boolean
          archived_at?: string | null
          camera_id?: string | null
          created_at?: string
          deleted_at?: string | null
          first_seen?: string
          id?: string
          last_seen?: string
          model_version?: string
          people_count?: number
          persistence_seconds?: number
          resolution_note?: string | null
          resolved_at?: string | null
          road_blocked_ratio?: number
          severity_band?: string
          severity_score?: number
          status?: string
          vehicle_count?: number
          water_coverage?: number
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_camera_id_fkey"
            columns: ["camera_id"]
            isOneToOne: false
            referencedRelation: "cameras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      model_evals: {
        Row: {
          created_at: string
          id: string
          metric_name: string
          metric_value: number
          model_version: string
          notes: string | null
          sample_count: number | null
          split: string
        }
        Insert: {
          created_at?: string
          id?: string
          metric_name: string
          metric_value: number
          model_version: string
          notes?: string | null
          sample_count?: number | null
          split?: string
        }
        Update: {
          created_at?: string
          id?: string
          metric_name?: string
          metric_value?: number
          model_version?: string
          notes?: string | null
          sample_count?: number | null
          split?: string
        }
        Relationships: []
      }
      operator_actions: {
        Row: {
          action_type: string
          actor: string
          created_at: string
          id: string
          incident_id: string | null
          note: string | null
        }
        Insert: {
          action_type: string
          actor?: string
          created_at?: string
          id?: string
          incident_id?: string | null
          note?: string | null
        }
        Update: {
          action_type?: string
          actor?: string
          created_at?: string
          id?: string
          incident_id?: string | null
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operator_actions_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      zones: {
        Row: {
          created_at: string
          drainage_risk: string
          id: string
          lat: number
          lng: number
          name: string
          radius_m: number
          ward: string | null
        }
        Insert: {
          created_at?: string
          drainage_risk?: string
          id?: string
          lat: number
          lng: number
          name: string
          radius_m?: number
          ward?: string | null
        }
        Update: {
          created_at?: string
          drainage_risk?: string
          id?: string
          lat?: number
          lng?: number
          name?: string
          radius_m?: number
          ward?: string | null
        }
        Relationships: []
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
      is_operator: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "operator" | "viewer"
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
      app_role: ["admin", "operator", "viewer"],
    },
  },
} as const
