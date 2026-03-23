import { redirect } from "next/navigation";

type SearchParams = {
  clientId?: string;
  stylistId?: string;
  date?: string;
  time?: string;
  error?: string;
  message?: string;
};

function toQueryString(params: SearchParams) {
  const search = new URLSearchParams();

  if (params.clientId) search.set("clientId", params.clientId);
  if (params.stylistId) search.set("stylistId", params.stylistId);
  if (params.date) search.set("date", params.date);
  if (params.time) search.set("time", params.time);
  if (params.error) search.set("error", params.error);
  if (params.message) search.set("message", params.message);

  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export default async function NewAppointmentRedirectPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  redirect(`/dashboard/appointments/new${toQueryString(params)}`);
}