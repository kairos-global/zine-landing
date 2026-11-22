"use client";

import { useId, useState, type FormEvent } from "react";
import { builtInQrLabels, qrUrl, type BuiltInQr } from "@/lib/zine-qr";
import { ActionIcon, QrActions } from "./QrActions";

export type InteractiveLink = {
  id: string;
  label: string;
  url: string;
  generateQR: boolean;
  redirect_path?: string | null;
  qr_path?: string | null;
};

const descriptions: Record<BuiltInQr, [string, string]> = {
  issue: ["Issue QR Code", "Opens your published zine on Zineground."],
  collection: ["Collection QR Code", "Lets readers add your published zine to their Zineground collection."],
};

export function isReaderLink(link: InteractiveLink) {
  return !Object.values(builtInQrLabels).some(label => label === link.label);
}

export default function InteractivitySection({ links, onChange, issueId, canPlace, prepare, onPlace, onRemove }: {
  links: InteractiveLink[];
  onChange: (next: InteractiveLink[]) => void;
  issueId: string | null;
  canPlace: boolean;
  prepare: () => Promise<boolean>;
  onPlace: (src: string, label: string) => void;
  onRemove: (id: string) => Promise<boolean>;
}) {
  const fieldId = useId();
  const [formQR, setFormQR] = useState(true);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const regularLinks = links.filter(isReaderLink);

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (regularLinks.length >= 8) return;
    const data = new FormData(event.currentTarget);
    const label = String(data.get("label") ?? "").trim();
    let url = String(data.get("url") ?? "").trim();
    if (!url) return;
    try {
      if (!/^[a-z][a-z\d+.-]*:\/\//i.test(url)) url = `https://${url}`;
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
      if (!isReaderLink({ id: "", label, url, generateQR: formQR })) throw new Error();
      onChange([...links, { id: crypto.randomUUID(), label, url: parsed.href, generateQR: formQR }]);
      setError("");
      event.currentTarget.reset();
      setFormQR(true);
    } catch {
      setError("Use a valid web URL and a custom label.");
    }
  }

  async function remove(id: string) {
    setError("");
    setRemoving(id);
    if (!await onRemove(id)) setError("Couldn’t remove the link. Try again.");
    setRemoving(null);
  }

  return (
    <div className="space-y-4">
      {(Object.keys(descriptions) as BuiltInQr[]).map(kind => {
        const [label, description] = descriptions[kind];
        return (
          <div key={kind} className="space-y-2 rounded-xl border-2 border-[#82E385]/60 bg-[#82E385]/6 p-4">
            <h3 className="text-sm font-semibold text-green-900">{label}</h3>
            <p className="text-sm text-gray-600">{description}</p>
            {issueId && <QrActions url={qrUrl(issueId, kind)} label={kind} canPlace={canPlace} prepare={prepare} onPlace={onPlace} />}
          </div>
        );
      })}

      <form onSubmit={add} className="space-y-2">
        <div className="grid items-end gap-2 md:grid-cols-[1fr_2fr_auto_auto]">
          <label htmlFor={`${fieldId}-label`} className="text-xs font-medium text-gray-600">
            Label
            <input id={`${fieldId}-label`} name="label" maxLength={120} className="mt-1 min-h-11 w-full rounded-xl border px-3 text-base" placeholder="e.g. Printable template" />
          </label>
          <label htmlFor={`${fieldId}-url`} className="text-xs font-medium text-gray-600">
            Link URL
            <input id={`${fieldId}-url`} name="url" required maxLength={2048} className="mt-1 min-h-11 w-full rounded-xl border px-3 text-base" placeholder="https://your-link.com" />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-green-700" checked={formQR} onChange={event => setFormQR(event.target.checked)} /> Generate QR
          </label>
          <button className="min-h-11 rounded-xl bg-black px-3 text-sm text-white disabled:opacity-50" type="submit" disabled={regularLinks.length >= 8}>Add</button>
        </div>
        {regularLinks.length >= 8 && <p className="text-xs text-gray-600">Maximum 8 links reached</p>}
        {error && <p className="text-xs text-red-700" role="alert">{error}</p>}
      </form>

      {regularLinks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-600">Added links ({regularLinks.length}/8)</h3>
          {regularLinks.map((link, index) => (
            <div key={link.id} className="space-y-3 rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{link.label || `Link ${index + 1}`}</p>
                  <a href={link.url} target="_blank" rel="noreferrer" className="break-all text-sm text-blue-700 underline">{link.url}</a>
                </div>
                <button type="button" disabled={removing !== null} onClick={() => void remove(link.id)} aria-label={`Remove ${link.label || `link ${index + 1}`}`} className="grid size-11 shrink-0 place-items-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50">
                  <ActionIcon name="close" />
                </button>
              </div>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-green-700" checked={link.generateQR} onChange={() => onChange(links.map(item => item.id === link.id ? { ...item, generateQR: !item.generateQR } : item))} /> Generate QR
              </label>
              {issueId && link.generateQR && <QrActions url={qrUrl(issueId, link.id)} label={link.label || `link-${index + 1}`} canPlace={canPlace} prepare={prepare} onPlace={onPlace} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
