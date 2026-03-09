import { createClient } from "@supabase/supabase-js";

type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Database = {
  public: {
    Tables: {
      conversations: {
        Row: {
          slug: string;
          date: string;
          title: string;
          tags: string[] | null;
          model: string | null;
          topic: string | null;
          image_url: string;
          prompt_crop: Json | null;
          owner_id: string | null;
          owner_email: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          slug: string;
          date: string;
          title: string;
          tags?: string[] | null;
          model?: string | null;
          topic?: string | null;
          image_url: string;
          prompt_crop?: Json | null;
          owner_id?: string | null;
          owner_email?: string | null;
        };
        Update: {
          slug?: string;
          date?: string;
          title?: string;
          tags?: string[] | null;
          model?: string | null;
          topic?: string | null;
          image_url?: string;
          prompt_crop?: Json | null;
          owner_id?: string | null;
          owner_email?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

function supabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured.");
  }
  return value;
}

function serviceRoleKey(): string {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }
  return value;
}

export function createSupabaseServerClient() {
  return createClient<Database>(supabaseUrl(), serviceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function supabaseBucket(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "conversation-screenshots";
}
