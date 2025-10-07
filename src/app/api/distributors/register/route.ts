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

    const { data, error } = await supabase
      .from("distributors")
      .insert([
        {
          user_id: userId,
          business_name,
          business_address,
          business_phone,
          business_email,
          contact_name,
          contact_title,
          contact_email,
          contact_phone,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Distributor insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, distributor: data });
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error("Distributor register route error:", err.message);
    } else {
      console.error("Distributor register route unknown error:", err);
    }
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
