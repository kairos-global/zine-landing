import type { Metadata } from "next";
import { DEFAULT_CONTACT_TOPIC, isContactTopic } from "@/lib/contact";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact | Zineground",
  description: "Get help with publishing, map listings, distribution, and store orders.",
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string; reference?: string }> }) {
  const { topic, reference } = await searchParams;
  const initialTopic = typeof topic === "string" && isContactTopic(topic) ? topic : DEFAULT_CONTACT_TOPIC;
  const initialReference = typeof reference === "string" ? reference.slice(0, 250) : "";
  return <ContactForm key={JSON.stringify([initialTopic, initialReference])} initialTopic={initialTopic} initialReference={initialReference} />;
}
