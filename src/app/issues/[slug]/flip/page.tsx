import { createClient } from "@supabase/supabase-js";
import { Metadata } from "next";
import Link from "next/link";
import FlipViewer from "@/components/FlipViewer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { data } = await supabase
    .from("issues")
    .select("title")
    .eq("slug", slug)
    .single();
  return {
    title: data?.title ? `${data.title} — Flip View | Zineground` : "Flip View | Zineground",
  };
}

export default async function FlipPage({ params }: Props) {
  const { slug } = await params;

  const { data: issue, error } = await supabase
    .from("issues")
    .select("id, slug, title, pdf_url, status, zine_format")
    .eq("slug", slug)
    .single();

  if (error || !issue) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white gap-4 p-6">
        <p className="text-white/60">Issue not found.</p>
        <Link href="/browse-zines" className="text-sm underline opacity-60 hover:opacity-100">
          Browse zines
        </Link>
      </div>
    );
  }

  if (!issue.pdf_url) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white gap-4 p-6">
        <p className="text-white/60">No PDF available for this issue.</p>
        <Link
          href={`/issues/${slug}`}
          className="text-sm underline opacity-60 hover:opacity-100"
        >
          ← Back to issue
        </Link>
      </div>
    );
  }

  const zineFormat = (issue.zine_format as "mini" | "half_letter" | null) ?? "half_letter";

  return (
    <FlipViewer
      pdfUrl={issue.pdf_url}
      title={issue.title}
      slug={issue.slug}
      zineFormat={zineFormat}
    />
  );
}
