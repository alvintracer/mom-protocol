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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ad_bids: {
        Row: {
          bid_amount: number
          bid_currency: string
          bidder_id: string
          campaign_id: string
          created_at: string
          duration_days: number | null
          ends_at: string
          id: string
          platform_energy_earned: number
          position: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          bid_amount: number
          bid_currency?: string
          bidder_id: string
          campaign_id: string
          created_at?: string
          duration_days?: number | null
          ends_at: string
          id?: string
          platform_energy_earned?: number
          position: string
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          bid_amount?: number
          bid_currency?: string
          bidder_id?: string
          campaign_id?: string
          created_at?: string
          duration_days?: number | null
          ends_at?: string
          id?: string
          platform_energy_earned?: number
          position?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_bids_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaign_performance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_bids_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_campaigns: {
        Row: {
          advertiser_id: string | null
          advertiser_name: string
          body: string | null
          budget_amount: number | null
          budget_type: string
          click_count: number
          cluster_id: string | null
          created_at: string
          cta_label: string | null
          destination_url: string
          ends_at: string | null
          id: string
          image_url: string | null
          impression_count: number
          positions: string[]
          priority: number
          spent_amount: number
          starts_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          advertiser_id?: string | null
          advertiser_name: string
          body?: string | null
          budget_amount?: number | null
          budget_type?: string
          click_count?: number
          cluster_id?: string | null
          created_at?: string
          cta_label?: string | null
          destination_url: string
          ends_at?: string | null
          id?: string
          image_url?: string | null
          impression_count?: number
          positions?: string[]
          priority?: number
          spent_amount?: number
          starts_at?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          advertiser_id?: string | null
          advertiser_name?: string
          body?: string | null
          budget_amount?: number | null
          budget_type?: string
          click_count?: number
          cluster_id?: string | null
          created_at?: string
          cta_label?: string | null
          destination_url?: string
          ends_at?: string | null
          id?: string
          image_url?: string | null
          impression_count?: number
          positions?: string[]
          priority?: number
          spent_amount?: number
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaigns_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "attention_clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_clicks: {
        Row: {
          campaign_id: string
          cluster_id: string | null
          created_at: string
          id: string
          position: string
          user_id: string | null
        }
        Insert: {
          campaign_id: string
          cluster_id?: string | null
          created_at?: string
          id?: string
          position: string
          user_id?: string | null
        }
        Update: {
          campaign_id?: string
          cluster_id?: string | null
          created_at?: string
          id?: string
          position?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_clicks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaign_performance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_clicks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_clicks_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "attention_clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_impressions: {
        Row: {
          campaign_id: string
          cluster_id: string | null
          created_at: string
          id: string
          position: string
          user_id: string | null
        }
        Insert: {
          campaign_id: string
          cluster_id?: string | null
          created_at?: string
          id?: string
          position: string
          user_id?: string | null
        }
        Update: {
          campaign_id?: string
          cluster_id?: string | null
          created_at?: string
          id?: string
          position?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_impressions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaign_performance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_impressions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_impressions_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "attention_clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_network_placements: {
        Row: {
          created_at: string
          device: string
          id: string
          is_active: boolean
          network_name: string
          notes: string | null
          position: string
          priority: number
          script_code: string
          unit_name: string
          unit_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          device?: string
          id?: string
          is_active?: boolean
          network_name: string
          notes?: string | null
          position?: string
          priority?: number
          script_code: string
          unit_name: string
          unit_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          device?: string
          id?: string
          is_active?: boolean
          network_name?: string
          notes?: string | null
          position?: string
          priority?: number
          script_code?: string
          unit_name?: string
          unit_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_user_actions: {
        Row: {
          action_type: string
          created_at: string
          id: string
          metadata: Json
          mom_energy_delta: number | null
          reason: string | null
          target_user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          metadata?: Json
          mom_energy_delta?: number | null
          reason?: string | null
          target_user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          metadata?: Json
          mom_energy_delta?: number | null
          reason?: string | null
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_user_actions_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      aio_assertions: {
        Row: {
          aggregate_confidence: number | null
          aggregate_metadata: Json
          aggregate_verdict: Database["public"]["Enums"]["aio_verdict"] | null
          asserted_outcome: string
          bond_amount: number
          bond_currency: string
          challenge_ends_at: string | null
          claim_text: string
          created_at: string
          event_id: string
          evidence_bundle_hash: string | null
          finalized_at: string | null
          finalized_outcome: string | null
          id: string
          llm_bundle_hash: string | null
          onchain_tx_hash: string | null
          original_language: Database["public"]["Enums"]["supported_language"]
          proposer_id: string
          rule_id: string
          status: Database["public"]["Enums"]["aio_assertion_status"]
          updated_at: string
        }
        Insert: {
          aggregate_confidence?: number | null
          aggregate_metadata?: Json
          aggregate_verdict?: Database["public"]["Enums"]["aio_verdict"] | null
          asserted_outcome: string
          bond_amount?: number
          bond_currency?: string
          challenge_ends_at?: string | null
          claim_text: string
          created_at?: string
          event_id: string
          evidence_bundle_hash?: string | null
          finalized_at?: string | null
          finalized_outcome?: string | null
          id?: string
          llm_bundle_hash?: string | null
          onchain_tx_hash?: string | null
          original_language?: Database["public"]["Enums"]["supported_language"]
          proposer_id: string
          rule_id: string
          status?: Database["public"]["Enums"]["aio_assertion_status"]
          updated_at?: string
        }
        Update: {
          aggregate_confidence?: number | null
          aggregate_metadata?: Json
          aggregate_verdict?: Database["public"]["Enums"]["aio_verdict"] | null
          asserted_outcome?: string
          bond_amount?: number
          bond_currency?: string
          challenge_ends_at?: string | null
          claim_text?: string
          created_at?: string
          event_id?: string
          evidence_bundle_hash?: string | null
          finalized_at?: string | null
          finalized_outcome?: string | null
          id?: string
          llm_bundle_hash?: string | null
          onchain_tx_hash?: string | null
          original_language?: Database["public"]["Enums"]["supported_language"]
          proposer_id?: string
          rule_id?: string
          status?: Database["public"]["Enums"]["aio_assertion_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aio_assertions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aio_assertions_proposer_id_fkey"
            columns: ["proposer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aio_assertions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "attention_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      aio_challenges: {
        Row: {
          aggregate_confidence: number | null
          aggregate_metadata: Json
          aggregate_verdict: Database["public"]["Enums"]["aio_verdict"] | null
          assertion_id: string
          bond_amount: number
          bond_currency: string
          challenger_id: string
          counter_claim_text: string
          counter_outcome: string | null
          created_at: string
          eligibility_snapshot: Json
          evidence_bundle_hash: string | null
          id: string
          llm_bundle_hash: string | null
          original_language: Database["public"]["Enums"]["supported_language"]
          resolution_note: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["aio_challenge_status"]
          updated_at: string
        }
        Insert: {
          aggregate_confidence?: number | null
          aggregate_metadata?: Json
          aggregate_verdict?: Database["public"]["Enums"]["aio_verdict"] | null
          assertion_id: string
          bond_amount?: number
          bond_currency?: string
          challenger_id: string
          counter_claim_text: string
          counter_outcome?: string | null
          created_at?: string
          eligibility_snapshot?: Json
          evidence_bundle_hash?: string | null
          id?: string
          llm_bundle_hash?: string | null
          original_language?: Database["public"]["Enums"]["supported_language"]
          resolution_note?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["aio_challenge_status"]
          updated_at?: string
        }
        Update: {
          aggregate_confidence?: number | null
          aggregate_metadata?: Json
          aggregate_verdict?: Database["public"]["Enums"]["aio_verdict"] | null
          assertion_id?: string
          bond_amount?: number
          bond_currency?: string
          challenger_id?: string
          counter_claim_text?: string
          counter_outcome?: string | null
          created_at?: string
          eligibility_snapshot?: Json
          evidence_bundle_hash?: string | null
          id?: string
          llm_bundle_hash?: string | null
          original_language?: Database["public"]["Enums"]["supported_language"]
          resolution_note?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["aio_challenge_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aio_challenges_assertion_id_fkey"
            columns: ["assertion_id"]
            isOneToOne: false
            referencedRelation: "aio_assertions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aio_challenges_challenger_id_fkey"
            columns: ["challenger_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      aio_evidence_items: {
        Row: {
          assertion_id: string
          canonical_url: string | null
          capture_node_signature: string | null
          captured_at: string
          content_hash: string | null
          created_at: string
          id: string
          metadata: Json
          metadata_hash: string | null
          published_at: string | null
          publisher: string | null
          publisher_domain: string | null
          publisher_trust_weight: number | null
          screenshot_url: string | null
          submitted_by: string | null
          thumbnail_url: string | null
          title: string | null
          url: string
        }
        Insert: {
          assertion_id: string
          canonical_url?: string | null
          capture_node_signature?: string | null
          captured_at?: string
          content_hash?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          metadata_hash?: string | null
          published_at?: string | null
          publisher?: string | null
          publisher_domain?: string | null
          publisher_trust_weight?: number | null
          screenshot_url?: string | null
          submitted_by?: string | null
          thumbnail_url?: string | null
          title?: string | null
          url: string
        }
        Update: {
          assertion_id?: string
          canonical_url?: string | null
          capture_node_signature?: string | null
          captured_at?: string
          content_hash?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          metadata_hash?: string | null
          published_at?: string | null
          publisher?: string | null
          publisher_domain?: string | null
          publisher_trust_weight?: number | null
          screenshot_url?: string | null
          submitted_by?: string | null
          thumbnail_url?: string | null
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "aio_evidence_items_assertion_id_fkey"
            columns: ["assertion_id"]
            isOneToOne: false
            referencedRelation: "aio_assertions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aio_evidence_items_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      aio_llm_verifications: {
        Row: {
          assertion_id: string
          confidence: number
          created_at: string
          evidence_item_id: string | null
          full_trace_uri: string | null
          id: string
          input_hash: string
          model_id: string
          output_hash: string
          prompt_hash: string
          prompt_version: string
          provider: string
          raw_output: Json
          reasoning_summary: string | null
          verdict: Database["public"]["Enums"]["aio_verdict"]
        }
        Insert: {
          assertion_id: string
          confidence: number
          created_at?: string
          evidence_item_id?: string | null
          full_trace_uri?: string | null
          id?: string
          input_hash: string
          model_id: string
          output_hash: string
          prompt_hash: string
          prompt_version: string
          provider: string
          raw_output?: Json
          reasoning_summary?: string | null
          verdict: Database["public"]["Enums"]["aio_verdict"]
        }
        Update: {
          assertion_id?: string
          confidence?: number
          created_at?: string
          evidence_item_id?: string | null
          full_trace_uri?: string | null
          id?: string
          input_hash?: string
          model_id?: string
          output_hash?: string
          prompt_hash?: string
          prompt_version?: string
          provider?: string
          raw_output?: Json
          reasoning_summary?: string | null
          verdict?: Database["public"]["Enums"]["aio_verdict"]
        }
        Relationships: [
          {
            foreignKeyName: "aio_llm_verifications_assertion_id_fkey"
            columns: ["assertion_id"]
            isOneToOne: false
            referencedRelation: "aio_assertions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aio_llm_verifications_evidence_item_id_fkey"
            columns: ["evidence_item_id"]
            isOneToOne: false
            referencedRelation: "aio_evidence_items"
            referencedColumns: ["id"]
          },
        ]
      }
      aio_resolutions: {
        Row: {
          assertion_id: string
          challenge_summary: Json
          created_at: string
          event_id: string
          evidence_bundle_hash: string | null
          final_outcome: string
          finalized_at: string
          id: string
          llm_bundle_hash: string | null
          onchain_tx_hash: string | null
          resolution_hash: string | null
          resolution_text: string
          resolved_by: string
        }
        Insert: {
          assertion_id: string
          challenge_summary?: Json
          created_at?: string
          event_id: string
          evidence_bundle_hash?: string | null
          final_outcome: string
          finalized_at?: string
          id?: string
          llm_bundle_hash?: string | null
          onchain_tx_hash?: string | null
          resolution_hash?: string | null
          resolution_text: string
          resolved_by?: string
        }
        Update: {
          assertion_id?: string
          challenge_summary?: Json
          created_at?: string
          event_id?: string
          evidence_bundle_hash?: string | null
          final_outcome?: string
          finalized_at?: string
          id?: string
          llm_bundle_hash?: string | null
          onchain_tx_hash?: string | null
          resolution_hash?: string | null
          resolution_text?: string
          resolved_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "aio_resolutions_assertion_id_fkey"
            columns: ["assertion_id"]
            isOneToOne: true
            referencedRelation: "aio_assertions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aio_resolutions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      aio_rule_templates: {
        Row: {
          category: string | null
          created_at: string
          default_bond_amount: number
          default_bond_currency: string
          default_challenge_period_seconds: number
          default_min_evidence_count: number
          default_min_publisher_trust: number
          description: string | null
          evidence_requirements: Json
          id: string
          llm_policy: Json
          slug: string
          status: Database["public"]["Enums"]["aio_rule_status"]
          supported_outcomes: string[]
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          default_bond_amount?: number
          default_bond_currency?: string
          default_challenge_period_seconds?: number
          default_min_evidence_count?: number
          default_min_publisher_trust?: number
          description?: string | null
          evidence_requirements?: Json
          id?: string
          llm_policy?: Json
          slug: string
          status?: Database["public"]["Enums"]["aio_rule_status"]
          supported_outcomes?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          default_bond_amount?: number
          default_bond_currency?: string
          default_challenge_period_seconds?: number
          default_min_evidence_count?: number
          default_min_publisher_trust?: number
          description?: string | null
          evidence_requirements?: Json
          id?: string
          llm_policy?: Json
          slug?: string
          status?: Database["public"]["Enums"]["aio_rule_status"]
          supported_outcomes?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      attention_activity_ledger: {
        Row: {
          activity_type: Database["public"]["Enums"]["attention_activity_type"]
          cluster_id: string | null
          created_at: string
          id: string
          metadata: Json
          mom_energy: number
          revenue_amount: number
          revenue_currency: string | null
          source_id: string | null
          user_id: string | null
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["attention_activity_type"]
          cluster_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          mom_energy?: number
          revenue_amount?: number
          revenue_currency?: string | null
          source_id?: string | null
          user_id?: string | null
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["attention_activity_type"]
          cluster_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          mom_energy?: number
          revenue_amount?: number
          revenue_currency?: string | null
          source_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attention_activity_ledger_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "attention_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attention_activity_ledger_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "attention_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attention_activity_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attention_aliases: {
        Row: {
          alias: string
          cluster_id: string
          created_at: string
          id: string
          language: Database["public"]["Enums"]["supported_language"] | null
          source: string
        }
        Insert: {
          alias: string
          cluster_id: string
          created_at?: string
          id?: string
          language?: Database["public"]["Enums"]["supported_language"] | null
          source?: string
        }
        Update: {
          alias?: string
          cluster_id?: string
          created_at?: string
          id?: string
          language?: Database["public"]["Enums"]["supported_language"] | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "attention_aliases_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "attention_clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      attention_clusters: {
        Row: {
          attention_score: number
          avatar_url: string | null
          canonical_event_id: string | null
          category: string | null
          comment_count: number
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          original_language: Database["public"]["Enums"]["supported_language"]
          post_count: number
          slug: string | null
          source_count: number
          status: Database["public"]["Enums"]["attention_cluster_status"]
          title: string
          total_donation_mom: number
          updated_at: string
        }
        Insert: {
          attention_score?: number
          avatar_url?: string | null
          canonical_event_id?: string | null
          category?: string | null
          comment_count?: number
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          original_language?: Database["public"]["Enums"]["supported_language"]
          post_count?: number
          slug?: string | null
          source_count?: number
          status?: Database["public"]["Enums"]["attention_cluster_status"]
          title: string
          total_donation_mom?: number
          updated_at?: string
        }
        Update: {
          attention_score?: number
          avatar_url?: string | null
          canonical_event_id?: string | null
          category?: string | null
          comment_count?: number
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          original_language?: Database["public"]["Enums"]["supported_language"]
          post_count?: number
          slug?: string | null
          source_count?: number
          status?: Database["public"]["Enums"]["attention_cluster_status"]
          title?: string
          total_donation_mom?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attention_clusters_canonical_event_id_fkey"
            columns: ["canonical_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attention_clusters_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attention_donations: {
        Row: {
          attention_score_boost: number
          bid_amount: number
          bid_currency: string
          builder_reward: number
          burn_amount: number
          cluster_id: string
          contributor_pool: number
          created_at: string
          donor_id: string | null
          donor_message: string | null
          energy_granted: number
          id: string
          is_anonymous: boolean
          legacy_amount_krw: number | null
          payment_status: string
        }
        Insert: {
          attention_score_boost?: number
          bid_amount?: number
          bid_currency?: string
          builder_reward?: number
          burn_amount?: number
          cluster_id: string
          contributor_pool?: number
          created_at?: string
          donor_id?: string | null
          donor_message?: string | null
          energy_granted?: number
          id?: string
          is_anonymous?: boolean
          legacy_amount_krw?: number | null
          payment_status?: string
        }
        Update: {
          attention_score_boost?: number
          bid_amount?: number
          bid_currency?: string
          builder_reward?: number
          burn_amount?: number
          cluster_id?: string
          contributor_pool?: number
          created_at?: string
          donor_id?: string | null
          donor_message?: string | null
          energy_granted?: number
          id?: string
          is_anonymous?: boolean
          legacy_amount_krw?: number | null
          payment_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attention_donations_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "attention_clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      attention_memberships: {
        Row: {
          attention_cluster_id: string
          created_at: string
          id: string
          notification_level: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attention_cluster_id: string
          created_at?: string
          id?: string
          notification_level?: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attention_cluster_id?: string
          created_at?: string
          id?: string
          notification_level?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attention_memberships_attention_cluster_id_fkey"
            columns: ["attention_cluster_id"]
            isOneToOne: false
            referencedRelation: "attention_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attention_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attention_merge_candidates: {
        Row: {
          candidate_cluster_id: string
          created_at: string
          created_by: string | null
          id: string
          match_reason: string | null
          match_score: number
          reviewed_at: string | null
          reviewed_by: string | null
          signals: Json
          source_cluster_id: string | null
          source_id: string | null
          status: Database["public"]["Enums"]["attention_merge_status"]
          updated_at: string
        }
        Insert: {
          candidate_cluster_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          match_reason?: string | null
          match_score?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          signals?: Json
          source_cluster_id?: string | null
          source_id?: string | null
          status?: Database["public"]["Enums"]["attention_merge_status"]
          updated_at?: string
        }
        Update: {
          candidate_cluster_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          match_reason?: string | null
          match_score?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          signals?: Json
          source_cluster_id?: string | null
          source_id?: string | null
          status?: Database["public"]["Enums"]["attention_merge_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attention_merge_candidates_candidate_cluster_id_fkey"
            columns: ["candidate_cluster_id"]
            isOneToOne: false
            referencedRelation: "attention_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attention_merge_candidates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attention_merge_candidates_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attention_merge_candidates_source_cluster_id_fkey"
            columns: ["source_cluster_id"]
            isOneToOne: false
            referencedRelation: "attention_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attention_merge_candidates_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "attention_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      attention_rules: {
        Row: {
          bond_amount: number
          bond_currency: string
          challenge_period_seconds: number
          created_at: string
          created_by: string | null
          event_id: string
          evidence_requirements: Json
          id: string
          locked_at: string | null
          min_evidence_count: number
          min_publisher_trust: number
          oracle_config: Json
          prompt_hash: string | null
          prompt_version: string | null
          question: string
          resolution_criteria: string
          source_requirements: Json
          status: Database["public"]["Enums"]["aio_rule_status"]
          supported_outcomes: string[]
          template_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          bond_amount?: number
          bond_currency?: string
          challenge_period_seconds?: number
          created_at?: string
          created_by?: string | null
          event_id: string
          evidence_requirements?: Json
          id?: string
          locked_at?: string | null
          min_evidence_count?: number
          min_publisher_trust?: number
          oracle_config?: Json
          prompt_hash?: string | null
          prompt_version?: string | null
          question: string
          resolution_criteria: string
          source_requirements?: Json
          status?: Database["public"]["Enums"]["aio_rule_status"]
          supported_outcomes?: string[]
          template_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          bond_amount?: number
          bond_currency?: string
          challenge_period_seconds?: number
          created_at?: string
          created_by?: string | null
          event_id?: string
          evidence_requirements?: Json
          id?: string
          locked_at?: string | null
          min_evidence_count?: number
          min_publisher_trust?: number
          oracle_config?: Json
          prompt_hash?: string | null
          prompt_version?: string | null
          question?: string
          resolution_criteria?: string
          source_requirements?: Json
          status?: Database["public"]["Enums"]["aio_rule_status"]
          supported_outcomes?: string[]
          template_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attention_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attention_rules_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attention_rules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "aio_rule_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      attention_source_ledger: {
        Row: {
          cluster_id: string
          created_at: string
          creator_id: string | null
          id: string
          merge_snapshot_at: string | null
          pre_merge_comment_count: number
          pre_merge_energy_weight: number
          pre_merge_post_count: number
          pre_merge_revenue_weight: number
          source_id: string
        }
        Insert: {
          cluster_id: string
          created_at?: string
          creator_id?: string | null
          id?: string
          merge_snapshot_at?: string | null
          pre_merge_comment_count?: number
          pre_merge_energy_weight?: number
          pre_merge_post_count?: number
          pre_merge_revenue_weight?: number
          source_id: string
        }
        Update: {
          cluster_id?: string
          created_at?: string
          creator_id?: string | null
          id?: string
          merge_snapshot_at?: string | null
          pre_merge_comment_count?: number
          pre_merge_energy_weight?: number
          pre_merge_post_count?: number
          pre_merge_revenue_weight?: number
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attention_source_ledger_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "attention_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attention_source_ledger_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attention_source_ledger_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: true
            referencedRelation: "attention_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      attention_source_snapshots: {
        Row: {
          captured_at: string
          ends_at: string | null
          event_id: string | null
          external_market_id: string | null
          id: string
          liquidity_label: string | null
          oracle_type: string | null
          probability: number | null
          raw_metadata: Json
          resolver_address: string | null
          rules_url: string | null
          source_platform: string
          source_url: string
          starts_at: string | null
          title: string | null
          volume_label: string | null
        }
        Insert: {
          captured_at?: string
          ends_at?: string | null
          event_id?: string | null
          external_market_id?: string | null
          id?: string
          liquidity_label?: string | null
          oracle_type?: string | null
          probability?: number | null
          raw_metadata?: Json
          resolver_address?: string | null
          rules_url?: string | null
          source_platform: string
          source_url: string
          starts_at?: string | null
          title?: string | null
          volume_label?: string | null
        }
        Update: {
          captured_at?: string
          ends_at?: string | null
          event_id?: string | null
          external_market_id?: string | null
          id?: string
          liquidity_label?: string | null
          oracle_type?: string | null
          probability?: number | null
          raw_metadata?: Json
          resolver_address?: string | null
          rules_url?: string | null
          source_platform?: string
          source_url?: string
          starts_at?: string | null
          title?: string | null
          volume_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attention_source_snapshots_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      attention_sources: {
        Row: {
          canonical_url: string | null
          cluster_id: string
          created_at: string
          description: string | null
          ends_at: string | null
          event_id: string | null
          external_market_id: string | null
          id: string
          imported_at: string
          imported_by: string | null
          oracle_type: string | null
          raw_metadata: Json
          reference_signal: number | null
          reference_signal_label: string | null
          resolution_source_url: string | null
          resolver_address: string | null
          rules_text: string | null
          source_platform: string
          source_type: Database["public"]["Enums"]["attention_source_type"]
          source_url: string | null
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          canonical_url?: string | null
          cluster_id: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          event_id?: string | null
          external_market_id?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          oracle_type?: string | null
          raw_metadata?: Json
          reference_signal?: number | null
          reference_signal_label?: string | null
          resolution_source_url?: string | null
          resolver_address?: string | null
          rules_text?: string | null
          source_platform: string
          source_type: Database["public"]["Enums"]["attention_source_type"]
          source_url?: string | null
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          canonical_url?: string | null
          cluster_id?: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          event_id?: string | null
          external_market_id?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          oracle_type?: string | null
          raw_metadata?: Json
          reference_signal?: number | null
          reference_signal_label?: string | null
          resolution_source_url?: string | null
          resolver_address?: string | null
          rules_text?: string | null
          source_platform?: string
          source_type?: Database["public"]["Enums"]["attention_source_type"]
          source_url?: string | null
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attention_sources_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "attention_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attention_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attention_sources_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attention_sponsorships: {
        Row: {
          bid_amount: number
          bid_currency: string
          click_count: number
          cluster_id: string
          created_at: string
          ends_at: string
          energy_granted: number
          id: string
          impression_count: number
          sponsor_color: string | null
          sponsor_id: string
          sponsor_logo_url: string | null
          sponsor_name: string
          sponsor_tagline: string | null
          sponsor_url: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          bid_amount: number
          bid_currency?: string
          click_count?: number
          cluster_id: string
          created_at?: string
          ends_at: string
          energy_granted?: number
          id?: string
          impression_count?: number
          sponsor_color?: string | null
          sponsor_id: string
          sponsor_logo_url?: string | null
          sponsor_name: string
          sponsor_tagline?: string | null
          sponsor_url: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          bid_amount?: number
          bid_currency?: string
          click_count?: number
          cluster_id?: string
          created_at?: string
          ends_at?: string
          energy_granted?: number
          id?: string
          impression_count?: number
          sponsor_color?: string | null
          sponsor_id?: string
          sponsor_logo_url?: string | null
          sponsor_name?: string
          sponsor_tagline?: string | null
          sponsor_url?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attention_sponsorships_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "attention_clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      attention_synergy_allocations: {
        Row: {
          allocated_to_source_id: string | null
          allocated_to_user_id: string | null
          allocation_method: string
          allocation_ratio: number
          cluster_id: string
          created_at: string
          id: string
          metadata: Json
          period_end: string
          period_start: string
          total_synergy_energy: number
          total_synergy_revenue: number
        }
        Insert: {
          allocated_to_source_id?: string | null
          allocated_to_user_id?: string | null
          allocation_method?: string
          allocation_ratio?: number
          cluster_id: string
          created_at?: string
          id?: string
          metadata?: Json
          period_end: string
          period_start: string
          total_synergy_energy?: number
          total_synergy_revenue?: number
        }
        Update: {
          allocated_to_source_id?: string | null
          allocated_to_user_id?: string | null
          allocation_method?: string
          allocation_ratio?: number
          cluster_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          period_end?: string
          period_start?: string
          total_synergy_energy?: number
          total_synergy_revenue?: number
        }
        Relationships: [
          {
            foreignKeyName: "attention_synergy_allocations_allocated_to_source_id_fkey"
            columns: ["allocated_to_source_id"]
            isOneToOne: false
            referencedRelation: "attention_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attention_synergy_allocations_allocated_to_user_id_fkey"
            columns: ["allocated_to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attention_synergy_allocations_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "attention_clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      bookmarks: {
        Row: {
          created_at: string
          id: string
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          target_id: string
          target_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: []
      }
      comment_original_versions: {
        Row: {
          comment_id: string
          created_at: string
          created_by: string | null
          id: string
          original_body: string
          original_hash: string | null
          original_language: Database["public"]["Enums"]["supported_language"]
          version: number
        }
        Insert: {
          comment_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          original_body: string
          original_hash?: string | null
          original_language: Database["public"]["Enums"]["supported_language"]
          version: number
        }
        Update: {
          comment_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          original_body?: string
          original_hash?: string | null
          original_language?: Database["public"]["Enums"]["supported_language"]
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "comment_original_versions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_original_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_translations: {
        Row: {
          body: string
          comment_id: string
          created_at: string
          id: string
          language: Database["public"]["Enums"]["supported_language"]
          model: string | null
          provider: string
          quality_score: number | null
          reviewed_by: string | null
          source_hash: string | null
          source_version: number
          status: Database["public"]["Enums"]["translation_status"]
          updated_at: string
        }
        Insert: {
          body: string
          comment_id: string
          created_at?: string
          id?: string
          language: Database["public"]["Enums"]["supported_language"]
          model?: string | null
          provider?: string
          quality_score?: number | null
          reviewed_by?: string | null
          source_hash?: string | null
          source_version?: number
          status?: Database["public"]["Enums"]["translation_status"]
          updated_at?: string
        }
        Update: {
          body?: string
          comment_id?: string
          created_at?: string
          id?: string
          language?: Database["public"]["Enums"]["supported_language"]
          model?: string | null
          provider?: string
          quality_score?: number | null
          reviewed_by?: string | null
          source_hash?: string | null
          source_version?: number
          status?: Database["public"]["Enums"]["translation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_translations_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_translations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          created_at: string
          id: string
          is_deleted: boolean
          like_count: number
          original_body: string
          original_hash: string | null
          original_language: Database["public"]["Enums"]["supported_language"]
          parent_comment_id: string | null
          post_id: string
          reply_count: number
          translation_status: Database["public"]["Enums"]["translation_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_deleted?: boolean
          like_count?: number
          original_body: string
          original_hash?: string | null
          original_language?: Database["public"]["Enums"]["supported_language"]
          parent_comment_id?: string | null
          post_id: string
          reply_count?: number
          translation_status?: Database["public"]["Enums"]["translation_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_deleted?: boolean
          like_count?: number
          original_body?: string
          original_hash?: string | null
          original_language?: Database["public"]["Enums"]["supported_language"]
          parent_comment_id?: string | null
          post_id?: string
          reply_count?: number
          translation_status?: Database["public"]["Enums"]["translation_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_topics: {
        Row: {
          confidence: number | null
          created_at: string
          id: string
          model: string | null
          source: string
          target_id: string
          target_type: Database["public"]["Enums"]["topic_target_type"]
          topic_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          id?: string
          model?: string | null
          source: string
          target_id: string
          target_type: Database["public"]["Enums"]["topic_target_type"]
          topic_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          id?: string
          model?: string | null
          source?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["topic_target_type"]
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      contributions: {
        Row: {
          created_at: string
          energy: number
          event_id: string | null
          id: string
          metadata: Json
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          energy?: number
          event_id?: string | null
          id?: string
          metadata?: Json
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          energy?: number
          event_id?: string | null
          id?: string
          metadata?: Json
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contributions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_members: {
        Row: {
          conversation_id: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          is_deleted: boolean
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_section_items: {
        Row: {
          created_at: string
          event_id: string | null
          id: string
          reason: string | null
          score: number
          section_id: string
          sort_order: number
          topic_id: string | null
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          id?: string
          reason?: string | null
          score?: number
          section_id: string
          sort_order?: number
          topic_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string | null
          id?: string
          reason?: string | null
          score?: number
          section_id?: string
          sort_order?: number
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discovery_section_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_section_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "discovery_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_section_items_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_sections: {
        Row: {
          category: string | null
          created_at: string
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["discovery_section_kind"]
          sort_order: number
          source_platform: string | null
          subtitle: string | null
          title: string
          topic_id: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["discovery_section_kind"]
          sort_order?: number
          source_platform?: string | null
          subtitle?: string | null
          title: string
          topic_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["discovery_section_kind"]
          sort_order?: number
          source_platform?: string | null
          subtitle?: string | null
          title?: string
          topic_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_sections_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      event_translations: {
        Row: {
          created_at: string
          description: string | null
          event_id: string
          id: string
          language: Database["public"]["Enums"]["supported_language"]
          model: string | null
          source_hash: string | null
          status: Database["public"]["Enums"]["translation_status"]
          title: string
          translated_by: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_id: string
          id?: string
          language: Database["public"]["Enums"]["supported_language"]
          model?: string | null
          source_hash?: string | null
          status?: Database["public"]["Enums"]["translation_status"]
          title: string
          translated_by?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_id?: string
          id?: string
          language?: Database["public"]["Enums"]["supported_language"]
          model?: string | null
          source_hash?: string | null
          status?: Database["public"]["Enums"]["translation_status"]
          title?: string
          translated_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_translations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          external_market_id: string | null
          id: string
          original_language: Database["public"]["Enums"]["supported_language"]
          resolution: string | null
          resolved_at: string | null
          slug: string | null
          source_platform: string | null
          source_url: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          external_market_id?: string | null
          id?: string
          original_language?: Database["public"]["Enums"]["supported_language"]
          resolution?: string | null
          resolved_at?: string | null
          slug?: string | null
          source_platform?: string | null
          source_url?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          external_market_id?: string | null
          id?: string
          original_language?: Database["public"]["Enums"]["supported_language"]
          resolution?: string | null
          resolved_at?: string | null
          slug?: string | null
          source_platform?: string | null
          source_url?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence: {
        Row: {
          ai_confidence: number | null
          captured_at: string | null
          content_hash: string | null
          created_at: string
          event_id: string
          id: string
          metadata_hash: string | null
          published_at: string | null
          publisher: string | null
          screenshot_url: string | null
          status: string
          submitted_by: string | null
          title: string | null
          url: string
        }
        Insert: {
          ai_confidence?: number | null
          captured_at?: string | null
          content_hash?: string | null
          created_at?: string
          event_id: string
          id?: string
          metadata_hash?: string | null
          published_at?: string | null
          publisher?: string | null
          screenshot_url?: string | null
          status?: string
          submitted_by?: string | null
          title?: string | null
          url: string
        }
        Update: {
          ai_confidence?: number | null
          captured_at?: string | null
          content_hash?: string | null
          created_at?: string
          event_id?: string
          id?: string
          metadata_hash?: string | null
          published_at?: string | null
          publisher?: string | null
          screenshot_url?: string | null
          status?: string
          submitted_by?: string | null
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          created_at: string
          href: string | null
          id: string
          is_read: boolean
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          href?: string | null
          id?: string
          is_read?: boolean
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          href?: string | null
          id?: string
          is_read?: boolean
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_fiat: number
          callback_data: Json
          created_at: string
          energy_credited_at: string | null
          fiat_currency: string
          id: string
          mom_energy_amount: number
          pay_amount: number | null
          pay_currency: string | null
          provider: string
          provider_invoice_id: string | null
          provider_payment_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_fiat?: number
          callback_data?: Json
          created_at?: string
          energy_credited_at?: string | null
          fiat_currency?: string
          id?: string
          mom_energy_amount?: number
          pay_amount?: number | null
          pay_currency?: string | null
          provider?: string
          provider_invoice_id?: string | null
          provider_payment_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_fiat?: number
          callback_data?: Json
          created_at?: string
          energy_credited_at?: string | null
          fiat_currency?: string
          id?: string
          mom_energy_amount?: number
          pay_amount?: number | null
          pay_currency?: string | null
          provider?: string
          provider_invoice_id?: string | null
          provider_payment_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_rate_history: {
        Row: {
          created_at: string
          id: string
          mom_rate: number
          snapshot_date: string
          total_mom_supply: number
          vault_usd: number
        }
        Insert: {
          created_at?: string
          id?: string
          mom_rate: number
          snapshot_date: string
          total_mom_supply: number
          vault_usd: number
        }
        Update: {
          created_at?: string
          id?: string
          mom_rate?: number
          snapshot_date?: string
          total_mom_supply?: number
          vault_usd?: number
        }
        Relationships: []
      }
      platform_revenue_ledger: {
        Row: {
          created_at: string
          currency: string
          energy_amount: number
          gross_amount: number
          id: string
          metadata: Json
          payment_id: string | null
          revenue_month: string
          source_id: string | null
          source_type: string
          status: string
          updated_at: string
          user_id: string | null
          vault_energy_amount: number | null
          vault_share_rate: number
        }
        Insert: {
          created_at?: string
          currency?: string
          energy_amount?: number
          gross_amount?: number
          id?: string
          metadata?: Json
          payment_id?: string | null
          revenue_month?: string
          source_id?: string | null
          source_type: string
          status?: string
          updated_at?: string
          user_id?: string | null
          vault_energy_amount?: number | null
          vault_share_rate?: number
        }
        Update: {
          created_at?: string
          currency?: string
          energy_amount?: number
          gross_amount?: number
          id?: string
          metadata?: Json
          payment_id?: string | null
          revenue_month?: string
          source_id?: string | null
          source_type?: string
          status?: string
          updated_at?: string
          user_id?: string | null
          vault_energy_amount?: number | null
          vault_share_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "platform_revenue_ledger_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_revenue_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_original_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          original_body: string
          original_hash: string | null
          original_language: Database["public"]["Enums"]["supported_language"]
          original_title: string | null
          post_id: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          original_body: string
          original_hash?: string | null
          original_language: Database["public"]["Enums"]["supported_language"]
          original_title?: string | null
          post_id: string
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          original_body?: string
          original_hash?: string | null
          original_language?: Database["public"]["Enums"]["supported_language"]
          original_title?: string | null
          post_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_original_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_original_versions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reaction_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_translations: {
        Row: {
          body: string
          created_at: string
          id: string
          language: Database["public"]["Enums"]["supported_language"]
          model: string | null
          post_id: string
          provider: string
          quality_score: number | null
          reviewed_by: string | null
          source_hash: string | null
          source_version: number
          status: Database["public"]["Enums"]["translation_status"]
          title: string | null
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          language: Database["public"]["Enums"]["supported_language"]
          model?: string | null
          post_id: string
          provider?: string
          quality_score?: number | null
          reviewed_by?: string | null
          source_hash?: string | null
          source_version?: number
          status?: Database["public"]["Enums"]["translation_status"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          language?: Database["public"]["Enums"]["supported_language"]
          model?: string | null
          post_id?: string
          provider?: string
          quality_score?: number | null
          reviewed_by?: string | null
          source_hash?: string | null
          source_version?: number
          status?: Database["public"]["Enums"]["translation_status"]
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_translations_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_translations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_unlocks: {
        Row: {
          author_earned: number
          burn_amount: number
          created_at: string
          energy_paid: number
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          author_earned: number
          burn_amount: number
          created_at?: string
          energy_paid: number
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          author_earned?: number
          burn_amount?: number
          created_at?: string
          energy_paid?: number
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_unlocks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          attention_cluster_id: string | null
          comment_count: number
          content_format: string
          created_at: string
          event_id: string | null
          id: string
          is_deleted: boolean
          is_pinned: boolean
          is_premium: boolean
          like_count: number
          link_description: string | null
          link_image_url: string | null
          link_title: string | null
          link_url: string | null
          media_items: Json
          original_body: string
          original_hash: string | null
          original_language: Database["public"]["Enums"]["supported_language"]
          original_title: string | null
          parent_post_id: string | null
          post_kind: string
          premium_energy_cost: number | null
          premium_total_earned: number
          premium_unlock_count: number
          repost_of_post_id: string | null
          selected_outcome: string | null
          share_count: number
          translation_status: Database["public"]["Enums"]["translation_status"]
          type: Database["public"]["Enums"]["post_type"]
          updated_at: string
          user_id: string
          view_count: number
          visibility: Database["public"]["Enums"]["content_visibility"]
        }
        Insert: {
          attention_cluster_id?: string | null
          comment_count?: number
          content_format?: string
          created_at?: string
          event_id?: string | null
          id?: string
          is_deleted?: boolean
          is_pinned?: boolean
          is_premium?: boolean
          like_count?: number
          link_description?: string | null
          link_image_url?: string | null
          link_title?: string | null
          link_url?: string | null
          media_items?: Json
          original_body: string
          original_hash?: string | null
          original_language?: Database["public"]["Enums"]["supported_language"]
          original_title?: string | null
          parent_post_id?: string | null
          post_kind?: string
          premium_energy_cost?: number | null
          premium_total_earned?: number
          premium_unlock_count?: number
          repost_of_post_id?: string | null
          selected_outcome?: string | null
          share_count?: number
          translation_status?: Database["public"]["Enums"]["translation_status"]
          type?: Database["public"]["Enums"]["post_type"]
          updated_at?: string
          user_id: string
          view_count?: number
          visibility?: Database["public"]["Enums"]["content_visibility"]
        }
        Update: {
          attention_cluster_id?: string | null
          comment_count?: number
          content_format?: string
          created_at?: string
          event_id?: string | null
          id?: string
          is_deleted?: boolean
          is_pinned?: boolean
          is_premium?: boolean
          like_count?: number
          link_description?: string | null
          link_image_url?: string | null
          link_title?: string | null
          link_url?: string | null
          media_items?: Json
          original_body?: string
          original_hash?: string | null
          original_language?: Database["public"]["Enums"]["supported_language"]
          original_title?: string | null
          parent_post_id?: string | null
          post_kind?: string
          premium_energy_cost?: number | null
          premium_total_earned?: number
          premium_unlock_count?: number
          repost_of_post_id?: string | null
          selected_outcome?: string | null
          share_count?: number
          translation_status?: Database["public"]["Enums"]["translation_status"]
          type?: Database["public"]["Enums"]["post_type"]
          updated_at?: string
          user_id?: string
          view_count?: number
          visibility?: Database["public"]["Enums"]["content_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "posts_attention_cluster_id_fkey"
            columns: ["attention_cluster_id"]
            isOneToOne: false
            referencedRelation: "attention_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_parent_post_id_fkey"
            columns: ["parent_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_repost_of_post_id_fkey"
            columns: ["repost_of_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          confidence: number | null
          created_at: string
          event_id: string
          id: string
          mom_energy_used: number
          prediction_label: string
          rationale: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          event_id: string
          id?: string
          mom_energy_used?: number
          prediction_label: string
          rationale?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          event_id?: string
          id?: string
          mom_energy_used?: number
          prediction_label?: string
          rationale?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          created_at: string
          daily_author_royalty: number
          daily_builder_royalty: number
          daily_royalty_date: string
          display_name: string | null
          follower_count: number
          following_count: number
          handle: string | null
          id: string
          mom_energy: number
          preferred_language: Database["public"]["Enums"]["supported_language"]
          referral_code: string | null
          referral_count: number
          referred_by: string | null
          social_links: Json
          trust_score: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          daily_author_royalty?: number
          daily_builder_royalty?: number
          daily_royalty_date?: string
          display_name?: string | null
          follower_count?: number
          following_count?: number
          handle?: string | null
          id: string
          mom_energy?: number
          preferred_language?: Database["public"]["Enums"]["supported_language"]
          referral_code?: string | null
          referral_count?: number
          referred_by?: string | null
          social_links?: Json
          trust_score?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          daily_author_royalty?: number
          daily_builder_royalty?: number
          daily_royalty_date?: string
          display_name?: string | null
          follower_count?: number
          following_count?: number
          handle?: string | null
          id?: string
          mom_energy?: number
          preferred_language?: Database["public"]["Enums"]["supported_language"]
          referral_code?: string | null
          referral_count?: number
          referred_by?: string | null
          social_links?: Json
          trust_score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      publisher_registry: {
        Row: {
          category: string | null
          country_code: string | null
          created_at: string
          domain: string
          id: string
          is_official_source: boolean
          notes: string | null
          publisher_name: string
          tier: number
          trust_weight: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          country_code?: string | null
          created_at?: string
          domain: string
          id?: string
          is_official_source?: boolean
          notes?: string | null
          publisher_name: string
          tier?: number
          trust_weight?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          country_code?: string | null
          created_at?: string
          domain?: string
          id?: string
          is_official_source?: boolean
          notes?: string | null
          publisher_name?: string
          tier?: number
          trust_weight?: number
          updated_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          bonus_paid: boolean
          created_at: string
          daily_shared_date: string
          daily_shared_today: number
          id: string
          referred_id: string
          referrer_id: string
          share_expires_at: string
          total_shared: number
        }
        Insert: {
          bonus_paid?: boolean
          created_at?: string
          daily_shared_date?: string
          daily_shared_today?: number
          id?: string
          referred_id: string
          referrer_id: string
          share_expires_at: string
          total_shared?: number
        }
        Update: {
          bonus_paid?: boolean
          created_at?: string
          daily_shared_date?: string
          daily_shared_today?: number
          id?: string
          referred_id?: string
          referrer_id?: string
          share_expires_at?: string
          total_shared?: number
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_allocations: {
        Row: {
          contribution_energy: number
          contribution_ratio: number
          created_at: string
          id: string
          pool_id: string
          reward_usdc: number
          status: string
          tx_hash: string | null
          user_id: string
        }
        Insert: {
          contribution_energy?: number
          contribution_ratio?: number
          created_at?: string
          id?: string
          pool_id: string
          reward_usdc?: number
          status?: string
          tx_hash?: string | null
          user_id: string
        }
        Update: {
          contribution_energy?: number
          contribution_ratio?: number
          created_at?: string
          id?: string
          pool_id?: string
          reward_usdc?: number
          status?: string
          tx_hash?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_allocations_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "reward_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_allocations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_pools: {
        Row: {
          created_at: string
          id: string
          merkle_root: string | null
          period_end: string
          period_start: string
          reward_amount_usdc: number | null
          reward_rate: number
          status: string
          total_revenue_usdc: number
        }
        Insert: {
          created_at?: string
          id?: string
          merkle_root?: string | null
          period_end: string
          period_start: string
          reward_amount_usdc?: number | null
          reward_rate?: number
          status?: string
          total_revenue_usdc?: number
        }
        Update: {
          created_at?: string
          id?: string
          merkle_root?: string | null
          period_end?: string
          period_start?: string
          reward_amount_usdc?: number | null
          reward_rate?: number
          status?: string
          total_revenue_usdc?: number
        }
        Relationships: []
      }
      site_config: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      topic_trend_snapshots: {
        Row: {
          attention_count: number
          comment_count: number
          created_at: string
          id: string
          post_count: number
          score: number
          topic_id: string
          window_end: string
          window_start: string
        }
        Insert: {
          attention_count?: number
          comment_count?: number
          created_at?: string
          id?: string
          post_count?: number
          score?: number
          topic_id: string
          window_end: string
          window_start: string
        }
        Update: {
          attention_count?: number
          comment_count?: number
          created_at?: string
          id?: string
          post_count?: number
          score?: number
          topic_id?: string
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_trend_snapshots_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          canonical_label: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["topic_kind"]
          labels: Json
          slug: string
          updated_at: string
        }
        Insert: {
          canonical_label: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind: Database["public"]["Enums"]["topic_kind"]
          labels?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          canonical_label?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["topic_kind"]
          labels?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          content_id: string
          content_type: string
          created_at: string
          error_message: string | null
          id: string
          locked_at: string | null
          model: string | null
          provider: string
          source_language: Database["public"]["Enums"]["supported_language"]
          source_version: number
          status: Database["public"]["Enums"]["translation_job_status"]
          target_language: Database["public"]["Enums"]["supported_language"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          content_id: string
          content_type: string
          created_at?: string
          error_message?: string | null
          id?: string
          locked_at?: string | null
          model?: string | null
          provider?: string
          source_language: Database["public"]["Enums"]["supported_language"]
          source_version?: number
          status?: Database["public"]["Enums"]["translation_job_status"]
          target_language: Database["public"]["Enums"]["supported_language"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          content_id?: string
          content_type?: string
          created_at?: string
          error_message?: string | null
          id?: string
          locked_at?: string | null
          model?: string | null
          provider?: string
          source_language?: Database["public"]["Enums"]["supported_language"]
          source_version?: number
          status?: Database["public"]["Enums"]["translation_job_status"]
          target_language?: Database["public"]["Enums"]["supported_language"]
          updated_at?: string
        }
        Relationships: []
      }
      user_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_interests: {
        Row: {
          created_at: string
          id: string
          interaction_count: number
          last_interaction_at: string
          score: number
          topic_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          interaction_count?: number
          last_interaction_at?: string
          score?: number
          topic_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interaction_count?: number
          last_interaction_at?: string
          score?: number
          topic_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_interests_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_interests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_distribution_allocations: {
        Row: {
          allocated_energy: number
          created_at: string
          distribution_id: string
          id: string
          share_ratio: number
          user_energy_at_snapshot: number
          user_id: string
        }
        Insert: {
          allocated_energy?: number
          created_at?: string
          distribution_id: string
          id?: string
          share_ratio?: number
          user_energy_at_snapshot?: number
          user_id: string
        }
        Update: {
          allocated_energy?: number
          created_at?: string
          distribution_id?: string
          id?: string
          share_ratio?: number
          user_energy_at_snapshot?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_distribution_allocations_distribution_id_fkey"
            columns: ["distribution_id"]
            isOneToOne: false
            referencedRelation: "vault_distributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vault_distribution_allocations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_distributions: {
        Row: {
          created_at: string
          distributed_by: string | null
          distributed_energy: number
          distribution_month: string
          distribution_rate: number
          id: string
          metadata: Json
          recipient_count: number
          status: string
          total_vault_energy: number
        }
        Insert: {
          created_at?: string
          distributed_by?: string | null
          distributed_energy?: number
          distribution_month: string
          distribution_rate?: number
          id?: string
          metadata?: Json
          recipient_count?: number
          status?: string
          total_vault_energy?: number
        }
        Update: {
          created_at?: string
          distributed_by?: string | null
          distributed_energy?: number
          distribution_month?: string
          distribution_rate?: number
          id?: string
          metadata?: Json
          recipient_count?: number
          status?: string
          total_vault_energy?: number
        }
        Relationships: [
          {
            foreignKeyName: "vault_distributions_distributed_by_fkey"
            columns: ["distributed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_milestones: {
        Row: {
          created_at: string
          id: number
          is_fully_open: boolean
          max_monthly_usd: number
          max_withdrawal_pct: number
          min_withdrawal_usd: number
          sort_order: number
          tier_emoji: string
          tier_name: string
          vault_threshold_usd: number
        }
        Insert: {
          created_at?: string
          id?: number
          is_fully_open?: boolean
          max_monthly_usd?: number
          max_withdrawal_pct?: number
          min_withdrawal_usd?: number
          sort_order?: number
          tier_emoji?: string
          tier_name: string
          vault_threshold_usd: number
        }
        Update: {
          created_at?: string
          id?: number
          is_fully_open?: boolean
          max_monthly_usd?: number
          max_withdrawal_pct?: number
          min_withdrawal_usd?: number
          sort_order?: number
          tier_emoji?: string
          tier_name?: string
          vault_threshold_usd?: number
        }
        Relationships: []
      }
      wallets: {
        Row: {
          address: string
          chain_id: number | null
          created_at: string
          id: string
          is_primary: boolean
          label: string | null
          user_id: string
          wallet_type: string
        }
        Insert: {
          address: string
          chain_id?: number | null
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          user_id: string
          wallet_type: string
        }
        Update: {
          address?: string
          chain_id?: number | null
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          user_id?: string
          wallet_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          created_at: string
          id: string
          mom_amount: number | null
          rate_at_request: number | null
          spread: number
          status: string
          tx_hash: string | null
          updated_at: string
          usd_amount: number | null
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          mom_amount?: number | null
          rate_at_request?: number | null
          spread?: number
          status?: string
          tx_hash?: string | null
          updated_at?: string
          usd_amount?: number | null
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          mom_amount?: number | null
          rate_at_request?: number | null
          spread?: number
          status?: string
          tx_hash?: string | null
          updated_at?: string
          usd_amount?: number | null
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      ad_bid_leaderboard: {
        Row: {
          bid_amount: number | null
          bid_currency: string | null
          bidder_id: string | null
          bidder_name: string | null
          campaign_title: string | null
          ends_at: string | null
          position: string | null
          rank: number | null
          starts_at: string | null
          status: string | null
        }
        Relationships: []
      }
      ad_campaign_performance: {
        Row: {
          advertiser_name: string | null
          budget_amount: number | null
          budget_type: string | null
          click_count: number | null
          created_at: string | null
          ctr_percent: number | null
          ends_at: string | null
          id: string | null
          impression_count: number | null
          positions: string[] | null
          spent_amount: number | null
          starts_at: string | null
          status: string | null
          title: string | null
        }
        Insert: {
          advertiser_name?: string | null
          budget_amount?: number | null
          budget_type?: string | null
          click_count?: number | null
          created_at?: string | null
          ctr_percent?: never
          ends_at?: string | null
          id?: string | null
          impression_count?: number | null
          positions?: string[] | null
          spent_amount?: number | null
          starts_at?: string | null
          status?: string | null
          title?: string | null
        }
        Update: {
          advertiser_name?: string | null
          budget_amount?: number | null
          budget_type?: string | null
          click_count?: number | null
          created_at?: string | null
          ctr_percent?: never
          ends_at?: string | null
          id?: string | null
          impression_count?: number | null
          positions?: string[] | null
          spent_amount?: number | null
          starts_at?: string | null
          status?: string | null
          title?: string | null
        }
        Relationships: []
      }
      attention_donor_rankings: {
        Row: {
          avatar_url: string | null
          cluster_id: string | null
          display_name: string | null
          donation_count: number | null
          handle: string | null
          last_donated_at: string | null
          rank: number | null
          total_donated_mom: number | null
          total_energy_granted: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attention_donations_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "attention_clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      attention_sponsorship_overview: {
        Row: {
          attention_slug: string | null
          attention_title: string | null
          bid_amount: number | null
          bid_currency: string | null
          click_count: number | null
          cluster_id: string | null
          created_at: string | null
          ctr_percent: number | null
          ends_at: string | null
          energy_granted: number | null
          id: string | null
          impression_count: number | null
          sponsor_name: string | null
          sponsor_tagline: string | null
          sponsor_url: string | null
          starts_at: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attention_sponsorships_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "attention_clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_contributor_rankings: {
        Row: {
          avatar_url: string | null
          comment_count: number | null
          display_name: string | null
          evidence_count: number | null
          follower_count: number | null
          handle: string | null
          percent_rank: number | null
          post_count: number | null
          rank: number | null
          share_count: number | null
          total_energy: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attention_activity_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_vault_overview: {
        Row: {
          cumulative_energy: number | null
          current_month: string | null
          current_rate: number | null
          distributable_usd: number | null
          distributed_energy: number | null
          distribution_pct: number | null
          monthly_energy: number | null
          next_distribution_date: string | null
          operations_pct: number | null
          operations_usd: number | null
          pending_withdrawal_usd: number | null
          posted_entry_count: number | null
          total_mom_supply: number | null
          total_withdrawn_usd: number | null
          updated_at: string | null
          vault_usd: number | null
        }
        Relationships: []
      }
      platform_vault_source_mix_current: {
        Row: {
          energy_amount: number | null
          percent: number | null
          source_type: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_aio_challenge_result: {
        Args: {
          accepted: boolean
          result_note?: string
          target_challenge_id: string
        }
        Returns: undefined
      }
      apply_attention_energy_delta: {
        Args: {
          activity: Database["public"]["Enums"]["attention_activity_type"]
          actor_user_id: string
          comment_delta?: number
          energy_delta: number
          metadata?: Json
          post_delta?: number
          target_cluster_id: string
        }
        Returns: undefined
      }
      apply_referral_share: {
        Args: {
          p_actor_id: string
          p_cluster_id: string
          p_energy_earned: number
        }
        Returns: undefined
      }
      cancel_withdrawal: {
        Args: { p_withdrawal_id: string }
        Returns: undefined
      }
      claim_referral_bonus: { Args: { p_referral_code: string }; Returns: Json }
      create_native_attention:
        | {
            Args: {
              category?: string
              description?: string
              ends_at?: string
              merge_target_cluster_id?: string
              original_language?: Database["public"]["Enums"]["supported_language"]
              resolution_criteria?: string
              title: string
            }
            Returns: string
          }
        | {
            Args: {
              category?: string
              description?: string
              ends_at?: string
              merge_target_cluster_id?: string
              original_language?: Database["public"]["Enums"]["supported_language"]
              resolution_criteria?: string
              supported_outcomes?: string[]
              title: string
            }
            Returns: string
          }
        | {
            Args: {
              category?: string
              description?: string
              ends_at?: string
              merge_target_cluster_id?: string
              original_language?: Database["public"]["Enums"]["supported_language"]
              resolution_criteria?: string
              supported_outcomes?: string[]
              title: string
              topic_slugs?: string[]
            }
            Returns: string
          }
      create_repost: {
        Args: {
          quote_body?: string
          quote_language?: Database["public"]["Enums"]["supported_language"]
          target_post_id: string
        }
        Returns: string
      }
      credit_mom_energy_for_payment: {
        Args: { target_payment_id: string }
        Returns: undefined
      }
      decay_user_interests: { Args: never; Returns: undefined }
      finalize_aio_assertion: {
        Args: { outcome: string; target_assertion_id: string }
        Returns: undefined
      }
      find_similar_attentions: {
        Args: {
          max_results?: number
          min_score?: number
          query_category?: string
          query_text: string
        }
        Returns: {
          attention_score: number
          category: string
          cluster_id: string
          match_source: string
          post_count: number
          similarity_score: number
          slug: string
          source_count: number
          title: string
        }[]
      }
      get_mom_rate: { Args: never; Returns: number }
      get_post_detail_secure: { Args: { p_post_id: string }; Returns: Json }
      get_recommended_post_ids: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          post_id: string
          relevance_score: number
        }[]
      }
      get_user_conversation_ids: { Args: { uid: string }; Returns: string[] }
      get_vault_milestone: {
        Args: never
        Returns: {
          created_at: string
          id: number
          is_fully_open: boolean
          max_monthly_usd: number
          max_withdrawal_pct: number
          min_withdrawal_usd: number
          sort_order: number
          tier_emoji: string
          tier_name: string
          vault_threshold_usd: number
        }
        SetofOptions: {
          from: "*"
          to: "vault_milestones"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      import_attention_source: {
        Args: {
          category?: string
          description?: string
          ends_at?: string
          external_market_id?: string
          merge_target_cluster_id?: string
          oracle_type?: string
          raw_metadata?: Json
          reference_signal?: number
          reference_signal_label?: string
          resolver_address?: string
          rules_text?: string
          source_platform: string
          source_url: string
          title: string
        }
        Returns: string
      }
      normalize_attention_url: { Args: { input_url: string }; Returns: string }
      recalculate_attention_energy: {
        Args: { target_cluster_id: string }
        Returns: number
      }
      recalculate_attention_stats: {
        Args: { target_cluster_id: string }
        Returns: undefined
      }
      record_platform_revenue: {
        Args: {
          p_currency?: string
          p_energy_amount?: number
          p_gross_amount: number
          p_metadata?: Json
          p_payment_id?: string
          p_revenue_month?: string
          p_source_id?: string
          p_source_type: string
          p_user_id?: string
          p_vault_share_rate?: number
        }
        Returns: string
      }
      record_sponsorship_click: {
        Args: { p_sponsorship_id: string }
        Returns: undefined
      }
      record_sponsorship_impression: {
        Args: { p_sponsorship_id: string }
        Returns: undefined
      }
      request_withdrawal: {
        Args: { p_mom_amount: number; p_wallet_id?: string }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      slugify_attention: { Args: { input_text: string }; Returns: string }
      snapshot_mom_rate: { Args: never; Returns: undefined }
      submit_ad_bid: {
        Args: {
          p_bid_amount: number
          p_bid_currency?: string
          p_campaign_id: string
          p_ends_at: string
          p_position: string
          p_starts_at: string
        }
        Returns: Json
      }
      submit_aio_assertion: {
        Args: {
          p_asserted_outcome: string
          p_claim_text: string
          p_event_id: string
          p_original_language?: Database["public"]["Enums"]["supported_language"]
          p_rule_id: string
        }
        Returns: string
      }
      submit_aio_challenge: {
        Args: {
          counter_claim_text: string
          counter_outcome?: string
          original_language?: Database["public"]["Enums"]["supported_language"]
          target_assertion_id: string
        }
        Returns: string
      }
      submit_attention_donation: {
        Args: {
          p_bid_amount: number
          p_bid_currency?: string
          p_cluster_id: string
          p_is_anonymous?: boolean
          p_message?: string
        }
        Returns: Json
      }
      submit_attention_sponsorship: {
        Args: {
          p_bid_amount: number
          p_bid_currency?: string
          p_cluster_id: string
          p_ends_at: string
          p_sponsor_color?: string
          p_sponsor_logo_url?: string
          p_sponsor_name: string
          p_sponsor_tagline?: string
          p_sponsor_url: string
          p_starts_at: string
        }
        Returns: Json
      }
      toggle_attention_membership: {
        Args: { target_attention_cluster_id: string }
        Returns: Json
      }
      toggle_post_like: { Args: { target_post_id: string }; Returns: Json }
      toggle_user_follow: { Args: { target_user_id: string }; Returns: Json }
      unlock_premium_post: { Args: { p_post_id: string }; Returns: Json }
      update_user_interest: {
        Args: { p_post_id: string; p_signal_weight: number; p_user_id: string }
        Returns: undefined
      }
      update_user_interest_for_attention: {
        Args: {
          p_attention_id: string
          p_signal_weight: number
          p_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      aio_assertion_status:
        | "draft"
        | "submitted"
        | "evidence_captured"
        | "llm_verified"
        | "challenge_period"
        | "challenged"
        | "finalized"
        | "rejected"
        | "cancelled"
      aio_challenge_status:
        | "submitted"
        | "evidence_captured"
        | "llm_verified"
        | "accepted"
        | "rejected"
        | "escalated"
        | "cancelled"
      aio_rule_status: "draft" | "active" | "locked" | "retired"
      aio_verdict:
        | "supports"
        | "refutes"
        | "ambiguous"
        | "invalid_evidence"
        | "insufficient_evidence"
      attention_activity_type:
        | "post"
        | "comment"
        | "boost"
        | "ad"
        | "subscription"
        | "evidence"
        | "share"
        | "source_create"
        | "source_import"
        | "merge"
        | "ad_revenue"
        | "sponsorship"
        | "builder_royalty"
        | "author_royalty"
        | "referral_bonus"
        | "referral_share"
      attention_cluster_status: "active" | "reviewing" | "merged" | "archived"
      attention_merge_status: "pending" | "accepted" | "rejected" | "cancelled"
      attention_source_type:
        | "native"
        | "polymarket"
        | "kalshi"
        | "manifold"
        | "predictit"
        | "news"
        | "official"
        | "other"
      content_visibility:
        | "public"
        | "subscribers_only"
        | "paid_room"
        | "archived"
      discovery_section_kind:
        | "breaking"
        | "popular_topic"
        | "category"
        | "external_source"
        | "ending_soon"
      event_status: "draft" | "open" | "resolved" | "disputed" | "archived"
      post_type: "analysis" | "evidence" | "signal" | "room_note"
      supported_language: "ko" | "en" | "es"
      topic_kind:
        | "user_hashtag"
        | "ai_keyword"
        | "entity"
        | "category"
        | "source_platform"
      topic_target_type: "attention" | "post" | "comment" | "source"
      translation_job_status:
        | "queued"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
      translation_status: "pending" | "translated" | "needs_review" | "failed"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      aio_assertion_status: [
        "draft",
        "submitted",
        "evidence_captured",
        "llm_verified",
        "challenge_period",
        "challenged",
        "finalized",
        "rejected",
        "cancelled",
      ],
      aio_challenge_status: [
        "submitted",
        "evidence_captured",
        "llm_verified",
        "accepted",
        "rejected",
        "escalated",
        "cancelled",
      ],
      aio_rule_status: ["draft", "active", "locked", "retired"],
      aio_verdict: [
        "supports",
        "refutes",
        "ambiguous",
        "invalid_evidence",
        "insufficient_evidence",
      ],
      attention_activity_type: [
        "post",
        "comment",
        "boost",
        "ad",
        "subscription",
        "evidence",
        "share",
        "source_create",
        "source_import",
        "merge",
        "ad_revenue",
        "sponsorship",
        "builder_royalty",
        "author_royalty",
        "referral_bonus",
        "referral_share",
      ],
      attention_cluster_status: ["active", "reviewing", "merged", "archived"],
      attention_merge_status: ["pending", "accepted", "rejected", "cancelled"],
      attention_source_type: [
        "native",
        "polymarket",
        "kalshi",
        "manifold",
        "predictit",
        "news",
        "official",
        "other",
      ],
      content_visibility: [
        "public",
        "subscribers_only",
        "paid_room",
        "archived",
      ],
      discovery_section_kind: [
        "breaking",
        "popular_topic",
        "category",
        "external_source",
        "ending_soon",
      ],
      event_status: ["draft", "open", "resolved", "disputed", "archived"],
      post_type: ["analysis", "evidence", "signal", "room_note"],
      supported_language: ["ko", "en", "es"],
      topic_kind: [
        "user_hashtag",
        "ai_keyword",
        "entity",
        "category",
        "source_platform",
      ],
      topic_target_type: ["attention", "post", "comment", "source"],
      translation_job_status: [
        "queued",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ],
      translation_status: ["pending", "translated", "needs_review", "failed"],
    },
  },
} as const
export type SupportedLanguage = 'ko' | 'en' | 'es';
