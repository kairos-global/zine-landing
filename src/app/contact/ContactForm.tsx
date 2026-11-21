"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CONTACT_EMAIL, CONTACT_TOPICS, type ContactTopic } from "@/lib/contact";

const topics = Object.entries(CONTACT_TOPICS) as [ContactTopic, (typeof CONTACT_TOPICS)[ContactTopic]][];

export default function ContactForm({ initialTopic, initialReference }: { initialTopic: ContactTopic; initialReference: string }) {
  const [topic, setTopic] = useState(initialTopic);
  const [message, setMessage] = useState("");
  const [reference, setReference] = useState(initialReference);
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [receipt, setReceipt] = useState("");
  const [error, setError] = useState("");
  const pending = useRef<{ id: string; fingerprint: string } | null>(null);
  const active = CONTACT_TOPICS[topic];

  useEffect(() => { setReady(true); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setError("");
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const fingerprint = JSON.stringify({ ...fields, topic });
    if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, id: crypto.randomUUID() };
    setSending(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, topic, id: pending.current.id }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Your request couldn’t be sent. Please try again.");
        if (response.status === 409) pending.current = null;
        return;
      }
      setReceipt(result.id);
      pending.current = null;
    } catch {
      setError("The request timed out or couldn’t connect. Try again or email us directly.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="zg-page px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7">
          <h1 className="zg-title">Contact</h1>
          <p className="mt-3 text-base">Tell us what you need help with.</p>
        </header>
        <div className="grid items-start gap-5 md:grid-cols-[minmax(235px,1fr)_minmax(0,1.7fr)]">
          <aside>
            <fieldset disabled={sending || !!receipt} className="zg-panel overflow-hidden">
              <legend className="sr-only">Request topic</legend>
              {topics.map(([key, item]) => (
                <label key={key} className={`flex cursor-pointer items-start gap-3 border-b border-black/15 p-3.5 last:border-0 hover:bg-[#e9faff] ${topic === key ? "bg-[#AAEEFF]" : ""}`}>
                  <input className="mt-1 accent-black" type="radio" name="topic" value={key} checked={topic === key} onChange={() => setTopic(key)} />
                  <span><span className="block font-black">{item.label}</span><span className="block text-sm text-black/70">{item.description}</span></span>
                </label>
              ))}
            </fieldset>
            <a href={`mailto:${CONTACT_EMAIL}`} className="mt-4 inline-block break-all text-sm font-bold underline">{CONTACT_EMAIL}</a>
          </aside>
          {receipt ? (
            <section className="zg-panel p-5 sm:p-7" aria-live="polite">
              <h2 className="text-2xl font-black">Request received</h2>
              <p className="mt-2 text-sm">We’ll use your reply email to follow up. Keep this reference for your records.</p>
              <code className="mt-3 block break-all rounded-lg bg-[#AAEEFF] p-3 text-sm">{receipt}</code>
              <button type="button" className="zg-button mt-5" onClick={() => { setReceipt(""); setMessage(""); setReference(""); }}>Start another request</button>
            </section>
          ) : (
            <form method="post" onSubmit={submit} className="zg-panel p-5 sm:p-7">
              <div className="mb-5 border-b border-black/15 pb-4">
                <h2 className="text-2xl font-black">{active.label}</h2>
                <p className="mt-1 text-sm text-black/75">{active.prompt}</p>
                {active.link && <Link className="mt-2 inline-block text-sm font-bold underline" href={active.link.href}>{active.link.label} ↗</Link>}
              </div>
              <fieldset disabled={!ready || sending} className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm font-bold">Name<input name="name" autoComplete="name" className="zg-input" required minLength={2} maxLength={100} /></label>
                  <label className="grid gap-1 text-sm font-bold">Reply email<input name="email" type="email" autoComplete="email" className="zg-input" required maxLength={254} /></label>
                </div>
                <label className="grid gap-1 text-sm font-bold">{active.reference} <span className="sr-only">(optional)</span>
                  <input name="reference" value={reference} onChange={(event) => setReference(event.target.value)} className="zg-input" maxLength={250} placeholder="Optional" />
                </label>
                <label className="grid gap-1 text-sm font-bold">Message
                  <textarea name="message" value={message} onChange={(event) => setMessage(event.target.value)} className="zg-input min-h-32 resize-y" required minLength={10} maxLength={4000} />
                </label>
                <div aria-hidden="true" className="hidden"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
                {error && <p role="alert" className="rounded-lg border border-red-700 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
                <button className="zg-button zg-button-dark justify-self-start px-5" type="submit">{sending ? "Sending…" : "Send request"}</button>
              </fieldset>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
