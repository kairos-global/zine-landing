import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getOrCreateProfileId } from "@/lib/profile";
import { zineDb, zineIdPattern } from "@/lib/zine-reader-server";

export async function POST(request: Request, context: { params: Promise<{ issueId: string }> }) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return new NextResponse(null, { status: 403 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in to recommend this zine." }, { status: 401 });

  const { issueId } = await context.params;
  const body = await request.json().catch(() => null);
  const distributor = body?.distributorId;
  if (!zineIdPattern.test(issueId) || typeof distributor !== "string" || !zineIdPattern.test(distributor)) {
    return NextResponse.json({ error: "Choose a distributor." }, { status: 400 });
  }

  try {
    const [issue, shop, profileId] = await Promise.all([
      zineDb.from("issues").select("id").eq("id", issueId).eq("status", "published").maybeSingle(),
      zineDb.from("distributors").select("id").eq("id", distributor).eq("status", "approved").maybeSingle(),
      getOrCreateProfileId(userId),
    ]);
    if (issue.error || shop.error) throw issue.error ?? shop.error;
    if (!issue.data || !shop.data) return NextResponse.json({ error: "The zine or distributor is unavailable." }, { status: 404 });

    const { error } = await zineDb.from("zine_recommendations").upsert({
      issue_id: issueId,
      distributor_id: distributor,
      profile_id: profileId,
    }, { onConflict: "distributor_id,issue_id,profile_id", ignoreDuplicates: true });
    if (error) throw error;
    return NextResponse.json({ recommended: true });
  } catch (error) {
    console.error("[Zine recommendation]", error);
    return NextResponse.json({ error: "Couldn’t send your recommendation. Try again." }, { status: 500 });
  }
}
