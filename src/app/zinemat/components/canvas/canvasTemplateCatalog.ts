import type { MiniZineTemplate } from "./miniZineTemplates";
import { MINI_ZINE_TEMPLATES } from "./miniZineTemplates";

/** Fold / page geometry — not a visual skin. */
export type CanvasFormatKind = "mini" | "full";

/**
 * Templates shown in the browser (excludes "plain" — that is the default blank
 * canvas when entering via Formats only).
 */
export const MINI_ZINE_TEMPLATES_CATALOG: MiniZineTemplate[] = MINI_ZINE_TEMPLATES.filter(
  (t) => t.id !== "plain"
);

/** Full-zine layout templates (designed skins + placeholders). Empty until we ship SVG/React layouts. */
export type FullZineCatalogEntry = {
  id: string;
  format: "full";
  name: string;
  shortLabel: string;
  tagline?: string;
};

export const FULL_ZINE_TEMPLATES_CATALOG: FullZineCatalogEntry[] = [];

export type TemplateBrowserFilter = "all" | CanvasFormatKind;
