import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!; // server-only

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: { message: "Sign in required." } },
        { status: 401 }
      );
    }

    const form = await req.formData();

    const parseJSON = <T,>(key: string, fallback: T): T => {
      try {
        const raw = form.get(key);
        return raw ? (JSON.parse(String(raw)) as T) : fallback;
      } catch {
        return fallback;
      }
    };

    const issue        = parseJSON<any>("issue", {});
    const features     = parseJSON<any[]>("features", []);
    const events       = parseJSON<any[]>("events", []);
    const advertisers  = parseJSON<any[]>("advertisers", []);
    const distributors = parseJSON<any[]>("distributors", []);
    const links        = parseJSON<any[]>("links", []);
    const wantQR       = parseJSON<boolean>("wantQR", true);

    const cover = form.get("cover") as File | null;
    const pdf   = form.get("pdf") as File | null;

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 1) Insert issue
    const slug = issue?.slug || `issue-${Date.now().toString().slice(-6)}`;
    const { data: issueRow, error: issueErr } = await supabase
      .from("issues")
      .insert({
        slug,
        title: issue?.title ?? null,
        status: issue?.status ?? "draft",
        published_at: issue?.published_at ?? null,
      })
      .select("id")
      .single();

    if (issueErr || !issueRow) {
      return NextResponse.json({ ok: false, error: issueErr }, { status: 400 });
    }

    const issueId: string = issueRow.id as string;
    const ts = Date.now();

    // 2) Upload files (bucket: Zineground/{covers|pdfs})
    let coverUrl: string | null = null;
    let pdfUrl: string | null = null;

    if (cover) {
      const key = `covers/${issueId}-${ts}-${cover.name}`;
      const { data, error } = await supabase.storage
        .from("Zineground")
        .upload(key, cover, { upsert: false });
      if (!error && data) {
        coverUrl = supabase.storage.from("Zineground").getPublicUrl(data.path).data.publicUrl;
      }
    }

    if (pdf) {
      const key = `pdfs/${issueId}-${ts}-${pdf.name}`;
      const { data, error } = await supabase.storage
        .from("Zineground")
        .upload(key, pdf, { upsert: false });
      if (!error && data) {
        pdfUrl = supabase.storage.from("Zineground").getPublicUrl(data.path).data.publicUrl;
      }
    }

    if (coverUrl || pdfUrl) {
      await supabase.from("issues")
        .update({ cover_img_url: coverUrl, pdf_url: pdfUrl })
        .eq("id", issueId);
    }

    // 3) Related rows
    const has = (a: any[]) => Array.isArray(a) && a.length > 0;

    if (has(features)) {
      await supabase.from("features").insert(
        features.map((f) => ({ issue_id: issueId, type: "feature", name: f?.name ?? null, url: f?.url ?? null }))
      );
    }
    if (has(events)) {
      await supabase.from("features").insert(
        events.map((e) => ({ issue_id: issueId, type: "event", name: e?.name ?? null, url: e?.url ?? null }))
      );
    }
    if (has(advertisers)) {
      await supabase.from("advertisers").insert(
        advertisers.map((a) => ({ issue_id: issueId, name: a?.name ?? null, website: a?.website ?? null }))
      );
    }
    if (has(distributors)) {
      await supabase.from("distributors").insert(
        distributors.map((d) => ({ issue_id: issueId, name: d?.name ?? null, website: d?.website ?? null, active: true }))
      );
    }
    if (has(links)) {
      await supabase.from("issue_links").insert(
        links.map((l, i: number) => ({ issue_id: issueId, label: l?.label ?? null, url: l?.url ?? null, sort_order: i }))
      );
    }

    if (wantQR) {
      try {
        await supabase.rpc("generate_missing_redirects_for_issue", { p_issue_id: issueId });
      } catch { /* ignore if function missing */ }
    }

    return NextResponse.json({ ok: true, issue_id: issueId });
  } catch (e: any) {
    console.error("zinemat/submit error:", e);
    return NextResponse.json(
      { ok: false, error: { message: e?.message || "Server error" } },
      { status: 500 }
    );
  }
}
