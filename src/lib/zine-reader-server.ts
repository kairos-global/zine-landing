import "server-only";

import { createClient } from "@supabase/supabase-js";

export const zineDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export const zineIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function readCollection(userId: string | null, issueId: string) {
  if (!userId) return false;
  const { data, error } = await zineDb
    .from("collections").select("id, reader:profiles!inner(clerk_id)")
    .eq("reader.clerk_id", userId).eq("issue_id", issueId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
