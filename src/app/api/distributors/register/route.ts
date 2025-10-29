import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // needs server role
);

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Distributor Register] User ID:", userId);

    const body = await req.json();

    const {
      business_name,
      business_address,
      business_phone,
      business_email,
      contact_name,
      contact_title,
      contact_email,
      contact_phone,
    } = body as {
      business_name: string;
      business_address: string;
      business_phone: string;
      business_email: string;
      contact_name: string;
      contact_title: string;
      contact_email: string;
      contact_phone: string;
    };

    // Set status to pending by default
    const insertData = {
      user_id: userId,
      business_name,
      business_address,
      business_phone,
      business_email,
      contact_name,
      contact_title,
      contact_email,
      contact_phone,
      status: "pending",
    };

    console.log("[Distributor Register] Insert data:", insertData);

    const { data, error } = await supabase
      .from("distributors")
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error("[Distributor Register] Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.log("[Distributor Register] Success:", data);
    return NextResponse.json({ success: true, distributor: data });
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error("[Distributor Register] Error:", err.message);
    } else {
      console.error("[Distributor Register] Unknown error:", err);
    }
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
