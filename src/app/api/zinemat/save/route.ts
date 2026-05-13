import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";
import QRCode from "qrcode";
import { getOrCreateProfileId } from "@/lib/profile";
import { slugFromTitle, ensureUniqueSlug } from "@/lib/slug";
import { getSiteBaseUrl } from "@/lib/site-url";
import { isZineCategoryKey, ZineCategoryKey } from "@/lib/zine-categories";

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
  max_copies_per_order?: number;
  auto_approve_quantity?: number;
  zine_format?: "mini" | "half_letter";
  category?: ZineCategoryKey | null;
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
    let distribution: {
      self_distribute: boolean;
      print_for_me: boolean;
      max_copies_per_order?: number;
      auto_approve_quantity?: number;
    } = { self_distribute: false, print_for_me: false };
    if (distributionRaw) {
      distribution = JSON.parse(distributionRaw.toString());
    }

    const zineFormatRaw = formData.get("zine_format") as string | null;
    const zine_format =
      zineFormatRaw === "mini" || zineFormatRaw === "half_letter"
        ? zineFormatRaw
        : undefined;

    // Category is optional; empty string clears it, valid key sets it, anything else is ignored
    let category: ZineCategoryKey | null | undefined = undefined;
    if (formData.has("category")) {
      const raw = (formData.get("category") as string) ?? "";
      if (raw === "") category = null;
      else if (isZineCategoryKey(raw)) category = raw;
    }

    const updates: IssueUpdate = {
      title,
      slug,
      cover_img_url,
      pdf_url,
      self_distribute: distribution.self_distribute,
      print_for_me: distribution.print_for_me,
      ...(distribution.max_copies_per_order != null
        ? { max_copies_per_order: distribution.max_copies_per_order }
        : {}),
      ...(distribution.auto_approve_quantity != null
        ? { auto_approve_quantity: distribution.auto_approve_quantity }
        : {}),
      ...(zine_format ? { zine_format } : {}),
      ...(category !== undefined ? { category } : {}),
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

    // ── Auto-upsert the Issue QR link ────────────────────────────────────────
    // Every issue automatically gets a QR code that redirects to its browse page.
    // We look up any existing __issue_qr__ link so we can reuse its stable ID.
    const { data: existingIssueQr } = await supabase
      .from("issue_links")
      .select("id")
      .eq("issue_id", issueId)
      .eq("label", "__issue_qr__")
      .maybeSingle();

    const issueQrLinkId = existingIssueQr?.id ?? randomUUID();
    const issueQrUrl = `${getSiteBaseUrl()}/issues/${slug}`;
    const issueQrRedirectPath = `/qr/${issueId}/${issueQrLinkId}`;

    let issueQrPath: string | null = null;
    try {
      const issueQrBuffer = await QRCode.toBuffer(
        `${getSiteBaseUrl()}${issueQrRedirectPath}`,
        { type: "png", width: 400 }
      );
      const { data: issueQrData, error: issueQrErr } = await supabase.storage
        .from("zineground")
        .upload(`qr-codes/${issueQrLinkId}.png`, issueQrBuffer, {
          contentType: "image/png",
          upsert: true,
        });
      if (!issueQrErr && issueQrData) {
        issueQrPath = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/zineground/${issueQrData.path}`;
      }
    } catch (qrErr) {
      console.error("💾 [Save] Issue QR generation error:", qrErr);
    }

    await supabase.from("issue_links").upsert({
      id: issueQrLinkId,
      issue_id: issueId,
      label: "__issue_qr__",
      url: issueQrUrl,
      qr_path: issueQrPath,
      redirect_path: issueQrRedirectPath,
    });

    // ── Auto-upsert the Collection QR link ───────────────────────────────────
    // Encodes a direct link to /collect/[issueId] — scanning records the
    // collection in the user's library and redirects them to the issue page.
    const { data: existingCollectionQr } = await supabase
      .from("issue_links")
      .select("id")
      .eq("issue_id", issueId)
      .eq("label", "__collection_qr__")
      .maybeSingle();

    const collectionQrLinkId = existingCollectionQr?.id ?? randomUUID();
    const collectionQrUrl = `${getSiteBaseUrl()}/collect/${issueId}`;

    let collectionQrPath: string | null = null;
    try {
      const collectionQrBuffer = await QRCode.toBuffer(collectionQrUrl, {
        type: "png",
        width: 400,
      });
      const { data: collectionQrData, error: collectionQrErr } = await supabase.storage
        .from("zineground")
        .upload(`qr-codes/${collectionQrLinkId}.png`, collectionQrBuffer, {
          contentType: "image/png",
          upsert: true,
        });
      if (!collectionQrErr && collectionQrData) {
        collectionQrPath = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/zineground/${collectionQrData.path}`;
      }
    } catch (qrErr) {
      console.error("💾 [Save] Collection QR generation error:", qrErr);
    }

    await supabase.from("issue_links").upsert({
      id: collectionQrLinkId,
      issue_id: issueId,
      label: "__collection_qr__",
      url: collectionQrUrl,
      qr_path: collectionQrPath,
      redirect_path: null,
    });
    // ─────────────────────────────────────────────────────────────────────────

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
