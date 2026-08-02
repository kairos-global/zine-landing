import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getOrCreateProfileId } from "@/lib/profile";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const issueId = randomUUID();
  const profileId = await getOrCreateProfileId(userId);
  const { error } = await supabase.from("issues").insert({
    id: issueId,
    profile_id: profileId,
    title: "Untitled canvas",
    slug: `untitled-canvas-${issueId.slice(0, 8)}`,
    status: "draft",
    zine_format: "mini",
    pdf_url: null,
    cover_img_url: null,
    self_distribute: false,
    print_for_me: false,
    published_at: null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ issueId }, { status: 201 });
}
