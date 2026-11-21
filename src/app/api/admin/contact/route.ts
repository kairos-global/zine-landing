import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";

const columns = "id,created_at,topic,name,email,reference,message,status,notification_status";
const statuses = ["new", "in_progress", "resolved"];

function database() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId || !await isAdmin(userId)) return NextResponse.json({ error: "Access denied." }, { status: 403 });

  const params = new URL(request.url).searchParams;
  const page = Number(params.get("page") ?? 0);
  const status = params.get("status");
  const id = params.get("request");
  if (!Number.isSafeInteger(page) || page < 0 || page > 10000 || (status && !statuses.includes(status))
    || (id && !/^[0-9a-f-]{36}$/i.test(id))) {
    return NextResponse.json({ error: "Invalid filter." }, { status: 400 });
  }

  const limit = 20;
  let query = database().from("contact_requests").select(columns)
    .order("created_at", { ascending: false }).order("id").range(page * limit, (page + 1) * limit);
  if (status) query = query.eq("status", status);
  if (id) query = query.eq("id", id);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Requests could not be loaded." }, { status: 503 });
  return NextResponse.json({ requests: data.slice(0, limit), hasNext: data.length > limit }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId || !await isAdmin(userId)) return NextResponse.json({ error: "Access denied." }, { status: 403 });

  const fields = await request.json().catch(() => null);
  if (typeof fields?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(fields.id)
    || !statuses.includes(fields.status) || !statuses.includes(fields.previousStatus)) {
    return NextResponse.json({ error: "Invalid request status." }, { status: 400 });
  }

  const { data, error } = await database().from("contact_requests")
    .update({ status: fields.status }).eq("id", fields.id).eq("status", fields.previousStatus)
    .select(columns).maybeSingle();
  if (error) return NextResponse.json({ error: "The request could not be updated." }, { status: 503 });
  if (!data) return NextResponse.json({ error: "The request changed. Refresh the inbox and try again." }, { status: 409 });
  return NextResponse.json({ request: data });
}
