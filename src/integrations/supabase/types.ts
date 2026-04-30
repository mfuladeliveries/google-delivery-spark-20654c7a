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
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          note: string | null
          order_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          order_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          order_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      customer_credits: {
        Row: {
          balance: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      delivery_areas: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          suburb: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          suburb?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          suburb?: string
          updated_at?: string
        }
        Relationships: []
      }
      driver_access_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          message: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      driver_earnings: {
        Row: {
          created_at: string
          delivery_fee: number
          driver_id: string
          driver_payout: number
          id: string
          order_id: string
          platform_fee: number
        }
        Insert: {
          created_at?: string
          delivery_fee?: number
          driver_id: string
          driver_payout?: number
          id?: string
          order_id: string
          platform_fee?: number
        }
        Update: {
          created_at?: string
          delivery_fee?: number
          driver_id?: string
          driver_payout?: number
          id?: string
          order_id?: string
          platform_fee?: number
        }
        Relationships: []
      }
      driver_profiles: {
        Row: {
          bank_account_holder: string
          bank_account_number: string
          bank_account_type: string
          bank_branch_code: string
          bank_name: string
          created_at: string
          current_lat: number | null
          current_lng: number | null
          id: string
          id_document_url: string
          is_online: boolean
          license_plate: string
          license_url: string
          location_updated_at: string | null
          service_area_id: string | null
          service_area_label: string
          service_lat: number | null
          service_lng: number | null
          service_radius_km: number
          total_deliveries: number
          total_earnings: number
          updated_at: string
          user_id: string
          vehicle_type: string
        }
        Insert: {
          bank_account_holder?: string
          bank_account_number?: string
          bank_account_type?: string
          bank_branch_code?: string
          bank_name?: string
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          id?: string
          id_document_url?: string
          is_online?: boolean
          license_plate?: string
          license_url?: string
          location_updated_at?: string | null
          service_area_id?: string | null
          service_area_label?: string
          service_lat?: number | null
          service_lng?: number | null
          service_radius_km?: number
          total_deliveries?: number
          total_earnings?: number
          updated_at?: string
          user_id: string
          vehicle_type?: string
        }
        Update: {
          bank_account_holder?: string
          bank_account_number?: string
          bank_account_type?: string
          bank_branch_code?: string
          bank_name?: string
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          id?: string
          id_document_url?: string
          is_online?: boolean
          license_plate?: string
          license_url?: string
          location_updated_at?: string | null
          service_area_id?: string | null
          service_area_label?: string
          service_lat?: number | null
          service_lng?: number | null
          service_radius_km?: number
          total_deliveries?: number
          total_earnings?: number
          updated_at?: string
          user_id?: string
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_profiles_service_area_id_fkey"
            columns: ["service_area_id"]
            isOneToOne: false
            referencedRelation: "delivery_areas"
            referencedColumns: ["id"]
          },
        ]
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
      invalid_order_attempts: {
        Row: {
          created_at: string
          customer_lat: number | null
          customer_lng: number | null
          distance_km: number | null
          id: string
          reason: string
          restaurant_name: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          customer_lat?: number | null
          customer_lng?: number | null
          distance_km?: number | null
          id?: string
          reason: string
          restaurant_name?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          customer_lat?: number | null
          customer_lng?: number | null
          distance_km?: number | null
          id?: string
          reason?: string
          restaurant_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          add_ons: Json
          category: string
          created_at: string
          cuts: Json
          description: string
          has_add_ons: boolean
          has_cuts: boolean
          has_sizes: boolean
          id: string
          image: string
          image_url: string | null
          is_available: boolean
          is_popular: boolean
          name: string
          price: number
          restaurant_id: string
          sizes: Json
        }
        Insert: {
          add_ons?: Json
          category?: string
          created_at?: string
          cuts?: Json
          description?: string
          has_add_ons?: boolean
          has_cuts?: boolean
          has_sizes?: boolean
          id?: string
          image?: string
          image_url?: string | null
          is_available?: boolean
          is_popular?: boolean
          name?: string
          price?: number
          restaurant_id: string
          sizes?: Json
        }
        Update: {
          add_ons?: Json
          category?: string
          created_at?: string
          cuts?: Json
          description?: string
          has_add_ons?: boolean
          has_cuts?: boolean
          has_sizes?: boolean
          id?: string
          image?: string
          image_url?: string | null
          is_available?: boolean
          is_popular?: boolean
          name?: string
          price?: number
          restaurant_id?: string
          sizes?: Json
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
      order_messages: {
        Row: {
          attachment_type: string | null
          attachment_url: string | null
          created_at: string
          id: string
          message: string | null
          order_id: string
          read_at: string | null
          sender_id: string
          sender_role: string
        }
        Insert: {
          attachment_type?: string | null
          attachment_url?: string | null
          created_at?: string
          id?: string
          message?: string | null
          order_id: string
          read_at?: string | null
          sender_id: string
          sender_role: string
        }
        Update: {
          attachment_type?: string | null
          attachment_url?: string | null
          created_at?: string
          id?: string
          message?: string | null
          order_id?: string
          read_at?: string | null
          sender_id?: string
          sender_role?: string
        }
        Relationships: []
      }
      order_notification_log: {
        Row: {
          id: string
          notification_kind: string
          order_id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          id?: string
          notification_kind: string
          order_id: string
          sent_at?: string
          user_id: string
        }
        Update: {
          id?: string
          notification_kind?: string
          order_id?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      order_ratings: {
        Row: {
          comment: string | null
          created_at: string
          customer_id: string
          driver_id: string | null
          driver_rating: number | null
          food_rating: number
          id: string
          order_id: string
          restaurant_id: string | null
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_id: string
          driver_id?: string | null
          driver_rating?: number | null
          food_rating: number
          id?: string
          order_id: string
          restaurant_id?: string | null
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_id?: string
          driver_id?: string | null
          driver_rating?: number | null
          food_rating?: number
          id?: string
          order_id?: string
          restaurant_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          accepted_at: string | null
          admin_delivery_code: string | null
          arrived_at: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          created_at: string
          credits_applied: number
          customer_address: string
          customer_contact: string
          customer_id: string | null
          customer_lat: number | null
          customer_lng: number | null
          customer_name: string
          delivered_at: string | null
          delivery_code: string | null
          delivery_code_hash: string | null
          delivery_fee: number
          dispatch_phase: string | null
          dispatch_started_at: string | null
          driver_id: string | null
          driver_lat: number | null
          driver_lng: number | null
          driver_location_updated_at: string | null
          id: string
          items: Json
          missed_by_driver_ids: string[] | null
          offer_expires_at: string | null
          offered_to_driver_id: string | null
          order_number: number
          payment_method: string
          payment_status: string
          picked_up_at: string | null
          picking_up_at: string | null
          pin_attempts: number
          refund_amount: number | null
          refund_method: string | null
          refund_status: string | null
          refunded_at: string | null
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
          accepted_at?: string | null
          admin_delivery_code?: string | null
          arrived_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          credits_applied?: number
          customer_address?: string
          customer_contact?: string
          customer_id?: string | null
          customer_lat?: number | null
          customer_lng?: number | null
          customer_name?: string
          delivered_at?: string | null
          delivery_code?: string | null
          delivery_code_hash?: string | null
          delivery_fee?: number
          dispatch_phase?: string | null
          dispatch_started_at?: string | null
          driver_id?: string | null
          driver_lat?: number | null
          driver_lng?: number | null
          driver_location_updated_at?: string | null
          id?: string
          items?: Json
          missed_by_driver_ids?: string[] | null
          offer_expires_at?: string | null
          offered_to_driver_id?: string | null
          order_number?: number
          payment_method?: string
          payment_status?: string
          picked_up_at?: string | null
          picking_up_at?: string | null
          pin_attempts?: number
          refund_amount?: number | null
          refund_method?: string | null
          refund_status?: string | null
          refunded_at?: string | null
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
          accepted_at?: string | null
          admin_delivery_code?: string | null
          arrived_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          credits_applied?: number
          customer_address?: string
          customer_contact?: string
          customer_id?: string | null
          customer_lat?: number | null
          customer_lng?: number | null
          customer_name?: string
          delivered_at?: string | null
          delivery_code?: string | null
          delivery_code_hash?: string | null
          delivery_fee?: number
          dispatch_phase?: string | null
          dispatch_started_at?: string | null
          driver_id?: string | null
          driver_lat?: number | null
          driver_lng?: number | null
          driver_location_updated_at?: string | null
          id?: string
          items?: Json
          missed_by_driver_ids?: string[] | null
          offer_expires_at?: string | null
          offered_to_driver_id?: string | null
          order_number?: number
          payment_method?: string
          payment_status?: string
          picked_up_at?: string | null
          picking_up_at?: string | null
          pin_attempts?: number
          refund_amount?: number | null
          refund_method?: string | null
          refund_status?: string | null
          refunded_at?: string | null
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
          lat: number | null
          lng: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string
          contact_number?: string
          created_at?: string
          full_name?: string
          id?: string
          lat?: number | null
          lng?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          contact_number?: string
          created_at?: string
          full_name?: string
          id?: string
          lat?: number | null
          lng?: number | null
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
      rate_limits: {
        Row: {
          action: string
          created_at: string
          id: string
          identifier: string
          request_count: number
          updated_at: string
          window_started_at: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          identifier: string
          request_count?: number
          updated_at?: string
          window_started_at?: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          identifier?: string
          request_count?: number
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      restaurants: {
        Row: {
          banner_url: string | null
          closes_at: string | null
          contact_number: string | null
          created_at: string
          cuisine: string
          delivery_time: string
          description: string
          gallery_images: string[]
          id: string
          image_url: string | null
          is_active: boolean
          is_open: boolean
          lat: number | null
          lng: number | null
          location: string
          logo: string
          logo_url: string | null
          min_order: number
          name: string
          opens_at: string | null
          operating_days: Json
          owner_user_id: string | null
          rating: number
          total_reviews: number
        }
        Insert: {
          banner_url?: string | null
          closes_at?: string | null
          contact_number?: string | null
          created_at?: string
          cuisine?: string
          delivery_time?: string
          description?: string
          gallery_images?: string[]
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_open?: boolean
          lat?: number | null
          lng?: number | null
          location?: string
          logo?: string
          logo_url?: string | null
          min_order?: number
          name?: string
          opens_at?: string | null
          operating_days?: Json
          owner_user_id?: string | null
          rating?: number
          total_reviews?: number
        }
        Update: {
          banner_url?: string | null
          closes_at?: string | null
          contact_number?: string | null
          created_at?: string
          cuisine?: string
          delivery_time?: string
          description?: string
          gallery_images?: string[]
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_open?: boolean
          lat?: number | null
          lng?: number | null
          location?: string
          logo?: string
          logo_url?: string | null
          min_order?: number
          name?: string
          opens_at?: string | null
          operating_days?: Json
          owner_user_id?: string | null
          rating?: number
          total_reviews?: number
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
      withdrawal_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          approved_at: string | null
          bank_account_holder: string
          bank_account_number: string
          bank_account_type: string
          bank_branch_code: string
          bank_name: string
          created_at: string
          driver_id: string
          id: string
          paid_at: string | null
          rejected_at: string | null
          rejection_reason: string | null
          requested_at: string
          status: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          approved_at?: string | null
          bank_account_holder: string
          bank_account_number: string
          bank_account_type: string
          bank_branch_code: string
          bank_name: string
          created_at?: string
          driver_id: string
          id?: string
          paid_at?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          requested_at?: string
          status?: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          approved_at?: string | null
          bank_account_holder?: string
          bank_account_number?: string
          bank_account_type?: string
          bank_branch_code?: string
          bank_name?: string
          created_at?: string
          driver_id?: string
          id?: string
          paid_at?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          requested_at?: string
          status?: string
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
      admin_approve_driver_request: {
        Args: { p_notes?: string; p_request_id: string }
        Returns: undefined
      }
      admin_cancel_order: {
        Args: { p_order_id: string; p_reason?: string }
        Returns: undefined
      }
      admin_mark_bank_refund_paid: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      admin_reject_driver_request: {
        Args: { p_notes?: string; p_request_id: string }
        Returns: undefined
      }
      admin_update_withdrawal: {
        Args: {
          p_notes?: string
          p_rejection_reason?: string
          p_request_id: string
          p_status: string
        }
        Returns: undefined
      }
      auto_cancel_stale_orders: { Args: never; Returns: number }
      check_area_coverage: {
        Args: { p_lat: number; p_lng: number }
        Returns: Json
      }
      check_rate_limit: {
        Args: {
          p_action: string
          p_identifier: string
          p_max_requests: number
          p_window_seconds: number
        }
        Returns: boolean
      }
      check_service_area: {
        Args: { p_lat: number; p_lng: number }
        Returns: Json
      }
      claim_order: { Args: { p_order_id: string }; Returns: boolean }
      create_verified_order: {
        Args: {
          p_customer_address: string
          p_customer_contact: string
          p_customer_lat: number
          p_customer_lng: number
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
      customer_choose_refund: {
        Args: { p_method: string; p_order_id: string }
        Returns: Json
      }
      dispatch_assign_next: { Args: { p_order_id: string }; Returns: Json }
      dispatch_tick: { Args: never; Returns: Json }
      distance_km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      driver_accept_offer: { Args: { p_order_id: string }; Returns: boolean }
      driver_cancel_order: {
        Args: { p_order_id: string; p_reason?: string }
        Returns: undefined
      }
      driver_decline_offer: { Args: { p_order_id: string }; Returns: undefined }
      driver_update_order: {
        Args: {
          p_lat?: number
          p_lng?: number
          p_order_id: string
          p_status: string
        }
        Returns: undefined
      }
      get_customer_balance: { Args: { p_user_id?: string }; Returns: number }
      get_driver_balance: { Args: { p_driver_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_order_participant: {
        Args: { _order_id: string; _user_id: string }
        Returns: boolean
      }
      log_invalid_order_attempt: {
        Args: {
          p_distance: number
          p_lat: number
          p_lng: number
          p_reason: string
          p_restaurant_name: string
        }
        Returns: undefined
      }
      request_withdrawal: { Args: { p_amount: number }; Returns: string }
      spend_customer_credits: {
        Args: { p_amount: number; p_note?: string; p_order_id: string }
        Returns: number
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
