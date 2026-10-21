export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      agreement_partners: {
        Row: {
          agreement_id: string
          continent_code_snapshot: string | null
          country_id_snapshot: string | null
          country_name_en_snapshot: string | null
          country_name_th_snapshot: string | null
          country_override_reason: string | null
          country_source: string
          created_at: string
          created_by: string | null
          is_lead: boolean
          partner_name_en_snapshot: string | null
          partner_name_th_snapshot: string | null
          partner_organization_id: string
        }
        Insert: {
          agreement_id: string
          continent_code_snapshot?: string | null
          country_id_snapshot?: string | null
          country_name_en_snapshot?: string | null
          country_name_th_snapshot?: string | null
          country_override_reason?: string | null
          country_source?: string
          created_at?: string
          created_by?: string | null
          is_lead?: boolean
          partner_name_en_snapshot?: string | null
          partner_name_th_snapshot?: string | null
          partner_organization_id: string
        }
        Update: {
          agreement_id?: string
          continent_code_snapshot?: string | null
          country_id_snapshot?: string | null
          country_name_en_snapshot?: string | null
          country_name_th_snapshot?: string | null
          country_override_reason?: string | null
          country_source?: string
          created_at?: string
          created_by?: string | null
          is_lead?: boolean
          partner_name_en_snapshot?: string | null
          partner_name_th_snapshot?: string | null
          partner_organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreement_partners_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_partners_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_partners_country_id_snapshot_fkey"
            columns: ["country_id_snapshot"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_partners_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_partners_partner_organization_id_fkey"
            columns: ["partner_organization_id"]
            isOneToOne: false
            referencedRelation: "partner_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_units: {
        Row: {
          agreement_id: string
          created_at: string
          created_by: string | null
          is_owner: boolean
          organization_unit_id: string
        }
        Insert: {
          agreement_id: string
          created_at?: string
          created_by?: string | null
          is_owner?: boolean
          organization_unit_id: string
        }
        Update: {
          agreement_id?: string
          created_at?: string
          created_by?: string | null
          is_owner?: boolean
          organization_unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreement_units_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_units_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_units_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_units_organization_unit_id_fkey"
            columns: ["organization_unit_id"]
            isOneToOne: false
            referencedRelation: "organization_units"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_workflow_events: {
        Row: {
          action: string
          agreement_id: string
          created_at: string
          created_by: string
          from_status: Database["public"]["Enums"]["workflow_status"] | null
          id: string
          note: string | null
          to_status: Database["public"]["Enums"]["workflow_status"]
        }
        Insert: {
          action: string
          agreement_id: string
          created_at?: string
          created_by: string
          from_status?: Database["public"]["Enums"]["workflow_status"] | null
          id?: string
          note?: string | null
          to_status: Database["public"]["Enums"]["workflow_status"]
        }
        Update: {
          action?: string
          agreement_id?: string
          created_at?: string
          created_by?: string
          from_status?: Database["public"]["Enums"]["workflow_status"] | null
          id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["workflow_status"]
        }
        Relationships: [
          {
            foreignKeyName: "agreement_workflow_events_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_workflow_events_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_workflow_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agreements: {
        Row: {
          agreement_number: string | null
          agreement_type: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          deleted_by: string | null
          end_date: string | null
          fiscal_year: number | null
          id: string
          internal_note: string | null
          legacy_id: string | null
          public_visible: boolean
          publication_status: Database["public"]["Enums"]["publication_status"]
          signed_date: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["agreement_status"]
          title_en: string | null
          title_th: string
          updated_at: string
          updated_by: string | null
          workflow_status: Database["public"]["Enums"]["workflow_status"]
        }
        Insert: {
          agreement_number?: string | null
          agreement_type?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          deleted_by?: string | null
          end_date?: string | null
          fiscal_year?: number | null
          id?: string
          internal_note?: string | null
          legacy_id?: string | null
          public_visible?: boolean
          publication_status?: Database["public"]["Enums"]["publication_status"]
          signed_date?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["agreement_status"]
          title_en?: string | null
          title_th: string
          updated_at?: string
          updated_by?: string | null
          workflow_status?: Database["public"]["Enums"]["workflow_status"]
        }
        Update: {
          agreement_number?: string | null
          agreement_type?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          end_date?: string | null
          fiscal_year?: number | null
          id?: string
          internal_note?: string | null
          legacy_id?: string | null
          public_visible?: boolean
          publication_status?: Database["public"]["Enums"]["publication_status"]
          signed_date?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["agreement_status"]
          title_en?: string | null
          title_th?: string
          updated_at?: string
          updated_by?: string | null
          workflow_status?: Database["public"]["Enums"]["workflow_status"]
        }
        Relationships: [
          {
            foreignKeyName: "agreements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          alt_text_en: string | null
          alt_text_th: string | null
          created_at: string
          created_by: string
          file_role_id: string | null
          id: string
          is_public: boolean
          mime_type: string | null
          original_file_name: string
          size_bytes: number | null
          storage_bucket: string
          storage_path: string
        }
        Insert: {
          alt_text_en?: string | null
          alt_text_th?: string | null
          created_at?: string
          created_by: string
          file_role_id?: string | null
          id?: string
          is_public?: boolean
          mime_type?: string | null
          original_file_name: string
          size_bytes?: number | null
          storage_bucket: string
          storage_path: string
        }
        Update: {
          alt_text_en?: string | null
          alt_text_th?: string | null
          created_at?: string
          created_by?: string
          file_role_id?: string | null
          id?: string
          is_public?: boolean
          mime_type?: string | null
          original_file_name?: string
          size_bytes?: number | null
          storage_bucket?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_file_role_id_fkey"
            columns: ["file_role_id"]
            isOneToOne: false
            referencedRelation: "file_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_types: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name_en: string | null
          name_th: string
          requires_amount: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name_en?: string | null
          name_th: string
          requires_amount?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name_en?: string | null
          name_th?: string
          requires_amount?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      content_review_decisions: {
        Row: {
          created_at: string
          created_by: string
          decision: string
          id: string
          note: string
          revision: number
          version_id: string
          work_item_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          decision: string
          id?: string
          note?: string
          revision: number
          version_id: string
          work_item_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          decision?: string
          id?: string
          note?: string
          revision?: number
          version_id?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_review_decisions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_review_decisions_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "content_work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_review_decisions_work_item_id_version_id_fkey"
            columns: ["work_item_id", "version_id"]
            isOneToOne: false
            referencedRelation: "content_versions"
            referencedColumns: ["work_item_id", "id"]
          },
        ]
      }
      content_snapshots: {
        Row: {
          canonicalization: string
          created_at: string
          created_by: string
          deadlines: Json
          digest: string
          facts: Json
          hash_algorithm: string
          id: string
          revision: number
          schema_version: number
          source_verification_ids: string[]
          work_item_id: string
        }
        Insert: {
          canonicalization?: string
          created_at?: string
          created_by: string
          deadlines?: Json
          digest: string
          facts: Json
          hash_algorithm?: string
          id?: string
          revision: number
          schema_version?: number
          source_verification_ids?: string[]
          work_item_id: string
        }
        Update: {
          canonicalization?: string
          created_at?: string
          created_by?: string
          deadlines?: Json
          digest?: string
          facts?: Json
          hash_algorithm?: string
          id?: string
          revision?: number
          schema_version?: number
          source_verification_ids?: string[]
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_snapshots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_snapshots_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "content_work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      content_source_verifications: {
        Row: {
          created_at: string
          created_by: string
          final_url: string
          id: string
          method: string
          note: string
          observed_on: string
          official: boolean
          publisher: string
          requested_url: string
          result: string
          revision: number
          title: string
          valid_until: string
          work_item_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          final_url: string
          id?: string
          method?: string
          note: string
          observed_on: string
          official: boolean
          publisher: string
          requested_url: string
          result: string
          revision: number
          title: string
          valid_until: string
          work_item_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          final_url?: string
          id?: string
          method?: string
          note?: string
          observed_on?: string
          official?: boolean
          publisher?: string
          requested_url?: string
          result?: string
          revision?: number
          title?: string
          valid_until?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_source_verifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_source_verifications_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "content_work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      content_versions: {
        Row: {
          based_on_version_id: string | null
          channel: string
          created_at: string
          created_by: string
          digest: string
          id: string
          locales: Json
          schema_version: number
          snapshot_id: string
          version_number: number
          work_item_id: string
        }
        Insert: {
          based_on_version_id?: string | null
          channel: string
          created_at?: string
          created_by: string
          digest: string
          id?: string
          locales: Json
          schema_version?: number
          snapshot_id: string
          version_number: number
          work_item_id: string
        }
        Update: {
          based_on_version_id?: string | null
          channel?: string
          created_at?: string
          created_by?: string
          digest?: string
          id?: string
          locales?: Json
          schema_version?: number
          snapshot_id?: string
          version_number?: number
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_versions_work_item_id_based_on_version_id_fkey"
            columns: ["work_item_id", "based_on_version_id"]
            isOneToOne: false
            referencedRelation: "content_versions"
            referencedColumns: ["work_item_id", "id"]
          },
          {
            foreignKeyName: "content_versions_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "content_work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_versions_work_item_id_snapshot_id_fkey"
            columns: ["work_item_id", "snapshot_id"]
            isOneToOne: false
            referencedRelation: "content_snapshots"
            referencedColumns: ["work_item_id", "id"]
          },
        ]
      }
      content_work_items: {
        Row: {
          created_at: string
          created_by: string
          current_snapshot_id: string | null
          id: string
          kind: string
          news_id: string | null
          row_version: number
          scholarship_id: string | null
          title: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          created_at?: string
          created_by: string
          current_snapshot_id?: string | null
          id?: string
          kind: string
          news_id?: string | null
          row_version?: number
          scholarship_id?: string | null
          title: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          created_at?: string
          created_by?: string
          current_snapshot_id?: string | null
          id?: string
          kind?: string
          news_id?: string | null
          row_version?: number
          scholarship_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_work_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_work_items_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: true
            referencedRelation: "news_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_work_items_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: true
            referencedRelation: "news_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_work_items_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: true
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_work_items_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: true
            referencedRelation: "scholarships_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_work_items_snapshot_owner"
            columns: ["id", "current_snapshot_id"]
            isOneToOne: false
            referencedRelation: "content_snapshots"
            referencedColumns: ["work_item_id", "id"]
          },
          {
            foreignKeyName: "content_work_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          active: boolean
          continent_code: string | null
          created_at: string
          id: string
          iso2: string
          iso3: string
          name_en: string
          name_th: string
          search_alias: string[]
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          continent_code?: string | null
          created_at?: string
          id?: string
          iso2: string
          iso3: string
          name_en: string
          name_th: string
          search_alias?: string[]
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          continent_code?: string | null
          created_at?: string
          id?: string
          iso2?: string
          iso3?: string
          name_en?: string
          name_th?: string
          search_alias?: string[]
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          country_id: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          deleted_by: string | null
          detail_en: string | null
          detail_th: string | null
          ends_at: string
          event_type: string
          id: string
          internal_note: string | null
          legacy_id: string | null
          location_en: string | null
          location_th: string | null
          mode: Database["public"]["Enums"]["event_mode"]
          organizer_unit_id: string | null
          participant_count: number
          partner_organization_id: string | null
          pinned: boolean
          public_visible: boolean
          publication_status: Database["public"]["Enums"]["publication_status"]
          registration_url: string | null
          starts_at: string
          title_en: string | null
          title_th: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          country_id?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          deleted_by?: string | null
          detail_en?: string | null
          detail_th?: string | null
          ends_at: string
          event_type: string
          id?: string
          internal_note?: string | null
          legacy_id?: string | null
          location_en?: string | null
          location_th?: string | null
          mode?: Database["public"]["Enums"]["event_mode"]
          organizer_unit_id?: string | null
          participant_count?: number
          partner_organization_id?: string | null
          pinned?: boolean
          public_visible?: boolean
          publication_status?: Database["public"]["Enums"]["publication_status"]
          registration_url?: string | null
          starts_at: string
          title_en?: string | null
          title_th: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          country_id?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          detail_en?: string | null
          detail_th?: string | null
          ends_at?: string
          event_type?: string
          id?: string
          internal_note?: string | null
          legacy_id?: string | null
          location_en?: string | null
          location_th?: string | null
          mode?: Database["public"]["Enums"]["event_mode"]
          organizer_unit_id?: string | null
          participant_count?: number
          partner_organization_id?: string | null
          pinned?: boolean
          public_visible?: boolean
          publication_status?: Database["public"]["Enums"]["publication_status"]
          registration_url?: string | null
          starts_at?: string
          title_en?: string | null
          title_th?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_organizer_unit_id_fkey"
            columns: ["organizer_unit_id"]
            isOneToOne: false
            referencedRelation: "organization_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_partner_organization_id_fkey"
            columns: ["partner_organization_id"]
            isOneToOne: false
            referencedRelation: "partner_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      file_roles: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name_en: string | null
          name_th: string
          public_allowed: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name_en?: string | null
          name_th: string
          public_allowed?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name_en?: string | null
          name_th?: string
          public_allowed?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          committed_at: string | null
          created_at: string
          created_by: string
          duplicate_rows: number
          id: string
          import_kind: Database["public"]["Enums"]["import_kind"]
          invalid_rows: number
          module: Database["public"]["Enums"]["module_key"]
          source_file_name: string
          source_file_path: string | null
          status: Database["public"]["Enums"]["import_status"]
          total_rows: number
          valid_rows: number
          warning_rows: number
        }
        Insert: {
          committed_at?: string | null
          created_at?: string
          created_by: string
          duplicate_rows?: number
          id?: string
          import_kind?: Database["public"]["Enums"]["import_kind"]
          invalid_rows?: number
          module: Database["public"]["Enums"]["module_key"]
          source_file_name: string
          source_file_path?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          total_rows?: number
          valid_rows?: number
          warning_rows?: number
        }
        Update: {
          committed_at?: string | null
          created_at?: string
          created_by?: string
          duplicate_rows?: number
          id?: string
          import_kind?: Database["public"]["Enums"]["import_kind"]
          invalid_rows?: number
          module?: Database["public"]["Enums"]["module_key"]
          source_file_name?: string
          source_file_path?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          total_rows?: number
          valid_rows?: number
          warning_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      import_rows: {
        Row: {
          batch_id: string
          change_action:
            | Database["public"]["Enums"]["import_change_action"]
            | null
          created_at: string
          id: string
          master_entity:
            | Database["public"]["Enums"]["master_entity_type"]
            | null
          normalized_data: Json | null
          review_note: string | null
          review_status: Database["public"]["Enums"]["import_review_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          row_number: number
          source_data: Json
          source_key: string | null
          status: Database["public"]["Enums"]["import_row_status"]
          target_record_id: string | null
          validation_messages: Json
        }
        Insert: {
          batch_id: string
          change_action?:
            | Database["public"]["Enums"]["import_change_action"]
            | null
          created_at?: string
          id?: string
          master_entity?:
            | Database["public"]["Enums"]["master_entity_type"]
            | null
          normalized_data?: Json | null
          review_note?: string | null
          review_status?: Database["public"]["Enums"]["import_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          row_number: number
          source_data: Json
          source_key?: string | null
          status?: Database["public"]["Enums"]["import_row_status"]
          target_record_id?: string | null
          validation_messages?: Json
        }
        Update: {
          batch_id?: string
          change_action?:
            | Database["public"]["Enums"]["import_change_action"]
            | null
          created_at?: string
          id?: string
          master_entity?:
            | Database["public"]["Enums"]["master_entity_type"]
            | null
          normalized_data?: Json | null
          review_note?: string | null
          review_status?: Database["public"]["Enums"]["import_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          row_number?: number
          source_data?: Json
          source_key?: string | null
          status?: Database["public"]["Enums"]["import_row_status"]
          target_record_id?: string | null
          validation_messages?: Json
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_rows_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_items: {
        Row: {
          category: string | null
          content_en: string | null
          content_th: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          deleted_by: string | null
          external_url: string | null
          id: string
          internal_note: string | null
          legacy_id: string | null
          pinned: boolean
          public_visible: boolean
          publication_status: Database["public"]["Enums"]["publication_status"]
          published_at: string | null
          resource_type: string
          summary_en: string | null
          summary_th: string | null
          title_en: string | null
          title_th: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string | null
          content_en?: string | null
          content_th?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          deleted_by?: string | null
          external_url?: string | null
          id?: string
          internal_note?: string | null
          legacy_id?: string | null
          pinned?: boolean
          public_visible?: boolean
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          resource_type?: string
          summary_en?: string | null
          summary_th?: string | null
          title_en?: string | null
          title_th: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string | null
          content_en?: string | null
          content_th?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          external_url?: string | null
          id?: string
          internal_note?: string | null
          legacy_id?: string | null
          pinned?: boolean
          public_visible?: boolean
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          resource_type?: string
          summary_en?: string | null
          summary_th?: string | null
          title_en?: string | null
          title_th?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_items_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      movement_cases: {
        Row: {
          activity_type: string | null
          approval_reference: string | null
          category: Database["public"]["Enums"]["movement_category"]
          city: string | null
          country_id: string | null
          country_name_snapshot: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          deleted_by: string | null
          departure_at: string | null
          direction: Database["public"]["Enums"]["movement_direction"]
          end_date: string | null
          fiscal_year: number | null
          id: string
          internal_note: string | null
          legacy_id: string | null
          mobility_mode: string | null
          owner_unit_id: string | null
          participant_count: number
          participant_group: string | null
          partner_name_snapshot: string | null
          partner_organization_id: string | null
          project_name: string
          public_visible: boolean
          publication_status: Database["public"]["Enums"]["publication_status"]
          purpose: string | null
          return_at: string | null
          start_date: string | null
          status: string
          study_level: string | null
          title_en: string | null
          updated_at: string
          updated_by: string | null
          workflow_status: Database["public"]["Enums"]["workflow_status"]
        }
        Insert: {
          activity_type?: string | null
          approval_reference?: string | null
          category?: Database["public"]["Enums"]["movement_category"]
          city?: string | null
          country_id?: string | null
          country_name_snapshot?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          deleted_by?: string | null
          departure_at?: string | null
          direction?: Database["public"]["Enums"]["movement_direction"]
          end_date?: string | null
          fiscal_year?: number | null
          id?: string
          internal_note?: string | null
          legacy_id?: string | null
          mobility_mode?: string | null
          owner_unit_id?: string | null
          participant_count?: number
          participant_group?: string | null
          partner_name_snapshot?: string | null
          partner_organization_id?: string | null
          project_name: string
          public_visible?: boolean
          publication_status?: Database["public"]["Enums"]["publication_status"]
          purpose?: string | null
          return_at?: string | null
          start_date?: string | null
          status?: string
          study_level?: string | null
          title_en?: string | null
          updated_at?: string
          updated_by?: string | null
          workflow_status?: Database["public"]["Enums"]["workflow_status"]
        }
        Update: {
          activity_type?: string | null
          approval_reference?: string | null
          category?: Database["public"]["Enums"]["movement_category"]
          city?: string | null
          country_id?: string | null
          country_name_snapshot?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          departure_at?: string | null
          direction?: Database["public"]["Enums"]["movement_direction"]
          end_date?: string | null
          fiscal_year?: number | null
          id?: string
          internal_note?: string | null
          legacy_id?: string | null
          mobility_mode?: string | null
          owner_unit_id?: string | null
          participant_count?: number
          participant_group?: string | null
          partner_name_snapshot?: string | null
          partner_organization_id?: string | null
          project_name?: string
          public_visible?: boolean
          publication_status?: Database["public"]["Enums"]["publication_status"]
          purpose?: string | null
          return_at?: string | null
          start_date?: string | null
          status?: string
          study_level?: string | null
          title_en?: string | null
          updated_at?: string
          updated_by?: string | null
          workflow_status?: Database["public"]["Enums"]["workflow_status"]
        }
        Relationships: [
          {
            foreignKeyName: "movement_cases_owner_unit_id_fkey"
            columns: ["owner_unit_id"]
            isOneToOne: false
            referencedRelation: "organization_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movement_cases_partner_organization_id_fkey"
            columns: ["partner_organization_id"]
            isOneToOne: false
            referencedRelation: "partner_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_records_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_records_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_records_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      movement_funding: {
        Row: {
          amount: number | null
          budget_type: string
          budget_type_id: string | null
          created_at: string
          created_by: string
          currency: string
          id: string
          movement_id: string
          note: string | null
          source_name: string | null
          source_unit_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount?: number | null
          budget_type: string
          budget_type_id?: string | null
          created_at?: string
          created_by: string
          currency?: string
          id?: string
          movement_id: string
          note?: string | null
          source_name?: string | null
          source_unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number | null
          budget_type?: string
          budget_type_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          movement_id?: string
          note?: string | null
          source_name?: string | null
          source_unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movement_funding_budget_type_id_fkey"
            columns: ["budget_type_id"]
            isOneToOne: false
            referencedRelation: "budget_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_budgets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_budgets_source_unit_id_fkey"
            columns: ["source_unit_id"]
            isOneToOne: false
            referencedRelation: "organization_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_budgets_travel_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movement_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_budgets_travel_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_budgets_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      movement_participants: {
        Row: {
          arrival_date: string | null
          created_at: string
          created_by: string
          departure_date: string | null
          faculty_snapshot: string | null
          full_name_snapshot: string
          gender_snapshot: string | null
          home_organization_name_snapshot: string | null
          host_organization_name_snapshot: string | null
          id: string
          movement_id: string
          organization_unit_id_snapshot: string | null
          organization_unit_name_snapshot: string | null
          participant_role: string | null
          person_id: string | null
          person_source: Database["public"]["Enums"]["person_type"]
          position_snapshot: string | null
          student_id_snapshot: string | null
          study_level_snapshot: string | null
          study_program_snapshot: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          arrival_date?: string | null
          created_at?: string
          created_by: string
          departure_date?: string | null
          faculty_snapshot?: string | null
          full_name_snapshot: string
          gender_snapshot?: string | null
          home_organization_name_snapshot?: string | null
          host_organization_name_snapshot?: string | null
          id?: string
          movement_id: string
          organization_unit_id_snapshot?: string | null
          organization_unit_name_snapshot?: string | null
          participant_role?: string | null
          person_id?: string | null
          person_source: Database["public"]["Enums"]["person_type"]
          position_snapshot?: string | null
          student_id_snapshot?: string | null
          study_level_snapshot?: string | null
          study_program_snapshot?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          arrival_date?: string | null
          created_at?: string
          created_by?: string
          departure_date?: string | null
          faculty_snapshot?: string | null
          full_name_snapshot?: string
          gender_snapshot?: string | null
          home_organization_name_snapshot?: string | null
          host_organization_name_snapshot?: string | null
          id?: string
          movement_id?: string
          organization_unit_id_snapshot?: string | null
          organization_unit_name_snapshot?: string | null
          participant_role?: string | null
          person_id?: string | null
          person_source?: Database["public"]["Enums"]["person_type"]
          position_snapshot?: string | null
          student_id_snapshot?: string | null
          study_level_snapshot?: string | null
          study_program_snapshot?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "travel_participants_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_participants_organization_unit_id_snapshot_fkey"
            columns: ["organization_unit_id_snapshot"]
            isOneToOne: false
            referencedRelation: "organization_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_participants_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_participants_travel_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movement_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_participants_travel_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_participants_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      movement_workflow_events: {
        Row: {
          action: string
          created_at: string
          created_by: string
          from_status: Database["public"]["Enums"]["workflow_status"] | null
          id: string
          movement_id: string
          note: string | null
          to_status: Database["public"]["Enums"]["workflow_status"] | null
        }
        Insert: {
          action: string
          created_at?: string
          created_by: string
          from_status?: Database["public"]["Enums"]["workflow_status"] | null
          id?: string
          movement_id: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["workflow_status"] | null
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string
          from_status?: Database["public"]["Enums"]["workflow_status"] | null
          id?: string
          movement_id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["workflow_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "movement_workflow_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movement_workflow_events_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movement_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movement_workflow_events_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements_public"
            referencedColumns: ["id"]
          },
        ]
      }
      news_articles: {
        Row: {
          category: string | null
          content_en: string | null
          content_th: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          internal_note: string | null
          legacy_id: string | null
          pinned: boolean
          public_visible: boolean
          publication_status: Database["public"]["Enums"]["publication_status"]
          published_at: string | null
          summary_en: string | null
          summary_th: string | null
          title_en: string | null
          title_th: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string | null
          content_en?: string | null
          content_th?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          internal_note?: string | null
          legacy_id?: string | null
          pinned?: boolean
          public_visible?: boolean
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          summary_en?: string | null
          summary_th?: string | null
          title_en?: string | null
          title_th: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string | null
          content_en?: string | null
          content_th?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          internal_note?: string | null
          legacy_id?: string | null
          pinned?: boolean
          public_visible?: boolean
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          summary_en?: string | null
          summary_th?: string | null
          title_en?: string | null
          title_th?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "news_articles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_articles_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_articles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_units: {
        Row: {
          active: boolean
          code: string | null
          created_at: string
          id: string
          name_en: string | null
          name_th: string
          parent_id: string | null
          sort_order: number
          unit_type: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code?: string | null
          created_at?: string
          id?: string
          name_en?: string | null
          name_th: string
          parent_id?: string | null
          sort_order?: number
          unit_type?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string | null
          created_at?: string
          id?: string
          name_en?: string | null
          name_th?: string
          parent_id?: string | null
          sort_order?: number
          unit_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_units_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "organization_units"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_contact_interactions: {
        Row: {
          agreement_id: string | null
          context: string | null
          created_at: string
          created_by: string
          follow_up_on: string | null
          id: string
          interaction_type: string | null
          movement_id: string | null
          note: string | null
          occurred_on: string | null
          partner_contact_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agreement_id?: string | null
          context?: string | null
          created_at?: string
          created_by: string
          follow_up_on?: string | null
          id?: string
          interaction_type?: string | null
          movement_id?: string | null
          note?: string | null
          occurred_on?: string | null
          partner_contact_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agreement_id?: string | null
          context?: string | null
          created_at?: string
          created_by?: string
          follow_up_on?: string | null
          id?: string
          interaction_type?: string | null
          movement_id?: string | null
          note?: string | null
          occurred_on?: string | null
          partner_contact_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_contact_interactions_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_contact_interactions_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_contact_interactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_contact_interactions_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movement_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_contact_interactions_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_contact_interactions_partner_contact_id_fkey"
            columns: ["partner_contact_id"]
            isOneToOne: false
            referencedRelation: "partner_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_contact_interactions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_contact_methods: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          id: string
          is_primary: boolean
          label: string | null
          method_type: Database["public"]["Enums"]["contact_method_type"]
          partner_contact_id: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          id?: string
          is_primary?: boolean
          label?: string | null
          method_type: Database["public"]["Enums"]["contact_method_type"]
          partner_contact_id: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          method_type?: Database["public"]["Enums"]["contact_method_type"]
          partner_contact_id?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_contact_methods_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_contact_methods_partner_contact_id_fkey"
            columns: ["partner_contact_id"]
            isOneToOne: false
            referencedRelation: "partner_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_contact_methods_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_contacts: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          deleted_at: string | null
          deleted_by: string | null
          department: string | null
          expertise_areas: string[]
          full_name: string
          id: string
          internal_note: string | null
          last_contacted_on: string | null
          partner_organization_id: string
          position_title: string | null
          preferred_language: string | null
          relationship_level: Database["public"]["Enums"]["relationship_level"]
          source_import_batch_id: string | null
          source_row_number: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          deleted_at?: string | null
          deleted_by?: string | null
          department?: string | null
          expertise_areas?: string[]
          full_name: string
          id?: string
          internal_note?: string | null
          last_contacted_on?: string | null
          partner_organization_id: string
          position_title?: string | null
          preferred_language?: string | null
          relationship_level?: Database["public"]["Enums"]["relationship_level"]
          source_import_batch_id?: string | null
          source_row_number?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          department?: string | null
          expertise_areas?: string[]
          full_name?: string
          id?: string
          internal_note?: string | null
          last_contacted_on?: string | null
          partner_organization_id?: string
          position_title?: string | null
          preferred_language?: string | null
          relationship_level?: Database["public"]["Enums"]["relationship_level"]
          source_import_batch_id?: string | null
          source_row_number?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_contacts_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_contacts_partner_organization_id_fkey"
            columns: ["partner_organization_id"]
            isOneToOne: false
            referencedRelation: "partner_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_contacts_source_import_batch_id_fkey"
            columns: ["source_import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_contacts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_organizations: {
        Row: {
          active: boolean
          city: string | null
          country_id: string | null
          created_at: string
          created_by: string | null
          id: string
          legacy_id: string | null
          name_en: string | null
          name_th: string | null
          organization_type: string | null
          source_note: string | null
          updated_at: string
          updated_by: string | null
          verification_status: string
          website_url: string | null
        }
        Insert: {
          active?: boolean
          city?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          legacy_id?: string | null
          name_en?: string | null
          name_th?: string | null
          organization_type?: string | null
          source_note?: string | null
          updated_at?: string
          updated_by?: string | null
          verification_status?: string
          website_url?: string | null
        }
        Update: {
          active?: boolean
          city?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          legacy_id?: string | null
          name_en?: string | null
          name_th?: string | null
          organization_type?: string | null
          source_note?: string | null
          updated_at?: string
          updated_by?: string | null
          verification_status?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_organizations_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_organizations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          first_name_en: string | null
          first_name_th: string | null
          full_name_en: string | null
          full_name_th: string
          gender: string | null
          id: string
          last_name_en: string | null
          last_name_th: string | null
          organization_unit_id: string | null
          person_type: Database["public"]["Enums"]["person_type"]
          prefix_en: string | null
          prefix_th: string | null
          program_or_position: string | null
          source_identifier: string | null
          source_system: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          first_name_en?: string | null
          first_name_th?: string | null
          full_name_en?: string | null
          full_name_th: string
          gender?: string | null
          id?: string
          last_name_en?: string | null
          last_name_th?: string | null
          organization_unit_id?: string | null
          person_type: Database["public"]["Enums"]["person_type"]
          prefix_en?: string | null
          prefix_th?: string | null
          program_or_position?: string | null
          source_identifier?: string | null
          source_system?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          first_name_en?: string | null
          first_name_th?: string | null
          full_name_en?: string | null
          full_name_th?: string
          gender?: string | null
          id?: string
          last_name_en?: string | null
          last_name_th?: string | null
          organization_unit_id?: string | null
          person_type?: Database["public"]["Enums"]["person_type"]
          prefix_en?: string | null
          prefix_th?: string | null
          program_or_position?: string | null
          source_identifier?: string | null
          source_system?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_organization_unit_id_fkey"
            columns: ["organization_unit_id"]
            isOneToOne: false
            referencedRelation: "organization_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          display_name: string
          email: string
          id: string
          preferred_locale: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name: string
          email: string
          id: string
          preferred_locale?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          preferred_locale?: string
          updated_at?: string
        }
        Relationships: []
      }
      record_assets: {
        Row: {
          agreement_id: string | null
          asset_id: string
          created_at: string
          created_by: string | null
          event_id: string | null
          id: string
          knowledge_id: string | null
          movement_id: string | null
          news_id: string | null
          scholarship_id: string | null
          sort_order: number
        }
        Insert: {
          agreement_id?: string | null
          asset_id: string
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          knowledge_id?: string | null
          movement_id?: string | null
          news_id?: string | null
          scholarship_id?: string | null
          sort_order?: number
        }
        Update: {
          agreement_id?: string | null
          asset_id?: string
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          knowledge_id?: string | null
          movement_id?: string | null
          news_id?: string | null
          scholarship_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "record_assets_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_assets_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_assets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_assets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_assets_knowledge_id_fkey"
            columns: ["knowledge_id"]
            isOneToOne: false
            referencedRelation: "knowledge_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_assets_knowledge_id_fkey"
            columns: ["knowledge_id"]
            isOneToOne: false
            referencedRelation: "knowledge_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_assets_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movement_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_assets_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_assets_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: false
            referencedRelation: "news_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_assets_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: false
            referencedRelation: "news_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_assets_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_assets_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "scholarships_public"
            referencedColumns: ["id"]
          },
        ]
      }
      scholarships: {
        Row: {
          apply_url: string | null
          audience: Database["public"]["Enums"]["audience_type"]
          close_date: string | null
          content_en: string | null
          content_th: string | null
          country_id: string | null
          coverage_en: string | null
          coverage_th: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          deleted_by: string | null
          detail_url: string | null
          funding_type: string | null
          id: string
          internal_note: string | null
          legacy_id: string | null
          open_date: string | null
          partner_organization_id: string | null
          pinned: boolean
          public_visible: boolean
          publication_status: Database["public"]["Enums"]["publication_status"]
          publish_date: string | null
          scholarship_type: string | null
          study_level: string | null
          summary_en: string | null
          summary_th: string | null
          title_en: string | null
          title_th: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          apply_url?: string | null
          audience?: Database["public"]["Enums"]["audience_type"]
          close_date?: string | null
          content_en?: string | null
          content_th?: string | null
          country_id?: string | null
          coverage_en?: string | null
          coverage_th?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          deleted_by?: string | null
          detail_url?: string | null
          funding_type?: string | null
          id?: string
          internal_note?: string | null
          legacy_id?: string | null
          open_date?: string | null
          partner_organization_id?: string | null
          pinned?: boolean
          public_visible?: boolean
          publication_status?: Database["public"]["Enums"]["publication_status"]
          publish_date?: string | null
          scholarship_type?: string | null
          study_level?: string | null
          summary_en?: string | null
          summary_th?: string | null
          title_en?: string | null
          title_th: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          apply_url?: string | null
          audience?: Database["public"]["Enums"]["audience_type"]
          close_date?: string | null
          content_en?: string | null
          content_th?: string | null
          country_id?: string | null
          coverage_en?: string | null
          coverage_th?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          detail_url?: string | null
          funding_type?: string | null
          id?: string
          internal_note?: string | null
          legacy_id?: string | null
          open_date?: string | null
          partner_organization_id?: string | null
          pinned?: boolean
          public_visible?: boolean
          publication_status?: Database["public"]["Enums"]["publication_status"]
          publish_date?: string | null
          scholarship_type?: string | null
          study_level?: string | null
          summary_en?: string | null
          summary_th?: string | null
          title_en?: string | null
          title_th?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scholarships_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarships_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarships_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarships_partner_organization_id_fkey"
            columns: ["partner_organization_id"]
            isOneToOne: false
            referencedRelation: "partner_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarships_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      agreements_public: {
        Row: {
          agreement_number: string | null
          agreement_type: string | null
          end_date: string | null
          fiscal_year: number | null
          id: string | null
          partner_names: string[] | null
          signed_date: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["agreement_status"] | null
          title_en: string | null
          title_th: string | null
        }
        Relationships: []
      }
      events_public: {
        Row: {
          country_id: string | null
          detail_en: string | null
          detail_th: string | null
          ends_at: string | null
          event_type: string | null
          id: string | null
          location_en: string | null
          location_th: string | null
          mode: Database["public"]["Enums"]["event_mode"] | null
          organizer_unit_id: string | null
          participant_count: number | null
          partner_organization_id: string | null
          pinned: boolean | null
          registration_url: string | null
          starts_at: string | null
          title_en: string | null
          title_th: string | null
        }
        Insert: {
          country_id?: string | null
          detail_en?: string | null
          detail_th?: string | null
          ends_at?: string | null
          event_type?: string | null
          id?: string | null
          location_en?: string | null
          location_th?: string | null
          mode?: Database["public"]["Enums"]["event_mode"] | null
          organizer_unit_id?: string | null
          participant_count?: number | null
          partner_organization_id?: string | null
          pinned?: boolean | null
          registration_url?: string | null
          starts_at?: string | null
          title_en?: string | null
          title_th?: string | null
        }
        Update: {
          country_id?: string | null
          detail_en?: string | null
          detail_th?: string | null
          ends_at?: string | null
          event_type?: string | null
          id?: string | null
          location_en?: string | null
          location_th?: string | null
          mode?: Database["public"]["Enums"]["event_mode"] | null
          organizer_unit_id?: string | null
          participant_count?: number | null
          partner_organization_id?: string | null
          pinned?: boolean | null
          registration_url?: string | null
          starts_at?: string | null
          title_en?: string | null
          title_th?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_organizer_unit_id_fkey"
            columns: ["organizer_unit_id"]
            isOneToOne: false
            referencedRelation: "organization_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_partner_organization_id_fkey"
            columns: ["partner_organization_id"]
            isOneToOne: false
            referencedRelation: "partner_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_public: {
        Row: {
          category: string | null
          content_en: string | null
          content_th: string | null
          external_url: string | null
          id: string | null
          pinned: boolean | null
          published_at: string | null
          resource_type: string | null
          summary_en: string | null
          summary_th: string | null
          title_en: string | null
          title_th: string | null
        }
        Insert: {
          category?: string | null
          content_en?: string | null
          content_th?: string | null
          external_url?: string | null
          id?: string | null
          pinned?: boolean | null
          published_at?: string | null
          resource_type?: string | null
          summary_en?: string | null
          summary_th?: string | null
          title_en?: string | null
          title_th?: string | null
        }
        Update: {
          category?: string | null
          content_en?: string | null
          content_th?: string | null
          external_url?: string | null
          id?: string | null
          pinned?: boolean | null
          published_at?: string | null
          resource_type?: string | null
          summary_en?: string | null
          summary_th?: string | null
          title_en?: string | null
          title_th?: string | null
        }
        Relationships: []
      }
      movements_public: {
        Row: {
          category: Database["public"]["Enums"]["movement_category"] | null
          city: string | null
          country_id: string | null
          direction: Database["public"]["Enums"]["movement_direction"] | null
          end_date: string | null
          fiscal_year: number | null
          id: string | null
          owner_unit_id: string | null
          participant_count: number | null
          partner_organization_id: string | null
          project_name: string | null
          purpose: string | null
          start_date: string | null
          status: string | null
          title_en: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["movement_category"] | null
          city?: string | null
          country_id?: string | null
          direction?: Database["public"]["Enums"]["movement_direction"] | null
          end_date?: string | null
          fiscal_year?: number | null
          id?: string | null
          owner_unit_id?: string | null
          participant_count?: number | null
          partner_organization_id?: string | null
          project_name?: string | null
          purpose?: string | null
          start_date?: string | null
          status?: string | null
          title_en?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["movement_category"] | null
          city?: string | null
          country_id?: string | null
          direction?: Database["public"]["Enums"]["movement_direction"] | null
          end_date?: string | null
          fiscal_year?: number | null
          id?: string | null
          owner_unit_id?: string | null
          participant_count?: number | null
          partner_organization_id?: string | null
          project_name?: string | null
          purpose?: string | null
          start_date?: string | null
          status?: string | null
          title_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movement_cases_owner_unit_id_fkey"
            columns: ["owner_unit_id"]
            isOneToOne: false
            referencedRelation: "organization_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movement_cases_partner_organization_id_fkey"
            columns: ["partner_organization_id"]
            isOneToOne: false
            referencedRelation: "partner_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_records_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      news_public: {
        Row: {
          category: string | null
          content_en: string | null
          content_th: string | null
          id: string | null
          pinned: boolean | null
          published_at: string | null
          summary_en: string | null
          summary_th: string | null
          title_en: string | null
          title_th: string | null
        }
        Insert: {
          category?: string | null
          content_en?: string | null
          content_th?: string | null
          id?: string | null
          pinned?: boolean | null
          published_at?: string | null
          summary_en?: string | null
          summary_th?: string | null
          title_en?: string | null
          title_th?: string | null
        }
        Update: {
          category?: string | null
          content_en?: string | null
          content_th?: string | null
          id?: string | null
          pinned?: boolean | null
          published_at?: string | null
          summary_en?: string | null
          summary_th?: string | null
          title_en?: string | null
          title_th?: string | null
        }
        Relationships: []
      }
      scholarships_public: {
        Row: {
          apply_url: string | null
          audience: Database["public"]["Enums"]["audience_type"] | null
          close_date: string | null
          content_en: string | null
          content_th: string | null
          country_id: string | null
          coverage_en: string | null
          coverage_th: string | null
          detail_url: string | null
          funding_type: string | null
          id: string | null
          open_date: string | null
          partner_organization_id: string | null
          pinned: boolean | null
          publish_date: string | null
          scholarship_type: string | null
          study_level: string | null
          summary_en: string | null
          summary_th: string | null
          title_en: string | null
          title_th: string | null
        }
        Insert: {
          apply_url?: string | null
          audience?: Database["public"]["Enums"]["audience_type"] | null
          close_date?: string | null
          content_en?: string | null
          content_th?: string | null
          country_id?: string | null
          coverage_en?: string | null
          coverage_th?: string | null
          detail_url?: string | null
          funding_type?: string | null
          id?: string | null
          open_date?: string | null
          partner_organization_id?: string | null
          pinned?: boolean | null
          publish_date?: string | null
          scholarship_type?: string | null
          study_level?: string | null
          summary_en?: string | null
          summary_th?: string | null
          title_en?: string | null
          title_th?: string | null
        }
        Update: {
          apply_url?: string | null
          audience?: Database["public"]["Enums"]["audience_type"] | null
          close_date?: string | null
          content_en?: string | null
          content_th?: string | null
          country_id?: string | null
          coverage_en?: string | null
          coverage_th?: string | null
          detail_url?: string | null
          funding_type?: string | null
          id?: string | null
          open_date?: string | null
          partner_organization_id?: string | null
          pinned?: boolean | null
          publish_date?: string | null
          scholarship_type?: string | null
          study_level?: string | null
          summary_en?: string | null
          summary_th?: string | null
          title_en?: string | null
          title_th?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scholarships_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarships_partner_organization_id_fkey"
            columns: ["partner_organization_id"]
            isOneToOne: false
            referencedRelation: "partner_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_dashboard_counts: {
        Row: {
          module: Database["public"]["Enums"]["module_key"] | null
          published_records: number | null
          segment: string | null
          total_records: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_set_user_access: {
        Args: {
          p_active: boolean
          p_permissions?: Json
          p_target_role: Database["public"]["Enums"]["app_role"]
          p_target_user_id: string
        }
        Returns: Json
      }
      admin_user_directory: { Args: never; Returns: Json }
      commit_legacy_contact_import_batch: {
        Args: { target_batch_id: string }
        Returns: Json
      }
      commit_legacy_mou_import_batch: {
        Args: { target_batch_id: string }
        Returns: Json
      }
      commit_legacy_travel_import_batch: {
        Args: { target_batch_id: string }
        Returns: Json
      }
      commit_master_import_batch: {
        Args: { target_batch_id: string }
        Returns: Json
      }
      commit_student_mobility_import_batch: {
        Args: { target_batch_id: string }
        Returns: Json
      }
      content_core_execute: { Args: { p_command: Json }; Returns: Json }
      content_core_inspect: {
        Args: { p_kind: string; p_record_id: string }
        Returns: Json
      }
      content_core_list: {
        Args: { p_kind: string; p_page?: number }
        Returns: Json
      }
      current_user_access: { Args: never; Returns: Json }
      mou_attach_file: {
        Args: {
          p_agreement_id: string
          p_file_role_id?: string
          p_mime_type?: string
          p_original_file_name: string
          p_size_bytes?: number
          p_storage_path: string
        }
        Returns: Json
      }
      mou_detach_file: {
        Args: { p_agreement_id: string; p_asset_id: string }
        Returns: Json
      }
      mou_publish: {
        Args: { expected_updated_at: string; target_agreement_id: string }
        Returns: Json
      }
      mou_restore: { Args: { target_agreement_id: string }; Returns: Json }
      mou_return_to_draft: {
        Args: {
          expected_updated_at: string
          return_note: string
          target_agreement_id: string
        }
        Returns: Json
      }
      mou_save_draft: {
        Args: {
          expected_updated_at: string
          payload: Json
          target_agreement_id: string
        }
        Returns: Json
      }
      mou_soft_delete: {
        Args: {
          delete_note?: string
          expected_updated_at: string
          target_agreement_id: string
        }
        Returns: Json
      }
      mou_submit_for_review: {
        Args: { expected_updated_at: string; target_agreement_id: string }
        Returns: Json
      }
      partner_contact_save: {
        Args: {
          expected_updated_at: string
          payload: Json
          target_contact_id: string
        }
        Returns: Json
      }
      partner_organization_save: {
        Args: {
          expected_updated_at: string
          payload: Json
          target_partner_id: string
        }
        Returns: Json
      }
      staff_movement_save: {
        Args: {
          expected_updated_at: string
          funding: Json
          participants: Json
          payload: Json
          requested_category: Database["public"]["Enums"]["movement_category"]
          submit_for_review?: boolean
          target_movement_id: string
        }
        Returns: Json
      }
      staff_movement_transition: {
        Args: {
          expected_updated_at: string
          requested_action: string
          target_movement_id: string
          transition_note?: string
        }
        Returns: Json
      }
      student_mobility_activate: {
        Args: { expected_updated_at: string; target_movement_id: string }
        Returns: Json
      }
      student_mobility_approve: {
        Args: { expected_updated_at: string; target_movement_id: string }
        Returns: Json
      }
      student_mobility_complete: {
        Args: { expected_updated_at: string; target_movement_id: string }
        Returns: Json
      }
      student_mobility_replace_funding: {
        Args: {
          expected_updated_at: string
          funding: Json
          target_movement_id: string
        }
        Returns: Json
      }
      student_mobility_replace_participants: {
        Args: {
          expected_updated_at: string
          participants: Json
          target_movement_id: string
        }
        Returns: Json
      }
      student_mobility_return_to_draft: {
        Args: {
          expected_updated_at: string
          return_note: string
          target_movement_id: string
        }
        Returns: Json
      }
      student_mobility_save: {
        Args: {
          expected_updated_at: string
          funding: Json
          participants: Json
          payload: Json
          submit_for_review?: boolean
          target_movement_id: string
        }
        Returns: Json
      }
      student_mobility_save_draft: {
        Args: {
          expected_updated_at: string
          payload: Json
          target_movement_id: string
        }
        Returns: Json
      }
      student_mobility_submit_for_review: {
        Args: { expected_updated_at: string; target_movement_id: string }
        Returns: Json
      }
      travel_list_v2: {
        Args: {
          p_country?: string
          p_page?: number
          p_q?: string
          p_sort?: string
          p_status?: string
          p_unit?: string
          p_year?: number
        }
        Returns: Json
      }
    }
    Enums: {
      agreement_status:
        | "draft"
        | "active"
        | "expiring"
        | "expired"
        | "terminated"
      app_role: "system_admin" | "office_admin" | "editor" | "viewer"
      audience_type: "student" | "staff" | "both" | "external"
      contact_method_type:
        | "email"
        | "phone"
        | "messaging"
        | "social"
        | "website"
        | "other"
      event_mode: "onsite" | "online" | "hybrid"
      import_change_action: "insert" | "update" | "skip"
      import_kind: "module_data" | "master_data"
      import_review_status: "pending" | "approved" | "skipped" | "needs_fix"
      import_row_status:
        | "pending"
        | "valid"
        | "warning"
        | "invalid"
        | "duplicate"
        | "imported"
      import_status:
        | "uploaded"
        | "validating"
        | "ready"
        | "importing"
        | "completed"
        | "failed"
        | "cancelled"
      master_entity_type:
        | "country"
        | "organization_unit"
        | "student"
        | "staff"
        | "partner_organization"
      module_key:
        | "mou"
        | "mobility"
        | "travel"
        | "scholarship"
        | "events"
        | "news"
        | "knowledge"
        | "reports"
        | "settings"
      movement_category:
        | "student_mobility"
        | "staff_mobility"
        | "staff_official_travel"
        | "visiting_delegation"
      movement_direction:
        | "inbound"
        | "outbound"
        | "bilateral"
        | "not_applicable"
      person_type: "student" | "staff" | "external"
      publication_status: "draft" | "published" | "archived"
      relationship_level: "unrated" | "low" | "medium" | "high"
      workflow_status:
        | "draft"
        | "under_review"
        | "approved"
        | "active"
        | "completed"
        | "cancelled"
        | "archived"
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
      agreement_status: [
        "draft",
        "active",
        "expiring",
        "expired",
        "terminated",
      ],
      app_role: ["system_admin", "office_admin", "editor", "viewer"],
      audience_type: ["student", "staff", "both", "external"],
      contact_method_type: [
        "email",
        "phone",
        "messaging",
        "social",
        "website",
        "other",
      ],
      event_mode: ["onsite", "online", "hybrid"],
      import_change_action: ["insert", "update", "skip"],
      import_kind: ["module_data", "master_data"],
      import_review_status: ["pending", "approved", "skipped", "needs_fix"],
      import_row_status: [
        "pending",
        "valid",
        "warning",
        "invalid",
        "duplicate",
        "imported",
      ],
      import_status: [
        "uploaded",
        "validating",
        "ready",
        "importing",
        "completed",
        "failed",
        "cancelled",
      ],
      master_entity_type: [
        "country",
        "organization_unit",
        "student",
        "staff",
        "partner_organization",
      ],
      module_key: [
        "mou",
        "mobility",
        "travel",
        "scholarship",
        "events",
        "news",
        "knowledge",
        "reports",
        "settings",
      ],
      movement_category: [
        "student_mobility",
        "staff_mobility",
        "staff_official_travel",
        "visiting_delegation",
      ],
      movement_direction: [
        "inbound",
        "outbound",
        "bilateral",
        "not_applicable",
      ],
      person_type: ["student", "staff", "external"],
      publication_status: ["draft", "published", "archived"],
      relationship_level: ["unrated", "low", "medium", "high"],
      workflow_status: [
        "draft",
        "under_review",
        "approved",
        "active",
        "completed",
        "cancelled",
        "archived",
      ],
    },
  },
} as const
