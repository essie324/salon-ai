"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client for auth flows.
 *
 * Uses the public URL and anon key. Supabase stores auth
 * state in browser storage/cookies, and the server reads
 * that state via `createSupabaseServerClient`.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function createSupabaseBrowserClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

