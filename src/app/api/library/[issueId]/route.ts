import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getOrCreateProfileId } from "@/lib/profile";
import { zineDb, zineIdPattern } from "@/lib/zine-reader-server";

export async function POST(request: Request, context: { params: Promise<{ issueId: string }> }) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return new NextResponse(null, { status: 403 });

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in to manage your zines." }, { status: 401 });

  const { issueId } = await context.params;
  const body = await request.json().catch(() => null);
  const operation = body?.action;
  if (!zineIdPattern.test(issueId) || !["delete", "keep", "remove"].includes(operation)) {
    return NextResponse.json({ error: "Choose a valid library action." }, { status: 400 });
  }

  try {
    const owner = await getOrCreateProfileId(userId);
    const { data, error } = await zineDb.rpc("change_zine_library", { target: issueId, owner, operation });
    if (error) throw error;
    if (data?.status === "missing") return NextResponse.json({ error: "Zine not found." }, { status: 404 });
    if (data?.status === "conflict") return NextResponse.json({ error: "This action is unavailable for the zine’s current status." }, { status: 409 });

    const paths: string[] = data.paths ?? [];
    for (let start = 0; start < paths.length; start += 100) {
      const { error } = await zineDb.storage.from("zineground").remove(paths.slice(start, start + 100));
      if (error) throw error;
    }
    if (paths.length) {
      const { error } = await zineDb.from("deleted_zine_drafts").update({ asset_paths: [] }).eq("id", issueId).eq("owner_id", owner);
      if (error) throw error;
    }
    return NextResponse.json({ status: data.status });
  } catch (error) {
    console.error("[Library action]", error);
    return NextResponse.json({ error: "Couldn’t finish updating this zine. Try again." }, { status: 500 });
  }
}
