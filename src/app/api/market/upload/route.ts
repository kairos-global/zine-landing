import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { getOrCreateProfileId } from "@/lib/profile";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "creator-profile";
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * POST /api/market/upload
 * Upload a profile or portfolio image. Body: multipart/form-data with file "file".
 * Returns { url: string } (public URL). Create bucket "creator-profile" in Supabase Storage with public read.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const profileId = await getOrCreateProfileId(userId);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file || !file.size) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Invalid type. Use JPEG, PNG, WebP, or GIF" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${profileId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const buf = await file.arrayBuffer();
    const { error } = await supabase.storage.from(BUCKET).upload(path, buf, {
      contentType: file.type,
      upsert: false,
    });

    if (error) {
      console.error("[Market upload] Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: urlData.publicUrl });
  } catch (err) {
    console.error("[Market upload] Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
