import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { getSiteBaseUrl } from "@/lib/site-url";
import { IssueQRCode } from "./IssueQRCode";

// Use service role key for server-side rendering to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export default async function IssuePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // 1) Fetch issue
  const { data: issue, error } = await supabase
    .from("issues")
    .select("id, slug, title, published_at, pdf_url, cover_img_url, status")
    .eq("slug", slug)
    .single();

  if (error || !issue) {
    console.error(error);
    return <div className="p-6">Issue not found.</div>;
  }

  // 2) Fetch interactive links
  const { data: links } = await supabase
    .from("issue_links")
    .select("id, label, url, qr_path, redirect_path")
    .eq("issue_id", issue.id);

  const baseUrl = getSiteBaseUrl();
  const linksWithQR = (links ?? []).filter((l) => l.redirect_path);

  return (
    <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 p-6 md:grid-cols-[280px_1fr]">
      {/* Sidebar: zine info box + Links + Find on map */}
      <aside className="sticky top-6 h-fit space-y-4">
        {/* Zine info box / index */}
        <div className="rounded-xl border p-3 text-sm">
          <div className="font-medium mb-2">{issue.title}</div>
          <nav className="grid gap-1">
            <a href="#read" className="underline">Digital copy</a>
            <a href="#links" className="underline">Links</a>
            <a href="#locate" className="underline">Find on map</a>
          </nav>
        </div>

        {/* Links — under info box */}
        <div id="links" className="rounded-xl border p-3 text-sm">
          <h2 className="mb-3 text-sm font-semibold">Links</h2>
          {links && links.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {links.map((l, index) => (
                  <a
                    key={l.id || l.url}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    <span>🔗</span>
                    <span>{l.label || `Link ${index + 1}`}</span>
                    <span className="opacity-70">↗</span>
                  </a>
                ))}
              </div>
              {linksWithQR.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold mb-2">QR Codes</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {linksWithQR.map((l) => (
                      <div
                        key={l.id || l.url}
                        className="bg-white rounded border p-2 flex flex-col items-center"
                      >
                        <div className="text-xs font-medium mb-1 text-center truncate w-full">
                          {l.label || "Link"}
                        </div>
                        <IssueQRCode
                          fullRedirectUrl={`${baseUrl}${l.redirect_path}`}
                          label={l.label || "Link"}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs opacity-70">No links yet.</p>
          )}
        </div>

        {/* Find on map — under Links */}
        <div id="locate" className="rounded-xl border p-3 text-sm">
          <h2 className="mb-2 text-sm font-semibold">Find on map</h2>
          <p className="mb-3 text-xs opacity-70">
            Map integration coming soon.
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href={`/map?issue=${issue.slug}`}
              className="rounded-md border border-neutral-600 px-3 py-1.5 text-xs hover:bg-neutral-800 transition-colors"
            >
              View this issue on map
            </Link>
            <Link
              href="/map?view=distributors"
              className="rounded-md border border-neutral-600 px-3 py-1.5 text-xs hover:bg-neutral-800 transition-colors"
            >
              Where can I find a copy?
            </Link>
          </div>
        </div>

        <hr className="border-neutral-700" />
        <Link
          href="/browse-zines"
          className="inline-block rounded-md border px-3 py-1 text-sm hover:bg-neutral-800 transition-colors"
        >
          ← Back to all zines
        </Link>
      </aside>

      {/* Main content: Digital copy only */}
      <section>
        <div id="read" className="rounded-xl border p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Digital copy</h2>
            {issue.pdf_url && (
              <div className="flex flex-wrap gap-2">
                <a
                  href={issue.pdf_url}
                  download
                  className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 transition-colors"
                >
                  <span aria-hidden>↓</span> Download
                </a>
                <a
                  href={issue.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                  <span aria-hidden>🖨</span> Print
                </a>
              </div>
            )}
          </div>
          {issue.pdf_url ? (
            <>
              <object
                data={issue.pdf_url}
                type="application/pdf"
                className="h-[70vh] w-full rounded-md"
              >
                <a href={issue.pdf_url} target="_blank" className="underline">Open PDF</a>
              </object>
              <div className="mt-2 text-sm opacity-60">
                {issue.status === "published"
                  ? `Published: ${issue.published_at?.slice(0, 10) || "—"}`
                  : "Draft"}
              </div>
            </>
          ) : (
            <p className="text-sm opacity-70">PDF not available.</p>
          )}
        </div>
      </section>
    </main>
  );
}
