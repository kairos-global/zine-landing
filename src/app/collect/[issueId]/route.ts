import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateProfileId } from "@/lib/profile";
import { getSiteBaseUrl } from "@/lib/site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const { issueId } = await params;
  const baseUrl = getSiteBaseUrl();

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(
      `${baseUrl}/sign-in?redirect_url=${encodeURIComponent(`/collect/${issueId}`)}`,
      302
    );
  }

  // Look up the issue to get its slug (must exist and be published)
  const { data: issue } = await supabase
    .from("issues")
    .select("id, slug, status")
    .eq("id", issueId)
    .maybeSingle();

  if (!issue || !issue.slug) {
    return NextResponse.redirect(`${baseUrl}/browse`, 302);
  }

  // Record the collection
  const profileId = await getOrCreateProfileId(userId);
  await supabase
    .from("collections")
    .upsert(
      { profile_id: profileId, issue_id: issueId },
      { onConflict: "profile_id,issue_id" }
    );

  // Redirect to the issue page with a flag so the page can show a confirmation
  const destination = new URL(`${baseUrl}/issues/${issue.slug}`);
  destination.searchParams.set("collected", "1");
  return NextResponse.redirect(destination.toString(), 302);
}
