import { createClient } from "@supabase/supabase-js";

/**
 * Get Supabase client with service role (server-side only)
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
 * Check if a user (by Clerk ID) is an admin
 * @param clerkId - The Clerk user ID
 * @returns true if user has role 'admin', false otherwise
 */
export async function isAdmin(clerkId: string): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("clerk_id", clerkId)
      .single();

    if (error || !data) {
      console.error("Error checking admin status:", error);
      return false;
    }

    return data.role === "admin";
  } catch (err) {
    console.error("Error checking admin status:", err);
    return false;
  }
}

/**
 * Get user's role from profiles table
 * @param clerkId - The Clerk user ID
 * @returns The user's role or null
 */
export async function getUserRole(clerkId: string): Promise<string | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("clerk_id", clerkId)
      .single();

    if (error || !data) {
      console.error("Error fetching user role:", error);
      return null;
    }

    return data.role;
  } catch (err) {
    console.error("Error fetching user role:", err);
    return null;
  }
}

