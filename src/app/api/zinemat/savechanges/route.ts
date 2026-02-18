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
  status?: "draft" | "published";
  profile_id?: string;
  published_at?: string | null;
  self_distribute?: boolean;
  print_for_me?: boolean;
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const issueId = formData.get("issueId") as string;
    if (!issueId) return NextResponse.json({ error: "Missing issueId" }, { status: 400 });

    // 🔑 get or create profile (creates on first use if Clerk webhook didn’t run)
    const profileId = await getOrCreateProfileId(userId);

    // fetch existing issue (include slug so we keep it on update and avoid unique constraint)
    const { data: existing, error: fetchError } = await supabase
      .from("issues")
      .select("id, status, published_at, cover_img_url, pdf_url, title, slug")
      .eq("id", issueId)
      .maybeSingle();

    console.log("💾 [SaveChanges] Existing issue:", existing);
    console.log("💾 [SaveChanges] Fetch error:", fetchError);

    const title = (formData.get("title") as string) || existing?.title || "Untitled";
    const baseSlug = slugFromTitle(title);
    const slug = existing ? existing.slug : await ensureUniqueSlug(supabase, baseSlug, issueId);

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

    // Parse distribution settings
    const distributionRaw = formData.get("distribution");
    let distribution = { self_distribute: false, print_for_me: false };
    if (distributionRaw) {
      distribution = JSON.parse(distributionRaw.toString());
    }

    // ✅ Insert if it doesn't exist, update if it does
    const updates: IssueUpdate = {
      title,
      slug,
      cover_img_url,
      pdf_url,
      self_distribute: distribution.self_distribute,
      print_for_me: distribution.print_for_me,
    };

    console.log("💾 [SaveChanges] Updates to save:", updates);

    if (existing) {
      const { error: updateError } = await supabase.from("issues").update(updates).eq("id", issueId);
      if (updateError) {
        console.error("💾 [SaveChanges] Update error:", updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    } else {
      updates.id = issueId;
      updates.status = "draft"; // saved but not published
      updates.profile_id = profileId;
      updates.published_at = null;
      const { error: insertError } = await supabase.from("issues").insert(updates);
      if (insertError) {
        console.error("💾 [SaveChanges] Insert error:", insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
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
