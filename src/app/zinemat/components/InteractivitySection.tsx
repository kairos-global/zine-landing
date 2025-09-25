"use client";

export type InteractiveLink = {
  id: string;
  label: string;
  url: string;
  generateQR: boolean;
  redirect_path?: string | null; // added
  qr_path?: string | null;       // added
};

export default function InteractivitySection({
  links,
  onChange,
}: {
  links: InteractiveLink[];
  onChange: (next: InteractiveLink[]) => void;
}) {
  function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const label = (fd.get("label") as string)?.trim() ?? "";
    let url = (fd.get("url") as string)?.trim() ?? "";
    const generateQR = fd.get("qr") === "on";

    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

    const next: InteractiveLink = {
      id: crypto.randomUUID(),
      label,
      url,
      generateQR,
      redirect_path: null,
      qr_path: null,
    };
    onChange([...links, next]);
    e.currentTarget.reset();
  }

  const remove = (id: string) => onChange(links.filter((l) => l.id !== id));
  const toggleQR = (id: string) =>
    onChange(
      links.map((l) => (l.id === id ? { ...l, generateQR: !l.generateQR } : l))
    );

  return (
    <div className="space-y-3">
      {/* Add link */}
      <form onSubmit={add} className="grid gap-2 md:grid-cols-4 items-end">
        <input
          name="label"
          className="rounded-xl border px-3 py-2"
          placeholder="Label"
        />
        <input
          name="url"
          className="rounded-xl border px-3 py-2 md:col-span-2"
          placeholder="https://your-link"
        />
        <div className="flex items-center gap-3">
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" name="qr" defaultChecked />
            QR
          </label>
          <button
            className="ml-auto rounded-xl bg-black px-3 py-2 text-sm text-white"
            type="submit"
          >
            Add
          </button>
        </div>
      </form>

      {/* List */}
      <div className="mt-2 space-y-2">
        {links.length === 0 ? (
          <div className="text-sm text-gray-600">No links yet</div>
        ) : (
          links.map((l) => (
            <div
              key={l.id}
              className="rounded-lg border p-2 text-sm flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
            >
              <div className="font-medium break-words">
                {l.label ? `${l.label}` : "Unnamed Link"}
              </div>
              <a
                className="text-xs underline break-all"
                href={l.url}
                target="_blank"
                rel="noreferrer"
              >
                {l.url}
              </a>
              <div className="flex items-center gap-2">
                <label className="text-xs flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={l.generateQR}
                    onChange={() => toggleQR(l.id)}
                  />
                  QR
                </label>
                <button
                  onClick={() => remove(l.id)}
                  className="rounded-md border px-2 py-1 text-xs hover:bg-white"
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
