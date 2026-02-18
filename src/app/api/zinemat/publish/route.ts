import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";
import QRCode from "qrcode";
import { getOrCreateProfileId } from "@/lib/profile";
import { slugFromTitle, ensureUniqueSlug } from "@/lib/slug";

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
  status: "draft" | "published";
  profile_id: string;
  published_at?: string;
  self_distribute?: boolean;
  print_for_me?: boolean;
}

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

    // Fetch existing issue (for URLs and slug; keep slug on update to avoid unique constraint)
    const { data: existingForUrls } = await supabase
      .from("issues")
      .select("cover_img_url, pdf_url, slug")
      .eq("id", issueId)
      .maybeSingle();

    // uploads - preserve existing URLs if not uploading new files
    let cover_img_url: string | null = existingForUrls?.cover_img_url ?? null;
    let pdf_url: string | null = existingForUrls?.pdf_url ?? null;

    console.log("📤 [Publish] Existing URLs - Cover:", cover_img_url, "PDF:", pdf_url);

    const coverUrlFromForm = formData.get("cover_url");
    const pdfUrlFromForm = formData.get("pdf_url");
    if (typeof coverUrlFromForm === "string" && coverUrlFromForm !== "") {
      cover_img_url = coverUrlFromForm;
    } else {
      const coverFile = formData.get("cover") as File | null;
      if (coverFile && coverFile.size > 0) {
        const extension = coverFile.type.split("/")[1] || "png";
        const { data, error } = await supabase.storage
          .from("zineground")
          .upload(`covers/${issueId}.${extension}`, coverFile, { upsert: true });
        if (error) {
          console.error("📤 [Publish] Cover upload error:", error);
          return NextResponse.json(
            { error: `Cover image upload failed: ${error.message}` },
            { status: 500 }
          );
        }
        if (data) {
          cover_img_url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/zineground/${data.path}`;
        }
      }
    }
    if (typeof pdfUrlFromForm === "string" && pdfUrlFromForm !== "") {
      pdf_url = pdfUrlFromForm;
    } else {
      const pdfFile = formData.get("pdf") as File | null;
      if (pdfFile && pdfFile.size > 0) {
        const { data, error } = await supabase.storage
          .from("zineground")
          .upload(`issues/${issueId}.pdf`, pdfFile, { upsert: true });
        if (error) {
          console.error("📤 [Publish] PDF upload error:", error);
          return NextResponse.json(
            { error: `PDF upload failed: ${error.message}` },
            { status: 500 }
          );
        }
        if (data) {
          pdf_url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/zineground/${data.path}`;
        }
      }
    }

    const profileId = await getOrCreateProfileId(userId);

    const baseSlug = slugFromTitle(title);
    const slug = existingForUrls?.slug ?? (await ensureUniqueSlug(supabase, baseSlug, issueId));

    // ✅ check if issue already exists (for published_at)
    const { data: existing } = await supabase
      .from("issues")
      .select("id, published_at")
      .eq("id", issueId)
      .maybeSingle();

    // Parse distribution settings
    const distributionRaw = formData.get("distribution");
    let distribution = { self_distribute: false, print_for_me: false };
    if (distributionRaw) {
      distribution = JSON.parse(distributionRaw.toString());
    }

    // If print_for_me is enabled, verify payment has been made
    if (distribution.print_for_me) {
      const { data: payment } = await supabase
        .from("creator_print_payments")
        .select("payment_status")
        .eq("issue_id", issueId)
        .eq("payment_status", "paid")
        .maybeSingle();

      if (!payment) {
        return NextResponse.json(
          {
            error: "Payment required",
            requiresPayment: true,
            issueId,
            message: "Please complete payment for print-for-me distribution before publishing.",
          },
          { status: 402 }
        );
      }
    }

    const updates: IssueUpdate = {
      title,
      slug,
      cover_img_url,
      pdf_url,
      status: "published",
      profile_id: profileId,
      self_distribute: distribution.self_distribute,
      print_for_me: distribution.print_for_me,
    };

    // Only set published_at if this is the first time publishing
    if (!existing?.published_at) {
      updates.published_at = new Date().toISOString();
    }

    if (existing) {
      await supabase.from("issues").update(updates).eq("id", issueId);
    } else {
      updates.id = issueId;
      if (!updates.published_at) {
        updates.published_at = new Date().toISOString();
      }
      await supabase.from("issues").insert(updates);
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
      status: "published",
      issueId,
      slug,
      cover_img_url,
      pdf_url,
      interactiveLinks: processedLinks,
    });
  } catch (err) {
    console.error("🔥 Publish error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
