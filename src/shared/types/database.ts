export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SupportedLanguage = "ko" | "en" | "es";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          handle: string | null;
          display_name: string | null;
          avatar_url: string | null;
          banner_url: string | null;
          bio: string | null;
          social_links: Json;
          preferred_language: SupportedLanguage;
          trust_score: number;
          mom_energy: number;
          follower_count: number;
          following_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          handle?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          banner_url?: string | null;
          bio?: string | null;
          social_links?: Json;
          preferred_language?: SupportedLanguage;
          trust_score?: number;
          mom_energy?: number;
          follower_count?: number;
          following_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          slug: string | null;
          title: string;
          description: string | null;
          category: string | null;
          source_platform: string | null;
          source_url: string | null;
          external_market_id: string | null;
          original_language: SupportedLanguage;
          status: "draft" | "open" | "resolved" | "disputed" | "archived";
          resolution: string | null;
          starts_at: string | null;
          ends_at: string | null;
          resolved_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug?: string | null;
          title: string;
          description?: string | null;
          category?: string | null;
          source_platform?: string | null;
          source_url?: string | null;
          external_market_id?: string | null;
          original_language?: SupportedLanguage;
          status?: "draft" | "open" | "resolved" | "disputed" | "archived";
          resolution?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          resolved_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["events"]["Insert"]>;
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          user_id: string;
          event_id: string | null;
          attention_cluster_id: string | null;
          parent_post_id: string | null;
          repost_of_post_id: string | null;
          post_kind: "post" | "reply" | "repost" | "quote";
          selected_outcome: string | null;
          type: "analysis" | "evidence" | "signal" | "room_note";
          visibility: "public" | "subscribers_only" | "paid_room" | "archived";
          original_language: SupportedLanguage;
          original_title: string | null;
          original_body: string;
          link_title: string | null;
          link_url: string | null;
          media_items: Json;
          original_hash: string | null;
          translation_status: "pending" | "translated" | "needs_review" | "failed";
          like_count: number;
          comment_count: number;
          share_count: number;
          view_count: number;
          is_deleted: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_id?: string | null;
          attention_cluster_id?: string | null;
          parent_post_id?: string | null;
          repost_of_post_id?: string | null;
          post_kind?: "post" | "reply" | "repost" | "quote";
          selected_outcome?: string | null;
          type?: "analysis" | "evidence" | "signal" | "room_note";
          visibility?: "public" | "subscribers_only" | "paid_room" | "archived";
          original_language?: SupportedLanguage;
          original_title?: string | null;
          original_body: string;
          link_title?: string | null;
          link_url?: string | null;
          media_items?: Json;
          original_hash?: string | null;
          translation_status?: "pending" | "translated" | "needs_review" | "failed";
          like_count?: number;
          comment_count?: number;
          share_count?: number;
          view_count?: number;
          is_deleted?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["posts"]["Insert"]>;
        Relationships: [];
      };
      post_translations: {
        Row: {
          id: string;
          post_id: string;
          source_version: number;
          language: SupportedLanguage;
          title: string | null;
          body: string;
          status: "pending" | "translated" | "needs_review" | "failed";
          provider: string;
          model: string | null;
          source_hash: string | null;
          quality_score: number | null;
          reviewed_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          source_version?: number;
          language: SupportedLanguage;
          title?: string | null;
          body: string;
          status?: "pending" | "translated" | "needs_review" | "failed";
          provider?: string;
          model?: string | null;
          source_hash?: string | null;
          quality_score?: number | null;
          reviewed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["post_translations"]["Insert"]>;
        Relationships: [];
      };
      comments: {
        Row: {
          id: string;
          post_id: string;
          parent_comment_id: string | null;
          user_id: string;
          original_language: SupportedLanguage;
          original_body: string;
          original_hash: string | null;
          translation_status: "pending" | "translated" | "needs_review" | "failed";
          like_count: number;
          reply_count: number;
          is_deleted: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          parent_comment_id?: string | null;
          user_id: string;
          original_language?: SupportedLanguage;
          original_body: string;
          original_hash?: string | null;
          translation_status?: "pending" | "translated" | "needs_review" | "failed";
          is_deleted?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["comments"]["Insert"]>;
        Relationships: [];
      };
      post_reactions: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          reaction_type: "like";
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          reaction_type?: "like";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["post_reactions"]["Insert"]>;
        Relationships: [];
      };
      comment_translations: {
        Row: {
          id: string;
          comment_id: string;
          source_version: number;
          language: SupportedLanguage;
          body: string;
          status: "pending" | "translated" | "needs_review" | "failed";
          provider: string;
          model: string | null;
          source_hash: string | null;
          quality_score: number | null;
          reviewed_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          comment_id: string;
          source_version?: number;
          language: SupportedLanguage;
          body: string;
          status?: "pending" | "translated" | "needs_review" | "failed";
          provider?: string;
          model?: string | null;
          source_hash?: string | null;
          quality_score?: number | null;
          reviewed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["comment_translations"]["Insert"]>;
        Relationships: [];
      };
      translation_jobs: {
        Row: {
          id: string;
          batch_id: string | null;
          content_type: "event" | "post" | "comment";
          content_id: string;
          source_version: number;
          source_language: SupportedLanguage;
          target_language: SupportedLanguage;
          status: "queued" | "processing" | "completed" | "failed" | "cancelled";
          priority: number;
          provider: string;
          model: string | null;
          attempts: number;
          max_attempts: number;
          error_message: string | null;
          scheduled_at: string;
          next_attempt_at: string;
          locked_at: string | null;
          locked_by: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          batch_id?: string | null;
          content_type: "event" | "post" | "comment";
          content_id: string;
          source_version?: number;
          source_language: SupportedLanguage;
          target_language: SupportedLanguage;
          status?: "queued" | "processing" | "completed" | "failed" | "cancelled";
          priority?: number;
          provider?: string;
          model?: string | null;
          attempts?: number;
          max_attempts?: number;
          error_message?: string | null;
          scheduled_at?: string;
          next_attempt_at?: string;
          locked_at?: string | null;
          locked_by?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["translation_jobs"]["Insert"]>;
        Relationships: [];
      };
      translation_batches: {
        Row: {
          id: string;
          status: "draft" | "running" | "completed" | "failed" | "cancelled";
          target_languages: SupportedLanguage[];
          content_types: string[];
          min_created_at: string | null;
          max_created_at: string | null;
          limit_count: number;
          job_count: number;
          completed_count: number;
          failed_count: number;
          provider: string;
          model: string | null;
          created_by: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          status?: "draft" | "running" | "completed" | "failed" | "cancelled";
          target_languages?: SupportedLanguage[];
          content_types?: string[];
          min_created_at?: string | null;
          max_created_at?: string | null;
          limit_count?: number;
          job_count?: number;
          completed_count?: number;
          failed_count?: number;
          provider?: string;
          model?: string | null;
          created_by?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["translation_batches"]["Insert"]>;
        Relationships: [];
      };
      attention_clusters: {
        Row: {
          id: string;
          canonical_event_id: string | null;
          slug: string | null;
          title: string;
          description: string | null;
          category: string | null;
          original_language: SupportedLanguage;
          status: "active" | "reviewing" | "merged" | "archived";
          source_count: number;
          post_count: number;
          comment_count: number;
          attention_score: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          canonical_event_id?: string | null;
          slug?: string | null;
          title: string;
          description?: string | null;
          category?: string | null;
          original_language?: SupportedLanguage;
          status?: "active" | "reviewing" | "merged" | "archived";
          source_count?: number;
          post_count?: number;
          comment_count?: number;
          attention_score?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["attention_clusters"]["Insert"]>;
        Relationships: [];
      };
      attention_sources: {
        Row: {
          id: string;
          cluster_id: string;
          event_id: string | null;
          source_type: "native" | "polymarket" | "kalshi" | "manifold" | "predictit" | "news" | "official" | "other";
          source_platform: string;
          source_url: string | null;
          canonical_url: string | null;
          external_market_id: string | null;
          title: string;
          description: string | null;
          rules_text: string | null;
          oracle_type: string | null;
          resolver_address: string | null;
          resolution_source_url: string | null;
          reference_signal_label: string | null;
          reference_signal: number | null;
          starts_at: string | null;
          ends_at: string | null;
          raw_metadata: Json;
          imported_by: string | null;
          imported_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cluster_id: string;
          event_id?: string | null;
          source_type: "native" | "polymarket" | "kalshi" | "manifold" | "predictit" | "news" | "official" | "other";
          source_platform: string;
          source_url?: string | null;
          canonical_url?: string | null;
          external_market_id?: string | null;
          title: string;
          description?: string | null;
          rules_text?: string | null;
          oracle_type?: string | null;
          resolver_address?: string | null;
          resolution_source_url?: string | null;
          reference_signal_label?: string | null;
          reference_signal?: number | null;
          starts_at?: string | null;
          ends_at?: string | null;
          raw_metadata?: Json;
          imported_by?: string | null;
          imported_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["attention_sources"]["Insert"]>;
        Relationships: [];
      };
      attention_memberships: {
        Row: {
          id: string;
          attention_cluster_id: string;
          user_id: string;
          role: "member" | "moderator" | "creator";
          notification_level: "off" | "normal" | "high";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          attention_cluster_id: string;
          user_id: string;
          role?: "member" | "moderator" | "creator";
          notification_level?: "off" | "normal" | "high";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["attention_memberships"]["Insert"]>;
        Relationships: [];
      };
      attention_rules: {
        Row: {
          id: string;
          event_id: string;
          template_id: string | null;
          title: string;
          question: string;
          resolution_criteria: string;
          supported_outcomes: string[];
          evidence_requirements: Json;
          source_requirements: Json;
          challenge_period_seconds: number;
          min_evidence_count: number;
          min_publisher_trust: number;
          bond_amount: number;
          bond_currency: string;
          oracle_config: Json;
          prompt_version: string | null;
          prompt_hash: string | null;
          status: "draft" | "active" | "locked" | "resolved" | "disputed" | "archived";
          locked_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          template_id?: string | null;
          title: string;
          question: string;
          resolution_criteria: string;
          supported_outcomes?: string[];
          evidence_requirements?: Json;
          source_requirements?: Json;
          challenge_period_seconds?: number;
          min_evidence_count?: number;
          min_publisher_trust?: number;
          bond_amount?: number;
          bond_currency?: string;
          oracle_config?: Json;
          prompt_version?: string | null;
          prompt_hash?: string | null;
          status?: "draft" | "active" | "locked" | "resolved" | "disputed" | "archived";
          locked_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["attention_rules"]["Insert"]>;
        Relationships: [];
      };
      topics: {
        Row: {
          id: string;
          slug: string;
          kind: "user_hashtag" | "ai_keyword" | "entity" | "category" | "source_platform";
          canonical_label: string;
          labels: Json;
          description: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          kind: "user_hashtag" | "ai_keyword" | "entity" | "category" | "source_platform";
          canonical_label: string;
          labels?: Json;
          description?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["topics"]["Insert"]>;
        Relationships: [];
      };
      content_topics: {
        Row: {
          id: string;
          topic_id: string;
          target_type: "attention" | "post" | "comment" | "source";
          target_id: string;
          source: "user" | "llm" | "admin" | "system";
          confidence: number | null;
          model: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          topic_id: string;
          target_type: "attention" | "post" | "comment" | "source";
          target_id: string;
          source: "user" | "llm" | "admin" | "system";
          confidence?: number | null;
          model?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["content_topics"]["Insert"]>;
        Relationships: [];
      };
      topic_trend_snapshots: {
        Row: {
          id: string;
          topic_id: string;
          window_start: string;
          window_end: string;
          post_count: number;
          comment_count: number;
          attention_count: number;
          score: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          topic_id: string;
          window_start: string;
          window_end: string;
          post_count?: number;
          comment_count?: number;
          attention_count?: number;
          score?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["topic_trend_snapshots"]["Insert"]>;
        Relationships: [];
      };
      user_follows: {
        Row: {
          id: string;
          follower_id: string;
          following_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          follower_id: string;
          following_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_follows"]["Insert"]>;
        Relationships: [];
      };
      wallets: {
        Row: {
          id: string;
          user_id: string;
          address: string;
          chain_id: number | null;
          wallet_type: "thirdweb_in_app" | "external" | "tookwallet";
          is_primary: boolean;
          label: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          address: string;
          chain_id?: number | null;
          wallet_type: "thirdweb_in_app" | "external" | "tookwallet";
          is_primary?: boolean;
          label?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["wallets"]["Insert"]>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          user_id: string;
          provider: "nowpayments";
          provider_payment_id: string | null;
          provider_invoice_id: string | null;
          amount_fiat: number;
          fiat_currency: string;
          pay_currency: string | null;
          pay_amount: number | null;
          mom_energy_amount: number;
          status: "pending" | "confirming" | "confirmed" | "sending" | "finished" | "failed" | "refunded" | "expired";
          callback_data: Json;
          energy_credited_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider?: "nowpayments";
          provider_payment_id?: string | null;
          provider_invoice_id?: string | null;
          amount_fiat: number;
          fiat_currency?: string;
          pay_currency?: string | null;
          pay_amount?: number | null;
          mom_energy_amount: number;
          status?: "pending" | "confirming" | "confirmed" | "sending" | "finished" | "failed" | "refunded" | "expired";
          callback_data?: Json;
          energy_credited_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [];
      };
      platform_revenue_ledger: {
        Row: {
          id: string;
          source_type:
            | "nowpayments_energy_purchase"
            | "adsense"
            | "advertiser_direct"
            | "creator_subscription"
            | "attention_boost"
            | "super_comment"
            | "sponsor_campaign"
            | "data_api"
            | "manual_adjustment"
            | "other";
          source_id: string | null;
          payment_id: string | null;
          user_id: string | null;
          gross_amount: number;
          currency: string;
          energy_amount: number;
          vault_share_rate: number;
          vault_energy_amount: number;
          revenue_month: string;
          status: "posted" | "pending" | "void";
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source_type:
            | "nowpayments_energy_purchase"
            | "adsense"
            | "advertiser_direct"
            | "creator_subscription"
            | "attention_boost"
            | "super_comment"
            | "sponsor_campaign"
            | "data_api"
            | "manual_adjustment"
            | "other";
          source_id?: string | null;
          payment_id?: string | null;
          user_id?: string | null;
          gross_amount?: number;
          currency?: string;
          energy_amount?: number;
          vault_share_rate?: number;
          revenue_month?: string;
          status?: "posted" | "pending" | "void";
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["platform_revenue_ledger"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      attention_contributor_rankings: {
        Row: {
          cluster_id: string;
          user_id: string;
          handle: string | null;
          display_name: string | null;
          avatar_url: string | null;
          total_energy: number;
          contribution_ratio: number;
          post_count: number;
          comment_count: number;
          evidence_count: number;
          donation_count: number;
          share_count: number;
          role_badge: string;
          rank: number;
        };
        Relationships: [];
      };
      attention_donor_rankings: {
        Row: {
          cluster_id: string;
          user_id: string;
          handle: string | null;
          display_name: string | null;
          avatar_url: string | null;
          donation_count: number;
          total_donated_krw: number;
          total_energy_granted: number;
          last_donated_at: string;
          rank: number;
        };
        Relationships: [];
      };
      platform_vault_overview: {
        Row: {
          vault_usd: number;
          total_mom_supply: number;
          current_rate: number;
          total_withdrawn_usd: number;
          pending_withdrawal_usd: number;
          posted_entry_count: number;
          updated_at: string | null;
          cumulative_energy: number;
          monthly_energy: number;
          distributed_energy: number;
          current_month: string;
          next_distribution_date: string;
        };
        Relationships: [];
      };
      platform_vault_source_mix_current: {
        Row: {
          source_type: string;
          energy_amount: number;
          percent: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      enqueue_missing_translations_for_post: {
        Args: {
          target_post_id: string;
        };
        Returns: number;
      };
      enqueue_missing_translations_for_comment: {
        Args: {
          target_comment_id: string;
        };
        Returns: number;
      };
      toggle_post_like: {
        Args: {
          target_post_id: string;
        };
        Returns: Json;
      };
      create_repost: {
        Args: {
          target_post_id: string;
          quote_body?: string | null;
          quote_language?: SupportedLanguage;
        };
        Returns: string;
      };
      toggle_attention_membership: {
        Args: {
          target_attention_cluster_id: string;
        };
        Returns: Json;
      };
      toggle_user_follow: {
        Args: {
          target_user_id: string;
        };
        Returns: Json;
      };
      create_native_attention: {
        Args: {
          title: string;
          description?: string | null;
          category?: string | null;
          resolution_criteria?: string | null;
          ends_at?: string | null;
          original_language?: SupportedLanguage;
          merge_target_cluster_id?: string | null;
          supported_outcomes?: string[];
        };
        Returns: string;
      };
      import_attention_source: {
        Args: {
          source_url: string;
          source_platform: string;
          title: string;
          description?: string | null;
          category?: string | null;
          rules_text?: string | null;
          oracle_type?: string | null;
          resolver_address?: string | null;
          external_market_id?: string | null;
          reference_signal?: number | null;
          reference_signal_label?: string | null;
          ends_at?: string | null;
          raw_metadata?: Json;
          merge_target_cluster_id?: string | null;
        };
        Returns: string;
      };
      submit_aio_challenge: {
        Args: {
          target_assertion_id: string;
          counter_claim_text: string;
          counter_outcome?: string | null;
          original_language?: SupportedLanguage;
        };
        Returns: string;
      };
      record_platform_revenue: {
        Args: {
          p_source_type: string;
          p_gross_amount: number;
          p_currency?: string;
          p_energy_amount?: number | null;
          p_vault_share_rate?: number;
          p_source_id?: string | null;
          p_payment_id?: string | null;
          p_user_id?: string | null;
          p_revenue_month?: string | null;
          p_metadata?: Json;
        };
        Returns: string;
      };
      get_mom_rate: {
        Args: Record<string, never>;
        Returns: number;
      };
      request_withdrawal: {
        Args: {
          p_mom_amount: number;
          p_wallet_id?: string | null;
        };
        Returns: Json;
      };
      cancel_withdrawal: {
        Args: {
          p_withdrawal_id: string;
        };
        Returns: void;
      };
    };
    Enums: {
      supported_language: SupportedLanguage;
    };
    CompositeTypes: Record<string, never>;
  };
};
