import type { Metadata } from "next";
import { isContactTopic } from "@/lib/contact";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact | Zineground",
  description: "Get help with publishing, map listings, distribution, and store orders.",
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string; reference?: string }> }) {
  const { topic, reference } = await searchParams;
  return <ContactForm initialTopic={typeof topic === "string" && isContactTopic(topic) ? topic : "general"} initialReference={typeof reference === "string" ? reference.slice(0, 250) : ""} />;
}
