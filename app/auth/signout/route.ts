import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabaseServer";

/**
 * Server-side sign out.
 *
 * Uses the SSR server client so Supabase can clear session cookies
 * via the `setAll` cookie adapter.
 */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();

  // Even if this fails (e.g. already signed out), redirect to /login.
  await supabase.auth.signOut();

  const url = new URL(request.url);
  url.pathname = "/login";
  url.search = "";

  return NextResponse.redirect(url);
}

