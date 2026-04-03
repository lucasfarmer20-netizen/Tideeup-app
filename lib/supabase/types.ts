export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          tenant_id: string | null;
          email_status: 'pending' | 'sent' | 'opened' | 'unsubscribed';
          /** Generated column: tier = 'paid'. Read-only. */
          is_paid: boolean;
          tier: 'free' | 'paid';
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_status:
            | 'active'
            | 'canceled'
            | 'past_due'
            | 'trialing'
            | 'incomplete'
            | 'incomplete_expired'
            | 'unpaid'
            | null;
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          tenant_id?: string | null;
          email_status?: 'pending' | 'sent' | 'opened' | 'unsubscribed';
          // is_paid is a generated column — omit from Insert
          tier?: 'free' | 'paid';
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?:
            | 'active'
            | 'canceled'
            | 'past_due'
            | 'trialing'
            | 'incomplete'
            | 'incomplete_expired'
            | 'unpaid'
            | null;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          tenant_id?: string | null;
          email_status?: 'pending' | 'sent' | 'opened' | 'unsubscribed';
          // is_paid is a generated column — omit from Update
          tier?: 'free' | 'paid';
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?:
            | 'active'
            | 'canceled'
            | 'past_due'
            | 'trialing'
            | 'incomplete'
            | 'incomplete_expired'
            | 'unpaid'
            | null;
          current_period_end?: string | null;
          updated_at?: string;
        };
      };
      plans: {
        Row: {
          id: string;
          user_id: string | null;
          tenant_id: string | null;
          home_size: 'S' | 'M' | 'L' | 'XL';
          home_type: 'apartment' | 'townhouse' | 'single-family' | 'large-home';
          household_count: number;
          pet_types: string[];
          kids: boolean;
          flooring_types: string[];
          time_preference: 'quick' | 'steady' | 'thorough' | 'batch';
          week_of: string;
          week_plan: Json;
          is_claimed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          tenant_id?: string | null;
          home_size: 'S' | 'M' | 'L' | 'XL';
          home_type: 'apartment' | 'townhouse' | 'single-family' | 'large-home';
          household_count: number;
          pet_types: string[];
          kids: boolean;
          flooring_types: string[];
          time_preference: 'quick' | 'steady' | 'thorough' | 'batch';
          week_of: string;
          week_plan: Json;
          is_claimed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          tenant_id?: string | null;
          is_claimed?: boolean;
        };
      };
      email_events: {
        Row: {
          id: string;
          user_id: string;
          event_type: string;
          resend_id: string | null;
          payload: Json | null;
          occurred_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_type: string;
          resend_id?: string | null;
          payload?: Json | null;
          occurred_at?: string;
        };
        Update: never;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
