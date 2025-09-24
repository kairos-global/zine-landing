import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type InteractiveLink = {
  label: string;
  url: string;
};

export async function POST(req: Request) {
  try {
    // 👇 grab Clerk user directly
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();

    const title = formData.get("title") as string;
    const published_at = formData.get("published_at") as string;
    const issueId = formData.get("issueId") as string;
    const status = (formData.get("status") as string) || "draft";

    if (!title || !issueId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // ---------- Generate Slug ----------
    const slug = title
      .toLowerCase()
      .replace(/[^\w\s]/gi, "")
      .replace(/\s+/g, "-");

    // ---------- Upload Files ----------
    let cover_img_url: string | null = null;
    let pdf_url: string | null = null;

    const coverFile = formData.get("cover") as File | null;
    const pdfFile = formData.get("pdf") as File | null;

    const uploads = [];

    if (coverFile) {
      const extension = coverFile.type.split("/")[1];
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

    // ---------- Insert or Update into issues ----------
    const { data: existing, error: fetchErr } = await supabase
      .from("issues")
      .select("id")
      .eq("id", issueId)
      .single();

    if (fetchErr && fetchErr.code !== "PGRST116") {
      return NextResponse.json({ error: fetchErr }, { status: 500 });
    }

    const issueData = {
      id: issueId,
      title,
      slug,
      published_at: published_at || null,
      user_id: userId, // 👈 Clerk ID saved as text
      status,
      cover_img_url,
      pdf_url,
    };

    if (existing) {
      const { error: updateErr } = await supabase
        .from("issues")
        .update(issueData)
        .eq("id", issueId);
      if (updateErr) return NextResponse.json({ error: updateErr }, { status: 500 });
    } else {
      const { error: insertErr } = await supabase.from("issues").insert(issueData);
      if (insertErr) return NextResponse.json({ error: insertErr }, { status: 500 });
    }

    // ---------- Handle Interactivity Links ----------
    const interactiveLinksRaw = formData.get("interactiveLinks");
    let interactiveLinks: InteractiveLink[] = [];

    if (interactiveLinksRaw) {
      try {
        interactiveLinks = JSON.parse(interactiveLinksRaw.toString() || "[]") as InteractiveLink[];
      } catch (e) {
        console.error("⚠️ Invalid JSON in interactiveLinks:", interactiveLinksRaw);
        return NextResponse.json({ error: "Invalid interactivity data" }, { status: 400 });
      }
    }

    const processedLinks = [];

    for (const link of interactiveLinks) {
      const linkId = randomUUID();
      const redirect_path = `r/${linkId}`;

      // 👇 Placeholder QR (swap in a real generator if you want server-side QR rendering)
      const qrSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
          <text x="10" y="20">QR for ${link.url}</text>
        </svg>
      `;
      const qrBuffer = Buffer.from(qrSvg);

      const { data: qrData, error: qrErr } = await supabase.storage
        .from("zineground")
        .upload(`qr-codes/${linkId}.png`, qrBuffer, {
          contentType: "image/png",
          upsert: true,
        });

      if (qrErr) {
        console.error("QR Upload Error:", qrErr);
        continue;
      }

      const qr_url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/zineground/${qrData.path}`;

      const { error: linkErr } = await supabase.from("issue_links").insert({
        id: linkId,
        issue_id: issueId,
        label: link.label,
        url: link.url,
        qr_path: qrData.path, // internal storage path
        qr_url,               // full public URL
        redirect_path,
      });

      if (!linkErr) {
        processedLinks.push({ ...link, id: linkId, redirect_path, qr_url });
      }
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
