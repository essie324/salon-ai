import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/app/lib/supabaseServer";
import { validateBookingSlot } from "@/app/lib/booking/conflicts";

/**
 * GET /api/booking/validate-slot?stylistId=&serviceId=&date=YYYY-MM-DD&time=HH:mm&excludeAppointmentId=
 * Returns whether the slot is bookable (working hours, blocks, conflicts, eligibility when serviceId set).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stylistId = searchParams.get("stylistId")?.trim() ?? "";
  const serviceId = searchParams.get("serviceId")?.trim() ?? "";
  const date = searchParams.get("date")?.trim() ?? "";
  const time = searchParams.get("time")?.trim() ?? "";
  const excludeAppointmentId = searchParams.get("excludeAppointmentId")?.trim() || undefined;

  if (!stylistId || !date || !time) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  let durationMinutes = 60;
  if (serviceId) {
    const { data: service } = await supabase
      .from("services")
      .select("duration_minutes")
      .eq("id", serviceId)
      .maybeSingle();
    if (service?.duration_minutes != null && !Number.isNaN(Number(service.duration_minutes))) {
      durationMinutes = Number(service.duration_minutes);
    }
  }

  const startAtLocal = new Date(`${date}T${time}`);
  if (Number.isNaN(startAtLocal.getTime())) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const start_at = startAtLocal.toISOString();
  const end_at = new Date(startAtLocal.getTime() + durationMinutes * 60 * 1000).toISOString();

  const result = await validateBookingSlot(supabase, {
    stylistId,
    startAt: start_at,
    endAt: end_at,
    excludeAppointmentId,
    serviceId: serviceId || undefined,
  });

  if (result.ok) {
    return NextResponse.json({ ok: true, status: "available" });
  }

  const status =
    result.reason === "appointment_conflict"
      ? "conflict"
      : result.reason === "stylist_not_eligible"
        ? "unavailable"
        : "unavailable";

  return NextResponse.json({
    ok: false,
    status,
    reason: result.reason,
    message: result.message,
  });
}
