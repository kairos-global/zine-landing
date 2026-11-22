"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

export default function ActionDialog({ title, children, onDismiss, busy = false }: {
  title: string;
  children: ReactNode;
  onDismiss: () => void;
  busy?: boolean;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); };
  }, []);

  return (
    <dialog ref={dialog} aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); if (!busy) onDismiss(); }}
      className="zine-action-dialog m-auto max-h-[90dvh] w-[min(92vw,27rem)] overflow-auto rounded-2xl border border-black bg-white p-5 text-black shadow-xl backdrop:bg-black/35 sm:p-6">
      <h2 id={titleId} className="text-xl font-semibold">{title}</h2>
      {children}
    </dialog>
  );
}
