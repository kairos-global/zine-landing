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

type InteractiveLink = { 
  id?: string;
  label: string; 
  url: string;
  generateQR?: boolean;
};
type ProcessedLink = InteractiveLink & { id: string; qr_path: string; redirect_path: string };

interface IssueUpdate {
  id?: string;
  title: string;
  slug: string;
  cover_img_url: string | null;
  pdf_url: string | null;
  status?: "draft" | "published";
}

// 🔒 fetch-only: don’t auto-insert profiles
async function getProfileId(clerkId: string) {
  const { data: existing, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_id", clerkId)
    .maybeSingle();

  if (error) throw error;
  if (!existing?.id) {
    throw new Error("Profile not found for this user. Ensure profile is created at signup.");
  }

  return existing.id;
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const issueId = formData.get("issueId") as string;
    if (!issueId) return NextResponse.json({ error: "Missing issueId" }, { status: 400 });

    // 🔑 ensure the user actually has a profile
    await getProfileId(userId);

    // fetch existing issue
    const { data: existing, error: fetchError } = await supabase
      .from("issues")
      .select("id, status, published_at, cover_img_url, pdf_url, title")
      .eq("id", issueId)
      .maybeSingle();

    console.log("💾 [SaveChanges] Existing issue:", existing);
    console.log("💾 [SaveChanges] Fetch error:", fetchError);

    const title = (formData.get("title") as string) || existing?.title || "Untitled";
    const slug = title.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, "-");

    let cover_img_url = existing?.cover_img_url ?? null;
    let pdf_url = existing?.pdf_url ?? null;

    console.log("💾 [SaveChanges] Preserving existing URLs - Cover:", cover_img_url, "PDF:", pdf_url);

    const coverFile = formData.get("cover") as File | null;
    const pdfFile = formData.get("pdf") as File | null;

    if (coverFile) {
      const extension = coverFile.type.split("/")[1] || "png";
      const { data, error } = await supabase.storage
        .from("zineground")
        .upload(`covers/${issueId}.${extension}`, coverFile, { upsert: true });
      if (!error && data) {
        cover_img_url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/zineground/${data.path}`;
      }
    }

    if (pdfFile) {
      const { data, error } = await supabase.storage
        .from("zineground")
        .upload(`issues/${issueId}.pdf`, pdfFile, { upsert: true });
      if (!error && data) {
        pdf_url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/zineground/${data.path}`;
      }
    }

    // ✅ Insert if it doesn't exist, update if it does
    const updates: IssueUpdate = {
      title,
      slug,
      cover_img_url,
      pdf_url,
    };

    console.log("💾 [SaveChanges] Updates to save:", updates);

    if (existing) {
      const { error: updateError } = await supabase.from("issues").update(updates).eq("id", issueId);
      console.log("💾 [SaveChanges] Update error:", updateError);
    } else {
      updates.id = issueId;
      updates.status = "draft"; // default if created through savechanges
      const { error: insertError } = await supabase.from("issues").insert(updates);
      console.log("💾 [SaveChanges] Insert error:", insertError);
    }

    // 🔗 Interactive links + QR
    const interactiveLinksRaw = formData.get("interactiveLinks");
    const processedLinks: ProcessedLink[] = [];

    if (interactiveLinksRaw) {
      const interactiveLinks: InteractiveLink[] = JSON.parse(interactiveLinksRaw.toString() || "[]");

      for (const link of interactiveLinks) {
        // Use existing ID or generate new one
        const linkId = link.id || randomUUID();
        const redirect_path = `/qr/${issueId}/${linkId}`;
        
        // Only generate QR if requested
        let qr_path: string | null = null;
        if (link.generateQR !== false) {
          const qrPngBuffer = await QRCode.toBuffer(
            `${process.env.NEXT_PUBLIC_SITE_URL}${redirect_path}`,
            { type: "png", width: 400 }
          );

          const { data: qrData, error: qrErr } = await supabase.storage
            .from("zineground")
            .upload(`qr-codes/${linkId}.png`, qrPngBuffer, {
              contentType: "image/png",
              upsert: true,
            });

          if (qrErr || !qrData) {
            console.error("QR Upload Error:", qrErr);
          } else {
            qr_path = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/zineground/${qrData.path}`;
          }
        }

        await supabase.from("issue_links").upsert({
          id: linkId,
          issue_id: issueId,
          label: link.label,
          url: link.url,
          qr_path,
          redirect_path,
        });

        processedLinks.push({ ...link, id: linkId, qr_path: qr_path || "", redirect_path });
      }
    }

    return NextResponse.json({
      status: "changes saved",
      issueId,
      slug,
      cover_img_url,
      pdf_url,
      interactiveLinks: processedLinks,
    });
  } catch (err) {
    console.error("🔥 SaveChanges error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
