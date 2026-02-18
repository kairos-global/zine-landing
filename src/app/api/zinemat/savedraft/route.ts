import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";
import QRCode from "qrcode";
import { getOrCreateProfileId } from "@/lib/profile";

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

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const title = formData.get("title") as string;
    const issueId = formData.get("issueId") as string;

    if (!title || !issueId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const slug = title.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, "-");

    // Fetch existing issue to preserve URLs if not uploading new files
    const { data: existing } = await supabase
      .from("issues")
      .select("cover_img_url, pdf_url")
      .eq("id", issueId)
      .maybeSingle();

    // uploads - preserve existing URLs if not uploading new files
    let cover_img_url: string | null = existing?.cover_img_url ?? null;
    let pdf_url: string | null = existing?.pdf_url ?? null;

    console.log("📝 [SaveDraft] Existing URLs - Cover:", cover_img_url, "PDF:", pdf_url);

    const coverFile = formData.get("cover") as File | null;
    const pdfFile = formData.get("pdf") as File | null;

    if (coverFile) {
      const extension = coverFile.type.split("/")[1] || "png";
      const { data, error } = await supabase.storage
        .from("zineground")
        .upload(`covers/${issueId}.${extension}`, coverFile, { upsert: true });
      if (error) return NextResponse.json({ error }, { status: 500 });
      if (data) {
        cover_img_url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/zineground/${data.path}`;
      }
    }

    if (pdfFile) {
      const { data, error } = await supabase.storage
        .from("zineground")
        .upload(`issues/${issueId}.pdf`, pdfFile, { upsert: true });
      if (error) return NextResponse.json({ error }, { status: 500 });
      if (data) {
        pdf_url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/zineground/${data.path}`;
      }
    }

    const profileId = await getOrCreateProfileId(userId);

    // Parse distribution settings
    const distributionRaw = formData.get("distribution");
    let distribution = { self_distribute: false, print_for_me: false };
    if (distributionRaw) {
      distribution = JSON.parse(distributionRaw.toString());
    }

    const issueData = {
      id: issueId,
      title,
      slug,
      published_at: null,
      profile_id: profileId,
      status: "draft",
      cover_img_url,
      pdf_url,
      self_distribute: distribution.self_distribute,
      print_for_me: distribution.print_for_me,
    };

    console.log("📝 [SaveDraft] Upserting issue with data:", issueData);
    
    const { error: upsertError } = await supabase.from("issues").upsert(issueData);
    
    if (upsertError) {
      console.error("❌ [SaveDraft] Upsert error:", upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }
    
    console.log("✅ [SaveDraft] Issue upserted successfully");

    // interactive links + QR
    const interactiveLinksRaw = formData.get("interactiveLinks");
    let interactiveLinks: InteractiveLink[] = [];
    if (interactiveLinksRaw) {
      interactiveLinks = JSON.parse(interactiveLinksRaw.toString() || "[]");
    }

    const processedLinks: ProcessedLink[] = [];
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

    return NextResponse.json({
      status: "draft saved",
      issueId,
      slug,
      cover_img_url,
      pdf_url,
      interactiveLinks: processedLinks,
    });
  } catch (err) {
    console.error("🔥 SaveDraft error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
