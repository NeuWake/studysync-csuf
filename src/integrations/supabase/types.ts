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
      assignments: {
        Row: {
          assignment_type: Database["public"]["Enums"]["assignment_type"] | null
          canvas_assignment_id: string | null
          course_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          max_points: number | null
          title: string
          updated_at: string
        }
        Insert: {
          assignment_type?:
            | Database["public"]["Enums"]["assignment_type"]
            | null
          canvas_assignment_id?: string | null
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          max_points?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          assignment_type?:
            | Database["public"]["Enums"]["assignment_type"]
            | null
          canvas_assignment_id?: string | null
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          max_points?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      chatroom_invitations: {
        Row: {
          chatroom_id: string
          created_at: string
          id: string
          invited_by: string
          invited_user_id: string
          status: Database["public"]["Enums"]["invitation_status"]
          updated_at: string
        }
        Insert: {
          chatroom_id: string
          created_at?: string
          id?: string
          invited_by: string
          invited_user_id: string
          status?: Database["public"]["Enums"]["invitation_status"]
          updated_at?: string
        }
        Update: {
          chatroom_id?: string
          created_at?: string
          id?: string
          invited_by?: string
          invited_user_id?: string
          status?: Database["public"]["Enums"]["invitation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatroom_invitations_chatroom_id_fkey"
            columns: ["chatroom_id"]
            isOneToOne: false
            referencedRelation: "chatrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chatroom_members: {
        Row: {
          chatroom_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          chatroom_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          chatroom_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatroom_members_chatroom_id_fkey"
            columns: ["chatroom_id"]
            isOneToOne: false
            referencedRelation: "chatrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chatrooms: {
        Row: {
          assignment_id: string | null
          course_id: string | null
          created_at: string
          created_by: string
          id: string
          name: string | null
          type: Database["public"]["Enums"]["chatroom_type"]
        }
        Insert: {
          assignment_id?: string | null
          course_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          name?: string | null
          type?: Database["public"]["Enums"]["chatroom_type"]
        }
        Update: {
          assignment_id?: string | null
          course_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string | null
          type?: Database["public"]["Enums"]["chatroom_type"]
        }
        Relationships: [
          {
            foreignKeyName: "chatrooms_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatrooms_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          canvas_course_id: string | null
          code: string | null
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          canvas_course_id?: string | null
          code?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          canvas_course_id?: string | null
          code?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["friendship_status"] | null
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: Database["public"]["Enums"]["friendship_status"] | null
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["friendship_status"] | null
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          chatroom_id: string
          content: string
          edited_at: string | null
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          chatroom_id: string
          content: string
          edited_at?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          sent_at?: string
          user_id: string
        }
        Update: {
          chatroom_id?: string
          content?: string
          edited_at?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_chatroom_id_fkey"
            columns: ["chatroom_id"]
            isOneToOne: false
            referencedRelation: "chatrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accent_color: string | null
          avatar_url: string | null
          created_at: string
          dashboard_config: Json | null
          full_name: string | null
          grad_year: number | null
          help_points: number | null
          id: string
          major: string | null
          preferences: Json
          study_interests: string | null
          study_streaks: number | null
          theme_mode: string | null
          university: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          accent_color?: string | null
          avatar_url?: string | null
          created_at?: string
          dashboard_config?: Json | null
          full_name?: string | null
          grad_year?: number | null
          help_points?: number | null
          id?: string
          major?: string | null
          preferences?: Json
          study_interests?: string | null
          study_streaks?: number | null
          theme_mode?: string | null
          university?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          accent_color?: string | null
          avatar_url?: string | null
          created_at?: string
          dashboard_config?: Json | null
          full_name?: string | null
          grad_year?: number | null
          help_points?: number | null
          id?: string
          major?: string | null
          preferences?: Json
          study_interests?: string | null
          study_streaks?: number | null
          theme_mode?: string | null
          university?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      user_assignments: {
        Row: {
          assignment_id: string
          completed_at: string | null
          created_at: string
          id: string
          progress: number | null
          status: Database["public"]["Enums"]["assignment_status"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assignment_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          progress?: number | null
          status?: Database["public"]["Enums"]["assignment_status"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assignment_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          progress?: number | null
          status?: Database["public"]["Enums"]["assignment_status"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_assignments_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_canvas_credentials: {
        Row: {
          canvas_access_token: string | null
          canvas_base_url: string | null
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          canvas_access_token?: string | null
          canvas_base_url?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          canvas_access_token?: string | null
          canvas_base_url?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_courses: {
        Row: {
          course_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_events: {
        Row: {
          color: string | null
          course_id: string | null
          created_at: string
          description: string | null
          end_time: string | null
          event_type: Database["public"]["Enums"]["event_type"] | null
          id: string
          image_url: string | null
          is_canvas_synced: boolean | null
          is_recurring: boolean | null
          recurrence_rule: string | null
          start_time: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          course_id?: string | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          event_type?: Database["public"]["Enums"]["event_type"] | null
          id?: string
          image_url?: string | null
          is_canvas_synced?: boolean | null
          is_recurring?: boolean | null
          recurrence_rule?: string | null
          start_time: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          course_id?: string | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          event_type?: Database["public"]["Enums"]["event_type"] | null
          id?: string
          image_url?: string | null
          is_canvas_synced?: boolean | null
          is_recurring?: boolean | null
          recurrence_rule?: string | null
          start_time?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_events_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whiteboard_members: {
        Row: {
          id: string
          joined_at: string
          user_id: string
          whiteboard_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          user_id: string
          whiteboard_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          user_id?: string
          whiteboard_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whiteboard_members_whiteboard_id_fkey"
            columns: ["whiteboard_id"]
            isOneToOne: false
            referencedRelation: "whiteboards"
            referencedColumns: ["id"]
          },
        ]
      }
      whiteboard_notes: {
        Row: {
          color: string | null
          content: string | null
          created_at: string
          id: string
          position_x: number | null
          position_y: number | null
          updated_at: string
          user_id: string
          whiteboard_id: string
        }
        Insert: {
          color?: string | null
          content?: string | null
          created_at?: string
          id?: string
          position_x?: number | null
          position_y?: number | null
          updated_at?: string
          user_id: string
          whiteboard_id: string
        }
        Update: {
          color?: string | null
          content?: string | null
          created_at?: string
          id?: string
          position_x?: number | null
          position_y?: number | null
          updated_at?: string
          user_id?: string
          whiteboard_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whiteboard_notes_whiteboard_id_fkey"
            columns: ["whiteboard_id"]
            isOneToOne: false
            referencedRelation: "whiteboards"
            referencedColumns: ["id"]
          },
        ]
      }
      whiteboard_strokes: {
        Row: {
          color: string | null
          created_at: string
          end_x: number | null
          end_y: number | null
          fill_color: string | null
          id: string
          points: Json | null
          start_x: number | null
          start_y: number | null
          stroke_width: number | null
          tool: string
          user_id: string
          whiteboard_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          end_x?: number | null
          end_y?: number | null
          fill_color?: string | null
          id?: string
          points?: Json | null
          start_x?: number | null
          start_y?: number | null
          stroke_width?: number | null
          tool?: string
          user_id: string
          whiteboard_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          end_x?: number | null
          end_y?: number | null
          fill_color?: string | null
          id?: string
          points?: Json | null
          start_x?: number | null
          start_y?: number | null
          stroke_width?: number | null
          tool?: string
          user_id?: string
          whiteboard_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whiteboard_strokes_whiteboard_id_fkey"
            columns: ["whiteboard_id"]
            isOneToOne: false
            referencedRelation: "whiteboards"
            referencedColumns: ["id"]
          },
        ]
      }
      whiteboards: {
        Row: {
          course_id: string | null
          created_at: string
          created_by: string
          id: string
          max_users: number | null
          name: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          max_users?: number | null
          name: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          max_users?: number | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "whiteboards_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          university: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          university?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          university?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_chatroom_member: {
        Args: { _chatroom_id: string; _user_id: string }
        Returns: boolean
      }
      is_email_confirmed: { Args: never; Returns: boolean }
      is_username_available: {
        Args: { check_username: string }
        Returns: boolean
      }
      is_whiteboard_member: {
        Args: { _user_id: string; _whiteboard_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      assignment_status: "pending" | "in-progress" | "completed" | "missed"
      assignment_type:
        | "homework"
        | "quiz"
        | "project"
        | "essay"
        | "lab"
        | "exam"
        | "other"
      chatroom_type: "dm" | "group" | "assignment_thread"
      event_type:
        | "lecture"
        | "lab"
        | "office_hours"
        | "personal"
        | "study"
        | "exam"
      friendship_status: "pending" | "accepted" | "blocked"
      invitation_status: "pending" | "accepted" | "declined"
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
      app_role: ["admin", "user"],
      assignment_status: ["pending", "in-progress", "completed", "missed"],
      assignment_type: [
        "homework",
        "quiz",
        "project",
        "essay",
        "lab",
        "exam",
        "other",
      ],
      chatroom_type: ["dm", "group", "assignment_thread"],
      event_type: [
        "lecture",
        "lab",
        "office_hours",
        "personal",
        "study",
        "exam",
      ],
      friendship_status: ["pending", "accepted", "blocked"],
      invitation_status: ["pending", "accepted", "declined"],
    },
  },
} as const
