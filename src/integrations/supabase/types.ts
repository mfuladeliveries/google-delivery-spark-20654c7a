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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      driver_profiles: {
        Row: {
          created_at: string
          current_lat: number | null
          current_lng: number | null
          id: string
          id_document_url: string
          is_online: boolean
          license_plate: string
          license_url: string
          location_updated_at: string | null
          total_deliveries: number
          total_earnings: number
          updated_at: string
          user_id: string
          vehicle_type: string
        }
        Insert: {
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          id?: string
          id_document_url?: string
          is_online?: boolean
          license_plate?: string
          license_url?: string
          location_updated_at?: string | null
          total_deliveries?: number
          total_earnings?: number
          updated_at?: string
          user_id: string
          vehicle_type?: string
        }
        Update: {
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          id?: string
          id_document_url?: string
          is_online?: boolean
          license_plate?: string
          license_url?: string
          location_updated_at?: string | null
          total_deliveries?: number
          total_earnings?: number
          updated_at?: string
          user_id?: string
          vehicle_type?: string
        }
        Relationships: []
      }
      driver_rejected_orders: {
        Row: {
          created_at: string
          driver_id: string
          id: string
          order_id: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          id?: string
          order_id: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          id?: string
          order_id?: string
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          image: string
          is_available: boolean
          name: string
          price: number
          restaurant_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          image?: string
          is_available?: boolean
          name?: string
          price?: number
          restaurant_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          image?: string
          is_available?: boolean
          name?: string
          price?: number
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_address: string
          customer_contact: string
          customer_id: string | null
          customer_name: string
          delivered_at: string | null
          delivery_code: string | null
          delivery_code_hash: string | null
          delivery_fee: number
          driver_id: string | null
          driver_lat: number | null
          driver_lng: number | null
          driver_location_updated_at: string | null
          id: string
          items: Json
          order_number: number
          payment_method: string
          payment_status: string
          pin_attempts: number
          restaurant: string
          restaurant_id: string | null
          special_notes: string | null
          status: string
          subtotal: number
          tax: number
          tip: number
          total: number
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_address?: string
          customer_contact?: string
          customer_id?: string | null
          customer_name?: string
          delivered_at?: string | null
          delivery_code?: string | null
          delivery_code_hash?: string | null
          delivery_fee?: number
          driver_id?: string | null
          driver_lat?: number | null
          driver_lng?: number | null
          driver_location_updated_at?: string | null
          id?: string
          items?: Json
          order_number?: number
          payment_method?: string
          payment_status?: string
          pin_attempts?: number
          restaurant?: string
          restaurant_id?: string | null
          special_notes?: string | null
          status?: string
          subtotal?: number
          tax?: number
          tip?: number
          total?: number
          user_id: string
        }
        Update: {
          created_at?: string
          customer_address?: string
          customer_contact?: string
          customer_id?: string | null
          customer_name?: string
          delivered_at?: string | null
          delivery_code?: string | null
          delivery_code_hash?: string | null
          delivery_fee?: number
          driver_id?: string | null
          driver_lat?: number | null
          driver_lng?: number | null
          driver_location_updated_at?: string | null
          id?: string
          items?: Json
          order_number?: number
          payment_method?: string
          payment_status?: string
          pin_attempts?: number
          restaurant?: string
          restaurant_id?: string | null
          special_notes?: string | null
          status?: string
          subtotal?: number
          tax?: number
          tip?: number
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string
          contact_number: string
          created_at: string
          full_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string
          contact_number?: string
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          contact_number?: string
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_config: {
        Row: {
          created_at: string
          key: string
          value: string
        }
        Insert: {
          created_at?: string
          key: string
          value: string
        }
        Update: {
          created_at?: string
          key?: string
          value?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      restaurants: {
        Row: {
          created_at: string
          cuisine: string
          delivery_time: string
          description: string
          id: string
          is_active: boolean
          location: string
          logo: string
          min_order: number
          name: string
          owner_user_id: string | null
          rating: number
        }
        Insert: {
          created_at?: string
          cuisine?: string
          delivery_time?: string
          description?: string
          id?: string
          is_active?: boolean
          location?: string
          logo?: string
          min_order?: number
          name?: string
          owner_user_id?: string | null
          rating?: number
        }
        Update: {
          created_at?: string
          cuisine?: string
          delivery_time?: string
          description?: string
          id?: string
          is_active?: boolean
          location?: string
          logo?: string
          min_order?: number
          name?: string
          owner_user_id?: string | null
          rating?: number
        }
        Relationships: []
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
    }
    Views: {
      driver_job_board: {
        Row: {
          created_at: string | null
          customer_address: string | null
          delivery_fee: number | null
          id: string | null
          items: Json | null
          order_number: number | null
          restaurant: string | null
          total: number | null
        }
        Insert: {
          created_at?: string | null
          customer_address?: string | null
          delivery_fee?: number | null
          id?: string | null
          items?: Json | null
          order_number?: number | null
          restaurant?: string | null
          total?: number | null
        }
        Update: {
          created_at?: string | null
          customer_address?: string | null
          delivery_fee?: number | null
          id?: string | null
          items?: Json | null
          order_number?: number | null
          restaurant?: string | null
          total?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      auto_cancel_stale_orders: { Args: never; Returns: number }
      claim_order: { Args: { p_order_id: string }; Returns: boolean }
      create_verified_order:
        | {
            Args: {
              p_customer_address: string
              p_customer_contact: string
              p_customer_name: string
              p_delivery_code?: string
              p_items: Json
              p_restaurant_name: string
              p_special_notes?: string
              p_tip?: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_customer_address: string
              p_customer_contact: string
              p_customer_name: string
              p_delivery_code?: string
              p_items: Json
              p_payment_method?: string
              p_restaurant_name: string
              p_special_notes?: string
              p_tip?: number
            }
            Returns: Json
          }
      driver_cancel_order: {
        Args: { p_order_id: string; p_reason?: string }
        Returns: undefined
      }
      driver_update_order: {
        Args: {
          p_lat?: number
          p_lng?: number
          p_order_id: string
          p_status: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      verify_and_complete_delivery: {
        Args: { p_code: string; p_order_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "customer" | "restaurant" | "driver"
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
      app_role: ["admin", "customer", "restaurant", "driver"],
    },
  },
} as const
