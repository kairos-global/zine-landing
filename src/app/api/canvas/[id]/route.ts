import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getOrCreateProfileId } from "@/lib/profile";
import { slugFromTitle } from "@/lib/slug";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const statePath = (id: string) => `canvas/${id}.json`;

async function ownedIssue(id: string, userId: string) {
  const profileId = await getOrCreateProfileId(userId);
  return supabase.from("issues").select("id,title").eq("id", id).eq("profile_id", profileId).maybeSingle();
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const { data: issue } = await ownedIssue(id, userId);
  if (!issue) return NextResponse.json({ error: "Canvas not found" }, { status: 404 });
  const { data } = await supabase.storage.from("zineground").download(statePath(id));
  const state = data ? JSON.parse(await data.text()) : null;
  return NextResponse.json({ title: issue.title, state });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const { data: issue } = await ownedIssue(id, userId);
  if (!issue) return NextResponse.json({ error: "Canvas not found" }, { status: 404 });
  const body = await request.json();
  const payload = JSON.stringify(body.state ?? {});
  const { error: storageError } = await supabase.storage.from("zineground").upload(
    statePath(id), Buffer.from(payload), { contentType: "application/json", upsert: true }
  );
  if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 });
  if (typeof body.title === "string" && body.title.trim()) {
    const title = body.title.trim();
    await supabase.from("issues").update({ title, slug: `${slugFromTitle(title)}-${id.slice(0, 8)}` }).eq("id", id);
  }
  return NextResponse.json({ savedAt: new Date().toISOString() });
}
