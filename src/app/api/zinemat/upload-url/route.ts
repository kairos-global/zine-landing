import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateProfileId } from "@/lib/profile";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Returns a signed upload URL so the client can upload cover/PDF directly to Supabase.
 * This avoids sending large file bodies through our API and prevents timeouts.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { issueId, type, revision, contentType } = await req.json();
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (typeof issueId !== "string" || !uuid.test(issueId) ||
        (type !== "cover" && type !== "pdf" && type !== "canvas") ||
        (revision !== undefined && (typeof revision !== "string" || !uuid.test(revision)))) {
      return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });
    }

    const { data: issue, error: lookupError } = await supabase
      .from("issues")
      .select("profile_id")
      .eq("id", issueId)
      .maybeSingle();
    if (lookupError) return NextResponse.json({ error: "Could not verify the draft" }, { status: 500 });
    if ((issue && issue.profile_id !== await getOrCreateProfileId(userId)) || (type === "canvas" && !issue)) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    const filename = revision ? `${issueId}/${revision}` : issueId;
    const extension = contentType === "image/jpeg" ? "jpg" : contentType === "image/webp" ? "webp" : "png";
    const path = type === "canvas" ? `canvas/${issueId}.json`
      : type === "cover" ? `covers/${filename}.${extension}`
      : `issues/${filename}.pdf`;

    const { data, error } = await supabase.storage
      .from("zineground")
      .createSignedUploadUrl(path, { upsert: true });

    if (error) {
      console.error("[upload-url] createSignedUploadUrl error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/zineground/${data.path}`;

    return NextResponse.json({
      token: data.token,
      path: data.path,
      signedUrl: data.signedUrl,
      publicUrl,
    });
  } catch (err) {
    console.error("[upload-url] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
