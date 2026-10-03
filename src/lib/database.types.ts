export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type ContentType = 'insert' | 'arcana_minor' | 'arcana_major'
export type Visibility = 'front_only' | 'full'
export type MemberRole = 'gm' | 'player'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          role: string
          created_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          role?: string
          created_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          role?: string
          created_at?: string
        }
      }
      campaigns: {
        Row: {
          id: string
          name: string
          join_code: string
          gm_id: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          join_code: string
          gm_id: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          join_code?: string
          gm_id?: string
          created_at?: string
        }
      }
      campaign_members: {
        Row: {
          campaign_id: string
          user_id: string
          role: MemberRole
          created_at: string
        }
        Insert: {
          campaign_id: string
          user_id: string
          role: MemberRole
          created_at?: string
        }
        Update: {
          campaign_id?: string
          user_id?: string
          role?: MemberRole
          created_at?: string
        }
      }
      characters: {
        Row: {
          id: string
          campaign_id: string
          player_id: string | null
          playbook_id: string
          state: Json
          content_version: string | null
          claim_secret_hash: string | null
          local_client_id: string | null
          deleted_at: string | null
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          player_id?: string | null
          playbook_id: string
          state?: Json
          content_version?: string | null
          claim_secret_hash?: string | null
          local_client_id?: string | null
          deleted_at?: string | null
          updated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          player_id?: string | null
          playbook_id?: string
          state?: Json
          content_version?: string | null
          claim_secret_hash?: string | null
          local_client_id?: string | null
          deleted_at?: string | null
          updated_at?: string
          created_at?: string
        }
      }
      content_grants: {
        Row: {
          id: string
          character_id: string
          granted_by: string
          content_type: ContentType
          content_id: string
          visibility: Visibility
          granted_at: string
        }
        Insert: {
          id?: string
          character_id: string
          granted_by: string
          content_type: ContentType
          content_id: string
          visibility: Visibility
          granted_at?: string
        }
        Update: {
          id?: string
          character_id?: string
          granted_by?: string
          content_type?: ContentType
          content_id?: string
          visibility?: Visibility
          granted_at?: string
        }
      }
      arcana_state: {
        Row: {
          id: string
          grant_id: string
          character_id: string
          unlocked: boolean
          progress: Json
          consequences: Json
          state: Json
          updated_at: string
        }
        Insert: {
          id?: string
          grant_id: string
          character_id: string
          unlocked?: boolean
          progress?: Json
          consequences?: Json
          state?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          grant_id?: string
          character_id?: string
          unlocked?: boolean
          progress?: Json
          consequences?: Json
          state?: Json
          updated_at?: string
        }
      }
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Campaign = Database['public']['Tables']['campaigns']['Row']
export type Character = Database['public']['Tables']['characters']['Row']
export type ContentGrant = Database['public']['Tables']['content_grants']['Row']
export type ArcanaStateRow = Database['public']['Tables']['arcana_state']['Row']
