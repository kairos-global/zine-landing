import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client with service role (server-side only).
 * Used for profile lookups and creating profiles when missing.
 */
function getSupabaseAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase environment variables");
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Get the Supabase profile id for a Clerk user. If no profile exists (e.g. webhook
 * never ran or user signed up before webhook was set up), we create one so the user
 * can use ZineMat, Library, etc.
 *
 * Flow:
 * 1. Auth: Clerk gives you userId (clerk_id) in API routes via auth().
 * 2. Profiles: We store one row per user in Supabase `profiles` with clerk_id.
 * 3. Creation: Normally the Clerk webhook (user.created / user.updated) creates
 *    the profile. If it’s missing, we create it here on first use.
 *
 * @param clerkId - Clerk user ID from auth().userId
 * @returns Supabase profiles.id (UUID)
 */
export async function getOrCreateProfileId(clerkId: string): Promise<string> {
  const supabase = getSupabaseAdmin();

  const { data: existing, error: fetchError } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_id", clerkId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (existing?.id) return existing.id;

  // No profile yet (webhook may not have run). Create one so the user can proceed.
  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .insert({
      clerk_id: clerkId,
      email: null,
      role: "creator",
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[profile] Insert profile error:", insertError);
    throw new Error("Profile not found for this user. Ensure profile is created at signup.");
  }

  if (!created?.id) {
    throw new Error("Profile not found for this user. Ensure profile is created at signup.");
  }

  return created.id;
}
