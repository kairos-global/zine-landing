import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";
import { getOrCreateProfileId } from "@/lib/profile";
import { slugFromTitle, ensureUniqueSlug } from "@/lib/slug";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const title = ((formData.get("title") as string) || "Untitled").trim();
    const zineFormatRaw = formData.get("zine_format") as string | null;
    const zine_format: "mini" | "half_letter" =
      zineFormatRaw === "half_letter" ? "half_letter" : "mini";
    const pdfFile = formData.get("pdf") as File | null;

    if (!pdfFile || pdfFile.size === 0) {
      return NextResponse.json({ error: "Missing PDF" }, { status: 400 });
    }

    const profileId = await getOrCreateProfileId(userId);
    const issueId = randomUUID();
    const baseSlug = slugFromTitle(title);
    const slug = await ensureUniqueSlug(supabase, baseSlug, issueId);

    // Upload PDF to Supabase Storage
    const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());
    const { data: storageData, error: storageErr } = await supabase.storage
      .from("zineground")
      .upload(`issues/${issueId}.pdf`, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (storageErr || !storageData) {
      console.error("🖼 [Canvas Save] PDF upload error:", storageErr);
      return NextResponse.json({ error: `PDF upload failed: ${storageErr?.message}` }, { status: 500 });
    }

    const pdf_url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/zineground/${storageData.path}`;

    // Insert new issue record
    const { error: insertError } = await supabase.from("issues").insert({
      id: issueId,
      profile_id: profileId,
      title,
      slug,
      status: "draft",
      pdf_url,
      cover_img_url: null,
      zine_format,
      self_distribute: false,
      print_for_me: false,
      published_at: null,
    });

    if (insertError) {
      console.error("🖼 [Canvas Save] Insert error:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ issueId, slug, pdf_url });
  } catch (err) {
    console.error("🔥 [Canvas Save] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
