import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { after, NextResponse } from "next/server";
import { isContactTopic, type ContactRequest } from "@/lib/contact";
import { notifyContactMailbox } from "@/lib/contact-mail";

export const maxDuration = 30;

export async function POST(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Submit your request from Zineground." }, { status: 403 });
  }

  let fields: Record<string, unknown>;
  try {
    const text = await request.text();
    if (Buffer.byteLength(text) > 24_000) return NextResponse.json({ error: "Your request is too large." }, { status: 413 });
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    fields = parsed;
  } catch {
    return NextResponse.json({ error: "Your request could not be read." }, { status: 400 });
  }

  const field = (key: string) => typeof fields[key] === "string" ? fields[key].trim() : "";
  const topic = field("topic");
  const id = field("id");
  const name = field("name");
  const email = field("email");
  const reference = field("reference");
  const message = field("message");
  if (field("website")) return NextResponse.json({ error: "Your request could not be submitted." }, { status: 400 });
  if (!isContactTopic(topic)
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    || name.length < 2 || name.length > 100
    || email.length > 254 || !/^[^\s<>(),:;@"\\]+@[^\s<>(),:;@"\\]+\.[^\s<>(),:;@"\\]+$/.test(email)
    || reference.length > 250 || message.length < 10 || message.length > 4000) {
    return NextResponse.json({ error: "Enter your name, a valid reply email, and a message of at least 10 characters." }, { status: 400 });
  }

  try {
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret);
    const source = request.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim() || email.toLowerCase();
    const sourceKey = createHmac("sha256", secret).update(source).digest("hex");
    const { data, error } = await db.rpc("submit_contact_request", {
      request_id: id,
      request_topic: topic,
      request_name: name,
      request_email: email,
      request_reference: reference,
      request_message: message,
      request_source: sourceKey,
    });
    if (error) throw error;
    if (data === "limited") return NextResponse.json({ error: "Too many requests. Wait an hour or email us directly." }, { status: 429, headers: { "Retry-After": "3600" } });
    if (data === "conflict") return NextResponse.json({ error: "This request was already submitted. Start a new request." }, { status: 409 });
    if (data === "created") {
      const contact: ContactRequest = { id, topic, name, email, reference, message };
      after(async () => {
        let notification: Awaited<ReturnType<typeof notifyContactMailbox>> = { status: "failed" };
        try {
          notification = await notifyContactMailbox(contact);
        } catch (error) {
          console.error("[ContactMailbox]", id, error instanceof Error ? error.message : "Delivery failed");
        }
        const { error } = await db.from("contact_requests")
          .update({ notification_status: notification.status, gmail_message_id: notification.id ?? null })
          .eq("id", id);
        if (error) console.error("[ContactMailbox] Could not save delivery status", id, error.code);
      });
    } else if (data !== "existing") {
      throw new Error("Unexpected intake result");
    }
    return NextResponse.json({ id }, { status: data === "created" ? 201 : 200 });
  } catch (error) {
    console.error("[ContactRequest]", error instanceof Error ? error.message : "Database request failed");
    return NextResponse.json({ error: "We couldn’t save your request. Try again or email us directly." }, { status: 503 });
  }
}
