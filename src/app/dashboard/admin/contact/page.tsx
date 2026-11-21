import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import ContactInbox from "./ContactInbox";

export default async function ContactAdminPage({ searchParams }: { searchParams: Promise<{ request?: string }> }) {
  const { userId } = await auth();
  if (!userId || !await isAdmin(userId)) redirect("/dashboard");
  const { request } = await searchParams;
  return <ContactInbox initialRequest={typeof request === "string" ? request : ""} />;
}
