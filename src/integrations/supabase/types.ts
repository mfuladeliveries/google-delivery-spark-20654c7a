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
      customer_addresses: {
        Row: {
          address: string
          area_id: string | null
          created_at: string
          id: string
          is_default: boolean
          label: string
          lat: number
          lng: number
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          area_id?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          lat: number
          lng: number
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          area_id?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          lat?: number
          lng?: number
          updated_at?: string
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
      customer_favourites: {
        Row: {
          created_at: string
          id: string
          restaurant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          restaurant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          restaurant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_favourites_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_areas: {
        Row: {
          base_fee: number
          created_at: string
          created_by: string | null
          delivery_fee: number
          id: string
          is_active: boolean
          lat: number | null
          lng: number | null
          max_fee: number | null
          min_fee: number | null
          name: string
          price_per_km: number
          radius_km: number
          suburb: string
          updated_at: string
        }
        Insert: {
          base_fee?: number
          created_at?: string
          created_by?: string | null
          delivery_fee?: number
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          max_fee?: number | null
          min_fee?: number | null
          name: string
          price_per_km?: number
          radius_km?: number
          suburb?: string
          updated_at?: string
        }
        Update: {
          base_fee?: number
          created_at?: string
          created_by?: string | null
          delivery_fee?: number
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          max_fee?: number | null
          min_fee?: number | null
          name?: string
          price_per_km?: number
          radius_km?: number
          suburb?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_pin_overrides: {
        Row: {
          admin_notes: string | null
          approved_by: string | null
          approved_by_email: string | null
          created_at: string
          customer_name: string
          decided_at: string | null
          driver_id: string | null
          driver_name: string
          id: string
          order_id: string
          reason: string
          requested_at: string
          status: string
          updated_at: string
          used_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          approved_by?: string | null
          approved_by_email?: string | null
          created_at?: string
          customer_name?: string
          decided_at?: string | null
          driver_id?: string | null
          driver_name?: string
          id?: string
          order_id: string
          reason?: string
          requested_at?: string
          status?: string
          updated_at?: string
          used_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          approved_by?: string | null
          approved_by_email?: string | null
          created_at?: string
          customer_name?: string
          decided_at?: string | null
          driver_id?: string | null
          driver_name?: string
          id?: string
          order_id?: string
          reason?: string
          requested_at?: string
          status?: string
          updated_at?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_pin_overrides_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "driver_job_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_pin_overrides_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "driver_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_pin_overrides_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
          id_number: string
          is_online: boolean
          is_suspended: boolean
          license_plate: string
          license_url: string
          location_updated_at: string | null
          profile_photo_url: string
          service_area_id: string | null
          service_area_label: string
          service_lat: number | null
          service_lng: number | null
          service_radius_km: number
          suspended_at: string | null
          suspended_reason: string | null
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
          id_number?: string
          is_online?: boolean
          is_suspended?: boolean
          license_plate?: string
          license_url?: string
          location_updated_at?: string | null
          profile_photo_url?: string
          service_area_id?: string | null
          service_area_label?: string
          service_lat?: number | null
          service_lng?: number | null
          service_radius_km?: number
          suspended_at?: string | null
          suspended_reason?: string | null
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
          id_number?: string
          is_online?: boolean
          is_suspended?: boolean
          license_plate?: string
          license_url?: string
          location_updated_at?: string | null
          profile_photo_url?: string
          service_area_id?: string | null
          service_area_label?: string
          service_lat?: number | null
          service_lng?: number | null
          service_radius_km?: number
          suspended_at?: string | null
          suspended_reason?: string | null
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
      driver_service_areas: {
        Row: {
          area_id: string
          created_at: string
          driver_id: string
          id: string
        }
        Insert: {
          area_id: string
          created_at?: string
          driver_id: string
          id?: string
        }
        Update: {
          area_id?: string
          created_at?: string
          driver_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_service_areas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "delivery_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      fee_audit_log: {
        Row: {
          action: string
          changed_by: string | null
          changed_by_email: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          new_values: Json | null
          old_values: Json | null
        }
        Insert: {
          action: string
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Update: {
          action?: string
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
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
      order_dispatch_log: {
        Row: {
          created_at: string
          driver_id: string | null
          event: string
          id: string
          order_id: string
          round: number
        }
        Insert: {
          created_at?: string
          driver_id?: string | null
          event: string
          id?: string
          order_id: string
          round?: number
        }
        Update: {
          created_at?: string
          driver_id?: string | null
          event?: string
          id?: string
          order_id?: string
          round?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_dispatch_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "driver_job_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_dispatch_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "driver_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_dispatch_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
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
      order_policy_acceptances: {
        Row: {
          accepted_at: string
          created_at: string
          delivery_policy_version: string
          id: string
          order_id: string
          refund_policy_version: string
          terms_version: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string
          created_at?: string
          delivery_policy_version: string
          id?: string
          order_id: string
          refund_policy_version: string
          terms_version: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string
          created_at?: string
          delivery_policy_version?: string
          id?: string
          order_id?: string
          refund_policy_version?: string
          terms_version?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_policy_acceptances_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "driver_job_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_policy_acceptances_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "driver_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_policy_acceptances_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
      order_rejections: {
        Row: {
          dispatch_phase: string | null
          driver_id: string
          id: string
          order_id: string
          reason: string
          rejected_at: string
        }
        Insert: {
          dispatch_phase?: string | null
          driver_id: string
          id?: string
          order_id: string
          reason: string
          rejected_at?: string
        }
        Update: {
          dispatch_phase?: string | null
          driver_id?: string
          id?: string
          order_id?: string
          reason?: string
          rejected_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_rejections_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "driver_job_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_rejections_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "driver_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_rejections_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accepted_at: string | null
          address_tag: string | null
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
          dispatch_round: number
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
          paid_at: string | null
          payment_amount: number | null
          payment_checkout_id: string | null
          payment_completed_at: string | null
          payment_currency: string | null
          payment_failed_at: string | null
          payment_failure_reason: string | null
          payment_initiated_at: string | null
          payment_method: string
          payment_provider: string | null
          payment_provider_txn_id: string | null
          payment_reference: string | null
          payment_refunded_at: string | null
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
          round_offered_driver_ids: string[]
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
          address_tag?: string | null
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
          dispatch_round?: number
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
          paid_at?: string | null
          payment_amount?: number | null
          payment_checkout_id?: string | null
          payment_completed_at?: string | null
          payment_currency?: string | null
          payment_failed_at?: string | null
          payment_failure_reason?: string | null
          payment_initiated_at?: string | null
          payment_method?: string
          payment_provider?: string | null
          payment_provider_txn_id?: string | null
          payment_reference?: string | null
          payment_refunded_at?: string | null
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
          round_offered_driver_ids?: string[]
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
          address_tag?: string | null
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
          dispatch_round?: number
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
          paid_at?: string | null
          payment_amount?: number | null
          payment_checkout_id?: string | null
          payment_completed_at?: string | null
          payment_currency?: string | null
          payment_failed_at?: string | null
          payment_failure_reason?: string | null
          payment_initiated_at?: string | null
          payment_method?: string
          payment_provider?: string | null
          payment_provider_txn_id?: string | null
          payment_reference?: string | null
          payment_refunded_at?: string | null
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
          round_offered_driver_ids?: string[]
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
      payment_transactions: {
        Row: {
          amount_fee: number | null
          amount_gross: number | null
          amount_net: number | null
          created_at: string
          id: string
          order_id: string
          payment_method: string | null
          payment_status: string
          provider: string
          provider_txn_id: string | null
          raw_payload: Json
          signature_valid: boolean
          source_ip: string | null
        }
        Insert: {
          amount_fee?: number | null
          amount_gross?: number | null
          amount_net?: number | null
          created_at?: string
          id?: string
          order_id: string
          payment_method?: string | null
          payment_status: string
          provider?: string
          provider_txn_id?: string | null
          raw_payload?: Json
          signature_valid?: boolean
          source_ip?: string | null
        }
        Update: {
          amount_fee?: number | null
          amount_gross?: number | null
          amount_net?: number | null
          created_at?: string
          id?: string
          order_id?: string
          payment_method?: string | null
          payment_status?: string
          provider?: string
          provider_txn_id?: string | null
          raw_payload?: Json
          signature_valid?: boolean
          source_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "driver_job_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "driver_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          created_at: string
          event_id: string
          event_type: string | null
          id: string
          order_id: string | null
          payload: Json
          processed_at: string
          provider: string
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type?: string | null
          id?: string
          order_id?: string | null
          payload?: Json
          processed_at?: string
          provider?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string | null
          id?: string
          order_id?: string | null
          payload?: Json
          processed_at?: string
          provider?: string
        }
        Relationships: []
      }
      peak_surcharge_windows: {
        Row: {
          created_at: string
          day_of_week: number | null
          end_time: string
          flat_amount: number
          id: string
          is_active: boolean
          label: string
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week?: number | null
          end_time: string
          flat_amount: number
          id?: string
          is_active?: boolean
          label: string
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number | null
          end_time?: string
          flat_amount?: number
          id?: string
          is_active?: boolean
          label?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: []
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
          approval_mode: string
          area_id: string | null
          banner_url: string | null
          closes_at: string | null
          confirmation_timeout_minutes: number
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
          requires_confirmation: boolean
          total_reviews: number
        }
        Insert: {
          approval_mode?: string
          area_id?: string | null
          banner_url?: string | null
          closes_at?: string | null
          confirmation_timeout_minutes?: number
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
          requires_confirmation?: boolean
          total_reviews?: number
        }
        Update: {
          approval_mode?: string
          area_id?: string | null
          banner_url?: string | null
          closes_at?: string | null
          confirmation_timeout_minutes?: number
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
          requires_confirmation?: boolean
          total_reviews?: number
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "delivery_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
      driver_orders: {
        Row: {
          accepted_at: string | null
          address_tag: string | null
          arrived_at: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          created_at: string | null
          customer_address: string | null
          customer_contact: string | null
          customer_lat: number | null
          customer_lng: number | null
          customer_name: string | null
          delivered_at: string | null
          delivery_fee: number | null
          dispatch_phase: string | null
          dispatch_round: number | null
          dispatch_started_at: string | null
          driver_id: string | null
          driver_lat: number | null
          driver_lng: number | null
          driver_location_updated_at: string | null
          id: string | null
          items: Json | null
          offer_expires_at: string | null
          offered_to_driver_id: string | null
          order_number: number | null
          picked_up_at: string | null
          picking_up_at: string | null
          pin_attempts: number | null
          restaurant: string | null
          restaurant_id: string | null
          special_notes: string | null
          status: string | null
          tip: number | null
        }
        Insert: {
          accepted_at?: string | null
          address_tag?: string | null
          arrived_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          customer_address?: string | null
          customer_contact?: never
          customer_lat?: number | null
          customer_lng?: number | null
          customer_name?: never
          delivered_at?: string | null
          delivery_fee?: number | null
          dispatch_phase?: string | null
          dispatch_round?: number | null
          dispatch_started_at?: string | null
          driver_id?: string | null
          driver_lat?: number | null
          driver_lng?: number | null
          driver_location_updated_at?: string | null
          id?: string | null
          items?: Json | null
          offer_expires_at?: string | null
          offered_to_driver_id?: string | null
          order_number?: number | null
          picked_up_at?: string | null
          picking_up_at?: string | null
          pin_attempts?: number | null
          restaurant?: string | null
          restaurant_id?: string | null
          special_notes?: string | null
          status?: string | null
          tip?: number | null
        }
        Update: {
          accepted_at?: string | null
          address_tag?: string | null
          arrived_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          customer_address?: string | null
          customer_contact?: never
          customer_lat?: number | null
          customer_lng?: number | null
          customer_name?: never
          delivered_at?: string | null
          delivery_fee?: number | null
          dispatch_phase?: string | null
          dispatch_round?: number | null
          dispatch_started_at?: string | null
          driver_id?: string | null
          driver_lat?: number | null
          driver_lng?: number | null
          driver_location_updated_at?: string | null
          id?: string | null
          items?: Json | null
          offer_expires_at?: string | null
          offered_to_driver_id?: string | null
          order_number?: number | null
          picked_up_at?: string | null
          picking_up_at?: string | null
          pin_attempts?: number | null
          restaurant?: string | null
          restaurant_id?: string | null
          special_notes?: string | null
          status?: string | null
          tip?: number | null
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
    }
    Functions: {
      admin_approve_driver_request: {
        Args: { p_notes?: string; p_request_id: string }
        Returns: undefined
      }
      admin_assign_driver: {
        Args: { p_driver_id: string; p_order_id: string }
        Returns: undefined
      }
      admin_cancel_order: {
        Args: { p_order_id: string; p_reason?: string }
        Returns: undefined
      }
      admin_decide_pin_override: {
        Args: { p_approve: boolean; p_notes?: string; p_request_id: string }
        Returns: undefined
      }
      admin_dispatch_runs: {
        Args: { p_limit?: number }
        Returns: {
          content: string
          created: string
          error_msg: string
          id: number
          status_code: number
        }[]
      }
      admin_mark_bank_refund_paid: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      admin_reject_driver_request: {
        Args: { p_notes?: string; p_request_id: string }
        Returns: undefined
      }
      admin_set_driver_suspended: {
        Args: { p_reason?: string; p_suspended: boolean; p_user_id: string }
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
      auto_cancel_stale_awaiting_orders: { Args: never; Returns: number }
      auto_cancel_stale_orders: { Args: never; Returns: number }
      calc_delivery_fee: {
        Args: { p_lat: number; p_lng: number; p_restaurant_name?: string }
        Returns: Json
      }
      calc_zone_fee: {
        Args: {
          p_base: number
          p_distance_km: number
          p_max: number
          p_min: number
          p_per_km: number
        }
        Returns: number
      }
      check_area_coverage:
        | { Args: { p_lat: number; p_lng: number }; Returns: Json }
        | {
            Args: { p_address?: string; p_lat: number; p_lng: number }
            Returns: Json
          }
      check_email_verified: { Args: { p_email: string }; Returns: Json }
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
      confirm_online_payment: {
        Args: {
          p_amount_fee: number
          p_amount_gross: number
          p_amount_net: number
          p_checkout_id: string
          p_currency: string
          p_order_id: string
          p_payment_id: string
          p_payment_method: string
          p_provider: string
          p_raw_payload: Json
          p_reference: string
          p_source_ip?: string
        }
        Returns: Json
      }
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
          p_restaurant_id?: string
          p_restaurant_name: string
          p_special_notes?: string
          p_tip?: number
        }
        Returns: Json
      }
      current_peak_surcharge: { Args: never; Returns: number }
      customer_cancel_pending_order: {
        Args: { p_order_id: string }
        Returns: Json
      }
      customer_cancel_recent_order: {
        Args: { p_order_id: string }
        Returns: Json
      }
      customer_choose_refund: {
        Args: { p_method: string; p_order_id: string }
        Returns: Json
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      derive_address_tag: { Args: { p_address: string }; Returns: string }
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
      driver_complete_with_override: {
        Args: { p_order_id: string }
        Returns: boolean
      }
      driver_decline_offer: { Args: { p_order_id: string }; Returns: undefined }
      driver_pin_override_status: {
        Args: { p_order_id: string }
        Returns: string
      }
      driver_request_dispatch: { Args: never; Returns: Json }
      driver_request_pin_override: {
        Args: { p_order_id: string }
        Returns: string
      }
      driver_resend_customer_pin: {
        Args: { p_order_id: string }
        Returns: Json
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
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      expire_stale_pending_payments: { Args: never; Returns: number }
      find_nearest_zone: {
        Args: {
          p_lat: number
          p_lng: number
          p_restaurant_lat?: number
          p_restaurant_lng?: number
        }
        Returns: Json
      }
      get_active_delivery_pin: { Args: { p_order_id: string }; Returns: string }
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
      mark_online_payment_failed: {
        Args: {
          p_order_id: string
          p_payment_id: string
          p_provider: string
          p_raw_payload: Json
          p_reason: string
          p_source_ip?: string
          p_status: string
        }
        Returns: undefined
      }
      mark_online_payment_refunded: {
        Args: {
          p_amount: number
          p_order_id: string
          p_payment_id: string
          p_provider: string
          p_raw_payload: Json
        }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      order_sender_role_valid: {
        Args: { _order_id: string; _role: string; _user_id: string }
        Returns: boolean
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      regenerate_delivery_pin: { Args: { p_order_id: string }; Returns: string }
      request_withdrawal: { Args: { p_amount: number }; Returns: string }
      restaurant_decide_availability: {
        Args: { p_accept: boolean; p_order_id: string; p_reason?: string }
        Returns: Json
      }
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
    Enums: {
      app_role: ["admin", "customer", "restaurant", "driver"],
    },
  },
} as const
