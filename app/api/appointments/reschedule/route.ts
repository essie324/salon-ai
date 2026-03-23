"use server";

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabaseServer";
import { validateAppointmentRequest } from "@/app/lib/booking/bookingEngine";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const body = await req.json();
    const id = String(body.id ?? "").trim();
    const stylist_id = String(body.stylistId ?? "").trim();
    const appointment_date = String(body.date ?? "").trim();
    const appointment_time = String(body.time ?? "").trim();
    const durationMinutes = Number(body.durationMinutes ?? 0) || 60;

    if (!id || !stylist_id || !appointment_date || !appointment_time) {
      return NextResponse.json({ ok: false, reason: "missing_fields" }, { status: 400 });
    }

    // Compute new start/end timestamps
    const startLocal = new Date(`${appointment_date}T${appointment_time}`);
    const start_at = startLocal.toISOString();
    const endLocal = new Date(startLocal.getTime() + durationMinutes * 60 * 1000);
    const end_at = endLocal.toISOString();

    const validation = await validateAppointmentRequest({
      supabase,
      stylistId: stylist_id,
      serviceId: "", // unknown in this route; skip eligibility based on empty service
      startAt: start_at,
      endAt: end_at,
      excludeAppointmentId: id,
    });

    if (!validation.valid) {
      if (validation.reason === "appointment_conflict") {
        return NextResponse.json({ ok: false, reason: "conflict" }, { status: 409 });
      }
      if (
        validation.reason === "outside_working_hours" ||
        validation.reason === "blocked_time"
      ) {
        return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 409 });
      }
    }

    const { error } = await supabase
      .from("appointments")
      .update({
        stylist_id,
        start_at,
        end_at,
        appointment_date,
        appointment_time,
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ ok: false, reason: "update_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, reason: "server_error" }, { status: 500 });
  }
}

