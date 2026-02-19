import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";
import QRCode from "qrcode";
import { getOrCreateProfileId } from "@/lib/profile";
import { slugFromTitle, ensureUniqueSlug } from "@/lib/slug";
import { getSiteBaseUrl } from "@/lib/site-url";

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

    const profileId = await getOrCreateProfileId(userId);

    const { data: existing, error: fetchError } = await supabase
      .from("issues")
      .select("id, status, published_at, cover_img_url, pdf_url, title, slug")
      .eq("id", issueId)
      .maybeSingle();

    console.log("💾 [Save] Existing issue:", existing);
    if (fetchError) console.error("💾 [Save] Fetch error:", fetchError);

    const title = (formData.get("title") as string) || existing?.title || "Untitled";
    const baseSlug = slugFromTitle(title);
    const slug = existing ? existing.slug : await ensureUniqueSlug(supabase, baseSlug, issueId);

    let cover_img_url = existing?.cover_img_url ?? null;
    let pdf_url = existing?.pdf_url ?? null;

    // Prefer URLs from client-side direct upload (avoids large request body and timeouts)
    const coverUrlFromForm = formData.get("cover_url");
    const pdfUrlFromForm = formData.get("pdf_url");
    if (typeof coverUrlFromForm === "string") {
      cover_img_url = coverUrlFromForm === "" ? null : coverUrlFromForm;
    } else {
      const coverFile = formData.get("cover") as File | null;
      if (coverFile && coverFile.size > 0) {
        const extension = coverFile.type.split("/")[1] || "png";
        const { data, error } = await supabase.storage
          .from("zineground")
          .upload(`covers/${issueId}.${extension}`, coverFile, { upsert: true });
        if (error) {
          console.error("💾 [Save] Cover upload error:", error);
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
    if (typeof pdfUrlFromForm === "string") {
      pdf_url = pdfUrlFromForm === "" ? null : pdfUrlFromForm;
    } else {
      const pdfFile = formData.get("pdf") as File | null;
      if (pdfFile && pdfFile.size > 0) {
        const { data, error } = await supabase.storage
          .from("zineground")
          .upload(`issues/${issueId}.pdf`, pdfFile, { upsert: true });
        if (error) {
          console.error("💾 [Save] PDF upload error:", error);
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

    const distributionRaw = formData.get("distribution");
    let distribution = { self_distribute: false, print_for_me: false };
    if (distributionRaw) {
      distribution = JSON.parse(distributionRaw.toString());
    }

    const updates: IssueUpdate = {
      title,
      slug,
      cover_img_url,
      pdf_url,
      self_distribute: distribution.self_distribute,
      print_for_me: distribution.print_for_me,
    };

    if (existing) {
      const { error: updateError } = await supabase.from("issues").update(updates).eq("id", issueId);
      if (updateError) {
        console.error("💾 [Save] Update error:", updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    } else {
      updates.id = issueId;
      updates.status = "draft";
      updates.profile_id = profileId;
      updates.published_at = null;
      const { error: insertError } = await supabase.from("issues").insert(updates);
      if (insertError) {
        console.error("💾 [Save] Insert error:", insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    const interactiveLinksRaw = formData.get("interactiveLinks");
    const processedLinks: ProcessedLink[] = [];

    if (interactiveLinksRaw) {
      const interactiveLinks: InteractiveLink[] = JSON.parse(interactiveLinksRaw.toString() || "[]");

      for (const link of interactiveLinks) {
        const linkId = link.id || randomUUID();
        const redirect_path = `/qr/${issueId}/${linkId}`;
        let qr_path: string | null = null;
        if (link.generateQR !== false) {
          const qrPngBuffer = await QRCode.toBuffer(
            `${getSiteBaseUrl()}${redirect_path}`,
            { type: "png", width: 400 }
          );
          const { data: qrData, error: qrErr } = await supabase.storage
            .from("zineground")
            .upload(`qr-codes/${linkId}.png`, qrPngBuffer, {
              contentType: "image/png",
              upsert: true,
            });
          if (qrErr || !qrData) {
            console.error("💾 [Save] QR upload error:", qrErr);
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
      status: "saved",
      issueId,
      slug,
      cover_img_url,
      pdf_url,
      interactiveLinks: processedLinks,
    });
  } catch (err) {
    console.error("🔥 [Save] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
