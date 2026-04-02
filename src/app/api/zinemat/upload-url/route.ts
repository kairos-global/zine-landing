import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

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

    const body = await req.json();
    const issueId = body.issueId as string;
    const type = body.type as "cover" | "pdf";
    const contentType = body.contentType as string | undefined;

    if (!issueId || !type || (type !== "cover" && type !== "pdf")) {
      return NextResponse.json(
        { error: "Missing or invalid issueId or type (must be 'cover' or 'pdf')" },
        { status: 400 }
      );
    }

    let path: string;
    if (type === "cover") {
      const ext = contentType?.startsWith("image/")
        ? contentType.split("/")[1]?.replace("jpeg", "jpg") || "png"
        : "png";
      path = `covers/${issueId}.${ext}`;
    } else {
      path = `issues/${issueId}.pdf`;
    }

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
