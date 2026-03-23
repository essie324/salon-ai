import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabaseServer";
import { decideReceptionistAction } from "@/app/lib/ai/receptionist";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabase = await createSupabaseServerClient();

    const decision = await decideReceptionistAction({
      supabase,
      input: {
        client_id: body?.client_id ?? null,
        requested_service: body?.requested_service ?? null,
        requested_stylist: body?.requested_stylist ?? null,
        timing_preference: body?.timing_preference ?? null,
        budget_notes: body?.budget_notes ?? null,
        concern_notes: body?.concern_notes ?? null,
        maxSlots: body?.maxSlots ?? undefined,
      },
    });

    return NextResponse.json(decision, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: "invalid_request", message: e?.message ?? "Unknown error" },
      { status: 400 },
    );
  }
}

