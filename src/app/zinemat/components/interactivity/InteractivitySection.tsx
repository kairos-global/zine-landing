"use client";

import { qrUrl } from "@/lib/zine-qr";
import { QrActions } from "./QrActions";

export default function InteractivitySection({ issueId, canPlace, prepare, onPlace }: {
  issueId: string | null;
  canPlace: boolean;
  prepare: () => Promise<boolean>;
  onPlace: (src: string, label: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {issueId && (
        <QrActions url={qrUrl(issueId, "collection")} label="Collection QR"
          description="Lets readers open and save your published zine to their Zineground collection."
          canPlace={canPlace} prepare={prepare} onPlace={onPlace} />
      )}
    </div>
  );
}
