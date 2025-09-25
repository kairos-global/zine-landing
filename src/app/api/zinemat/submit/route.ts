import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type InteractiveLink = { label: string; url: string };

// --- ensure a profile row exists for the current Clerk user ---
async function ensureProfileId(clerkId: string) {
  const { data: existing, error: selErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_id", clerkId)
    .maybeSingle();

  if (selErr) throw selErr;
  if (existing?.id) return existing.id;

  const { data: inserted, error: insErr } = await supabase
    .from("profiles")
    .insert({ clerk_id: clerkId }) // email/role optional; add later if you want
    .select("id")
    .single();

  if (insErr) throw insErr;
  return inserted.id;
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const title = formData.get("title") as string;
    const published_at = formData.get("published_at") as string;
    const issueId = formData.get("issueId") as string;
    const status = (formData.get("status") as string) || "draft";

    if (!title || !issueId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // slug
    const slug = title.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, "-");

    // uploads
    let cover_img_url: string | null = null;
    let pdf_url: string | null = null;

    const coverFile = formData.get("cover") as File | null;
    const pdfFile = formData.get("pdf") as File | null;

    const uploads: Array<{ type: "cover" | "pdf"; path: string }> = [];

    if (coverFile) {
      const extension = coverFile.type.split("/")[1] || "png";
      const { data, error } = await supabase.storage
        .from("zineground")
        .upload(`covers/${issueId}.${extension}`, coverFile, { upsert: true });
      if (error) return NextResponse.json({ error }, { status: 500 });
      cover_img_url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/zineground/${data.path}`;
      uploads.push({ type: "cover", path: cover_img_url });
    }

    if (pdfFile) {
      const { data, error } = await supabase.storage
        .from("zineground")
        .upload(`issues/${issueId}.pdf`, pdfFile, { upsert: true });
      if (error) return NextResponse.json({ error }, { status: 500 });
      pdf_url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/zineground/${data.path}`;
      uploads.push({ type: "pdf", path: pdf_url });
    }

    // 🔐 ensure profile exists, then save issue with profile_id
    const profileId = await ensureProfileId(userId);

    // upsert issue
    const { data: existing, error: fetchErr } = await supabase
      .from("issues")
      .select("id")
      .eq("id", issueId)
      .maybeSingle();
    if (fetchErr) return NextResponse.json({ error: fetchErr }, { status: 500 });

    const issueData = {
      id: issueId,
      title,
      slug,
      published_at: published_at || null,
      profile_id: profileId, // ← schema-correct
      status,
      cover_img_url,
      pdf_url,
    };

    if (existing?.id) {
      const { error } = await supabase.from("issues").update(issueData).eq("id", issueId);
      if (error) return NextResponse.json({ error }, { status: 500 });
    } else {
      const { error } = await supabase.from("issues").insert(issueData);
      if (error) return NextResponse.json({ error }, { status: 500 });
    }

    // links
    const interactiveLinksRaw = formData.get("interactiveLinks");
    let interactiveLinks: InteractiveLink[] = [];
    if (interactiveLinksRaw) {
      try {
        interactiveLinks = JSON.parse(interactiveLinksRaw.toString() || "[]");
      } catch {
        return NextResponse.json({ error: "Invalid interactivity data" }, { status: 400 });
      }
    }

    const processedLinks: any[] = [];
    for (const link of interactiveLinks) {
      const linkId = randomUUID();
      const redirect_path = `/qr/${issueId}/${linkId}`; // tracked redirect

      // generate QR PNG → points to tracked redirect URL
      const qrPngBuffer = await QRCode.toBuffer(
        `${process.env.NEXT_PUBLIC_SITE_URL}${redirect_path}`,
        { type: "png", width: 400 }
      );

      // upload QR
      const { data: qrData, error: qrErr } = await supabase.storage
        .from("zineground")
        .upload(`qr-codes/${linkId}.png`, qrPngBuffer, {
          contentType: "image/png",
          upsert: true,
        });
      if (qrErr) {
        console.error("QR Upload Error:", qrErr);
        continue;
      }

      const qr_path = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/zineground/${qrData.path}`;

      const { error: linkErr } = await supabase.from("issue_links").insert({
        id: linkId,
        issue_id: issueId,
        label: link.label,
        url: link.url,
        qr_path,        // public URL to the PNG
        redirect_path,  // /qr/{issueId}/{linkId}
      });
      if (!linkErr) processedLinks.push({ ...link, id: linkId, qr_path, redirect_path });
    }

    return NextResponse.json({
      status: "ok",
      title,
      slug,
      issueId,
      uploads,
      interactiveLinks: processedLinks,
    });
  } catch (err) {
    console.error("🔥 Fatal error in POST /api/zinemat/submit:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
