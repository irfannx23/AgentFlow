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
      billing_transactions: {
        Row: { amount: number; created_at: string; currency: string; failure_reason: string | null; id: string; metadata: Json; owner_id: string; plan: string; provider: string; provider_payment_id: string | null; status: string; subscription_id: string | null; transaction_id: string; updated_at: string }
        Insert: { amount: number; created_at?: string; currency?: string; failure_reason?: string | null; id?: string; metadata?: Json; owner_id: string; plan: string; provider?: string; provider_payment_id?: string | null; status?: string; subscription_id?: string | null; transaction_id: string; updated_at?: string }
        Update: { amount?: number; created_at?: string; currency?: string; failure_reason?: string | null; id?: string; metadata?: Json; owner_id?: string; plan?: string; provider?: string; provider_payment_id?: string | null; status?: string; subscription_id?: string | null; transaction_id?: string; updated_at?: string }
        Relationships: [{ foreignKeyName: "billing_transactions_subscription_id_fkey"; columns: ["subscription_id"]; isOneToOne: false; referencedRelation: "subscriptions"; referencedColumns: ["id"] }]
      }
      subscriptions: {
        Row: { cancel_at_period_end: boolean; created_at: string; current_period_end: string | null; current_period_start: string | null; id: string; owner_id: string; plan: string; provider: string | null; provider_customer_id: string | null; provider_subscription_id: string | null; scheduled_plan: string | null; status: string; updated_at: string }
        Insert: { cancel_at_period_end?: boolean; created_at?: string; current_period_end?: string | null; current_period_start?: string | null; id?: string; owner_id?: string; plan?: string; provider?: string | null; provider_customer_id?: string | null; provider_subscription_id?: string | null; scheduled_plan?: string | null; status?: string; updated_at?: string }
        Update: { cancel_at_period_end?: boolean; created_at?: string; current_period_end?: string | null; current_period_start?: string | null; id?: string; owner_id?: string; plan?: string; provider?: string | null; provider_customer_id?: string | null; provider_subscription_id?: string | null; scheduled_plan?: string | null; status?: string; updated_at?: string }
        Relationships: []
      }
      automation_versions: {
        Row: { ai_reasoning: string | null; author: string; change_details: Json; change_summary: string; created_at: string; id: string; label: string; modified_artifacts: Json; owner_id: string; project_id: string; sequence: number; snapshot: Json; workflow_hash: string | null }
        Insert: { ai_reasoning?: string | null; author?: string; change_details?: Json; change_summary: string; created_at?: string; id?: string; label: string; modified_artifacts?: Json; owner_id?: string; project_id: string; sequence: number; snapshot: Json; workflow_hash?: string | null }
        Update: { ai_reasoning?: string | null; author?: string; change_details?: Json; change_summary?: string; created_at?: string; id?: string; label?: string; modified_artifacts?: Json; owner_id?: string; project_id?: string; sequence?: number; snapshot?: Json; workflow_hash?: string | null }
        Relationships: []
      }
      project_timeline: {
        Row: { created_at: string; description: string | null; event_type: string; id: string; metadata: Json; owner_id: string; project_id: string; title: string }
        Insert: { created_at?: string; description?: string | null; event_type: string; id?: string; metadata?: Json; owner_id?: string; project_id: string; title: string }
        Update: { created_at?: string; description?: string | null; event_type?: string; id?: string; metadata?: Json; owner_id?: string; project_id?: string; title?: string }
        Relationships: []
      }
      workflow_imports: {
        Row: { analysis: Json; created_at: string; id: string; owner_id: string; platform: string; project_id: string; source_file_name: string; source_payload: Json }
        Insert: { analysis?: Json; created_at?: string; id?: string; owner_id?: string; platform: string; project_id: string; source_file_name: string; source_payload: Json }
        Update: { analysis?: Json; created_at?: string; id?: string; owner_id?: string; platform?: string; project_id?: string; source_file_name?: string; source_payload?: Json }
        Relationships: []
      }
      automation_exports: {
        Row: { created_at: string; id: string; owner_id: string; payload: Json; platform: string; project_id: string; workflow_id: string; workflow_version: number }
        Insert: { created_at?: string; id?: string; owner_id?: string; payload: Json; platform: string; project_id: string; workflow_id: string; workflow_version: number }
        Update: { created_at?: string; id?: string; owner_id?: string; payload?: Json; platform?: string; project_id?: string; workflow_id?: string; workflow_version?: number }
        Relationships: []
      }
      automation_requirements: {
        Row: { answers: Json; business_problem: string; created_at: string; id: string; owner_id: string; project_id: string; status: string; updated_at: string }
        Insert: { answers?: Json; business_problem?: string; created_at?: string; id?: string; owner_id?: string; project_id: string; status?: string; updated_at?: string }
        Update: { answers?: Json; business_problem?: string; created_at?: string; id?: string; owner_id?: string; project_id?: string; status?: string; updated_at?: string }
        Relationships: []
      }
      automation_workflows: {
        Row: { created_at: string; deployment_guide: string | null; environment_variables: Json; explanation: string | null; graph: Json; id: string; name: string; owner_id: string; project_id: string; status: string; testing_checklist: Json; updated_at: string; version: number }
        Insert: { created_at?: string; deployment_guide?: string | null; environment_variables?: Json; explanation?: string | null; graph?: Json; id?: string; name: string; owner_id?: string; project_id: string; status?: string; testing_checklist?: Json; updated_at?: string; version?: number }
        Update: { created_at?: string; deployment_guide?: string | null; environment_variables?: Json; explanation?: string | null; graph?: Json; id?: string; name?: string; owner_id?: string; project_id?: string; status?: string; testing_checklist?: Json; updated_at?: string; version?: number }
        Relationships: []
      }
      connections: {
        Row: {
          created_at: string
          encrypted_credential: string
          id: string
          last_successful_test_at: string | null
          organization_id: string | null
          owner_id: string
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          encrypted_credential: string
          id?: string
          last_successful_test_at?: string | null
          organization_id?: string | null
          owner_id?: string
          provider: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          encrypted_credential?: string
          id?: string
          last_successful_test_at?: string | null
          organization_id?: string | null
          owner_id?: string
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          model: string | null
          owner_id: string
          project_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          model?: string | null
          owner_id?: string
          project_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          model?: string | null
          owner_id?: string
          project_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          completion_tokens: number | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json
          model: string | null
          owner_id: string
          project_id: string
          prompt_tokens: number | null
          role: string
        }
        Insert: {
          completion_tokens?: number | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json
          model?: string | null
          owner_id?: string
          project_id: string
          prompt_tokens?: number | null
          role: string
        }
        Update: {
          completion_tokens?: number | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          model?: string | null
          owner_id?: string
          project_id?: string
          prompt_tokens?: number | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_messages_conversation_scope_fkey"
            columns: ["conversation_id", "project_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id", "project_id", "owner_id"]
          },
          {
            foreignKeyName: "ai_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          metadata: Json
          owner_id: string
          project_id: string
          token_count: number | null
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          metadata?: Json
          owner_id?: string
          project_id: string
          token_count?: number | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          owner_id?: string
          project_id?: string
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_chunks_document_scope_fkey"
            columns: ["document_id", "project_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id", "project_id", "owner_id"]
          },
          {
            foreignKeyName: "knowledge_chunks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_documents: {
        Row: {
          content_hash: string | null
          created_at: string
          file_name: string
          id: string
          metadata: Json
          mime_type: string | null
          owner_id: string
          processed_at: string | null
          processing_error: string | null
          project_id: string
          size_bytes: number
          status: string
          storage_path: string
          updated_at: string
          version: number
        }
        Insert: {
          content_hash?: string | null
          created_at?: string
          file_name: string
          id?: string
          metadata?: Json
          mime_type?: string | null
          owner_id?: string
          processed_at?: string | null
          processing_error?: string | null
          project_id: string
          size_bytes?: number
          status?: string
          storage_path: string
          updated_at?: string
          version?: number
        }
        Update: {
          content_hash?: string | null
          created_at?: string
          file_name?: string
          id?: string
          metadata?: Json
          mime_type?: string | null
          owner_id?: string
          processed_at?: string | null
          processing_error?: string | null
          project_id?: string
          size_bytes?: number
          status?: string
          storage_path?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          is_personal: boolean
          name: string
          owner_id: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_personal?: boolean
          name: string
          owner_id?: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_personal?: boolean
          name?: string
          owner_id?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_roadmaps: {
        Row: {
          content: Json
          created_at: string
          description: string | null
          id: string
          owner_id: string
          project_id: string
          status: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          content?: Json
          created_at?: string
          description?: string | null
          id?: string
          owner_id?: string
          project_id: string
          status?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Update: {
          content?: Json
          created_at?: string
          description?: string | null
          id?: string
          owner_id?: string
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_roadmaps_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_suggestions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          kind: string
          owner_id: string
          payload: Json
          project_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          kind: string
          owner_id?: string
          payload?: Json
          project_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          owner_id?: string
          payload?: Json
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_suggestions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string | null
          owner_id: string
          stage: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id?: string | null
          owner_id?: string
          stage?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          owner_id?: string
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          name: string
          owner_id: string
          project_id: string | null
          system_prompt: string | null
          updated_at: string
          user_prompt: string
          variables: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          owner_id?: string
          project_id?: string | null
          system_prompt?: string | null
          updated_at?: string
          user_prompt: string
          variables?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          owner_id?: string
          project_id?: string | null
          system_prompt?: string | null
          updated_at?: string
          user_prompt?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "prompt_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_project_knowledge: {
        Args: { target_project_id: string; query_embedding: string; query_text: string; match_count?: number }
        Returns: Array<{ id: string; document_id: string; content: string; chunk_index: number; metadata: Json; semantic_score: number; keyword_score: number }>
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
