import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { getOrCreateProfileId } from "@/lib/profile";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

type BadgeStatus = "none" | "pending" | "approved" | "rejected";

async function getStatusBadges(profileId: string, clerkId: string) {
  // Paid creator: look up market_creators by profile_id
  const [{ data: mc }, { data: dist }] = await Promise.all([
    supabase
      .from("market_creators")
      .select("status")
      .eq("profile_id", profileId)
      .maybeSingle(),
    supabase
      .from("distributors")
      .select("status")
      .eq("user_id", clerkId)
      .maybeSingle(),
  ]);

  return {
    paidCreatorStatus: (mc?.status ?? "none") as BadgeStatus,
    distributorStatus: (dist?.status ?? "none") as BadgeStatus,
  };
}

/**
 * GET /api/profile
 * Returns the signed-in user's profile + status badges.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = await getOrCreateProfileId(userId);

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, clerk_id, email, role, display_name, username, avatar_url, created_at")
      .eq("id", profileId)
      .single();

    if (error || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { paidCreatorStatus, distributorStatus } = await getStatusBadges(
      profile.id,
      userId
    );

    return NextResponse.json({
      profile: {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        displayName: profile.display_name,
        username: profile.username,
        avatarUrl: profile.avatar_url,
        createdAt: profile.created_at,
      },
      badges: {
        paidCreatorStatus,
        distributorStatus,
      },
    });
  } catch (err) {
    console.error("[Profile GET] Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * PATCH /api/profile
 * Body: { displayName?: string|null, username?: string|null, avatarUrl?: string|null }
 * Updates the signed-in user's profile.
 */
export async function PATCH(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = await getOrCreateProfileId(userId);
    const body = await req.json().catch(() => ({}));

    const updates: Record<string, string | null> = {};

    if ("displayName" in body) {
      const v = body.displayName;
      if (v === null || v === "") {
        updates.display_name = null;
      } else if (typeof v === "string") {
        const trimmed = v.trim();
        if (trimmed.length > 60) {
          return NextResponse.json(
            { error: "Display name must be 60 characters or fewer" },
            { status: 400 }
          );
        }
        updates.display_name = trimmed || null;
      }
    }

    if ("username" in body) {
      const v = body.username;
      if (v === null || v === "") {
        updates.username = null;
      } else if (typeof v === "string") {
        const trimmed = v.trim();
        if (!USERNAME_REGEX.test(trimmed)) {
          return NextResponse.json(
            {
              error:
                "Username must be 3–30 characters, letters, numbers, or underscore only.",
            },
            { status: 400 }
          );
        }

        // Case-insensitive uniqueness check (excluding self)
        const { data: taken } = await supabase
          .from("profiles")
          .select("id")
          .ilike("username", trimmed)
          .neq("id", profileId)
          .maybeSingle();

        if (taken) {
          return NextResponse.json(
            { error: "That username is already taken." },
            { status: 409 }
          );
        }
        updates.username = trimmed;
      }
    }

    if ("avatarUrl" in body) {
      const v = body.avatarUrl;
      if (v === null || v === "") {
        updates.avatar_url = null;
      } else if (typeof v === "string") {
        updates.avatar_url = v.trim();
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", profileId)
      .select("id, display_name, username, avatar_url, created_at")
      .single();

    if (error) {
      console.error("[Profile PATCH] Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: data.id,
        displayName: data.display_name,
        username: data.username,
        avatarUrl: data.avatar_url,
        createdAt: data.created_at,
      },
    });
  } catch (err) {
    console.error("[Profile PATCH] Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
