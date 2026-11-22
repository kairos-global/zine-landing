import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getOrCreateProfileId } from "@/lib/profile";
import { zineDb, zineIdPattern } from "@/lib/zine-reader-server";

export async function POST(request: Request, context: { params: Promise<{ issueId: string }> }) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return new NextResponse(null, { status: 403 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in to save this zine." }, { status: 401 });
  const { issueId } = await context.params;
  if (!zineIdPattern.test(issueId)) return new NextResponse(null, { status: 404 });
  try {
    const reader = await getOrCreateProfileId(userId);
    const { data, error } = await zineDb.rpc("collect_zine", { target: issueId, reader });
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "This zine is unavailable to collect." }, { status: 404 });
    return NextResponse.json({ saved: true });
  } catch (error) {
    console.error("[Collect zine]", error);
    return NextResponse.json({ error: "Couldn’t save this zine. Try again." }, { status: 500 });
  }
}
