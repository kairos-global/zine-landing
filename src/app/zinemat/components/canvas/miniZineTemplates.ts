import type { CSSProperties } from "react";

export type MiniZineTemplateId = "plain" | "notebook" | "graph" | "sunset";

export interface MiniZineTemplate {
  id: MiniZineTemplateId;
  name: string;
  shortLabel: string;
  /** Optional line under the title on the picker card (like secondary meta, not a rating). */
  tagline?: string;
  /** Per logical page index 0–7 (matches `index` on UploadImage / images[]). */
  slotStyle: (pageIndex: number) => CSSProperties;
}

const notebook: CSSProperties = {
  backgroundColor: "#faf8f3",
  backgroundImage: `repeating-linear-gradient(
    transparent,
    transparent 27px,
    rgba(180, 170, 150, 0.35) 27px,
    rgba(180, 170, 150, 0.35) 28px
  )`,
};

const graph: CSSProperties = {
  backgroundColor: "#f8fafc",
  backgroundImage: `
    linear-gradient(rgba(148, 163, 184, 0.25) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.25) 1px, transparent 1px)
  `,
  backgroundSize: "18px 18px",
};

const plain: CSSProperties = {
  backgroundColor: "#e5e7eb",
};

const sunset: CSSProperties = {
  background: "linear-gradient(145deg, #fef3c7 0%, #fde68a 35%, #fca5a5 70%, #c4b5fd 100%)",
};

export const MINI_ZINE_TEMPLATES: MiniZineTemplate[] = [
  {
    id: "plain",
    name: "Plain",
    shortLabel: "Neutral gray panels",
    tagline: "Clean starting point for any layout.",
    slotStyle: () => plain,
  },
  {
    id: "notebook",
    name: "Notebook",
    shortLabel: "Ruled paper",
    tagline: "Line up type and sketches like looseleaf.",
    slotStyle: () => notebook,
  },
  {
    id: "graph",
    name: "Graph paper",
    shortLabel: "Light grid",
    tagline: "Structure collages and diagrams.",
    slotStyle: () => graph,
  },
  {
    id: "sunset",
    name: "Sunset wash",
    shortLabel: "Warm gradient",
    tagline: "Soft color behind your photos.",
    slotStyle: () => sunset,
  },
];

export const DEFAULT_MINI_TEMPLATE_ID: MiniZineTemplateId = "plain";

export function getMiniTemplateById(id: MiniZineTemplateId): MiniZineTemplate {
  return MINI_ZINE_TEMPLATES.find((t) => t.id === id) ?? MINI_ZINE_TEMPLATES[0];
}
