import type { CSSProperties } from "react";

export type MiniZineTemplateId =
  | "plain"
  | "photo"
  | "art"
  | "catalog"
  | "menu"
  | "recipe"
  | "event";

export interface MiniZineTemplate {
  id: MiniZineTemplateId;
  name: string;
  shortLabel: string;
  /** Optional line under the title on the picker card (like secondary meta, not a rating). */
  tagline?: string;
  /** Per logical page index 0–7 (matches `index` on UploadImage / images[]). */
  slotStyle: (pageIndex: number) => CSSProperties;
}

// ─── helpers ────────────────────────────────────────────────────────────────

/** Encode an SVG string as a CSS url() data URI. */
const svgUrl = (svg: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

/** Combine multiple CSS background layers. Pass parallel image/size arrays. */
const layers = (images: string[], sizes: string[]): CSSProperties => ({
  backgroundImage: images.join(", "),
  backgroundSize: sizes.join(", "),
  backgroundRepeat: "no-repeat",
  backgroundPosition: "0 0",
});

/** Single background layer helper. */
const layer = (image: string, size = "100% 100%"): CSSProperties => ({
  backgroundImage: image,
  backgroundSize: size,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "0 0",
});

// ─── 1. Photo Zine — "Sequence" ─────────────────────────────────────────────
// Warm silver tones. Corner bracket guides on every panel.
// Cover: title zone at bottom. Back: slim credit strip.

const PHOTO_BG = "#f5f3ef";

const photoBrackets = svgUrl(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>
    <path d='M4 16 L4 4 L16 4'   fill='none' stroke='rgba(110,90,65,0.28)' stroke-width='1.4'/>
    <path d='M84 4 L96 4 L96 16' fill='none' stroke='rgba(110,90,65,0.28)' stroke-width='1.4'/>
    <path d='M4 84 L4 96 L16 96' fill='none' stroke='rgba(110,90,65,0.28)' stroke-width='1.4'/>
    <path d='M84 96 L96 96 L96 84' fill='none' stroke='rgba(110,90,65,0.28)' stroke-width='1.4'/>
  </svg>`
);

function photoSlotStyle(pageIndex: number): CSSProperties {
  const base = { backgroundColor: PHOTO_BG };

  if (pageIndex === 0) {
    // Front cover: image fills top 74%, title zone below
    return {
      ...base,
      ...layers(
        [
          `linear-gradient(to bottom, transparent 74%, rgba(224,216,202,0.92) 74%)`,
          photoBrackets,
        ],
        ["100% 100%", "100% 100%"]
      ),
    };
  }

  if (pageIndex === 7) {
    // Back cover: slim credit strip at bottom 14%
    return {
      ...base,
      ...layers(
        [
          `linear-gradient(to bottom, transparent 86%, rgba(224,216,202,0.75) 86%)`,
          photoBrackets,
        ],
        ["100% 100%", "100% 100%"]
      ),
    };
  }

  // Interior pages: open full-bleed with corner guides
  return { ...base, ...layer(photoBrackets) };
}

// ─── 2. Art Zine — "Studio" ─────────────────────────────────────────────────
// Gallery white. Cover: artist/title zone at bottom 30%.
// Interior: caption strip at bottom 18%. Back: colophon zone bottom 45%.

const ART_BG = "#fefefe";

const artCaptionSvg = svgUrl(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>
    <line x1='6' y1='82' x2='94' y2='82' stroke='rgba(90,90,90,0.18)' stroke-width='0.7'/>
  </svg>`
);

const artColophonSvg = svgUrl(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>
    <line x1='6' y1='55' x2='94' y2='55' stroke='rgba(90,90,90,0.18)' stroke-width='0.7'/>
    <line x1='6' y1='68' x2='60' y2='68' stroke='rgba(90,90,90,0.12)' stroke-width='0.5'/>
    <line x1='6' y1='76' x2='80' y2='76' stroke='rgba(90,90,90,0.12)' stroke-width='0.5'/>
    <line x1='6' y1='84' x2='50' y2='84' stroke='rgba(90,90,90,0.12)' stroke-width='0.5'/>
  </svg>`
);

function artSlotStyle(pageIndex: number): CSSProperties {
  const base = { backgroundColor: ART_BG };

  if (pageIndex === 0) {
    // Cover: large image area + bottom artist/title zone
    return {
      ...base,
      ...layers(
        [
          `linear-gradient(to bottom, transparent 70%, rgba(246,242,234,0.95) 70%)`,
          svgUrl(
            `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>
              <line x1='6' y1='70' x2='94' y2='70' stroke='rgba(90,90,90,0.2)' stroke-width='0.7'/>
            </svg>`
          ),
        ],
        ["100% 100%", "100% 100%"]
      ),
    };
  }

  if (pageIndex === 1) {
    // Page 1: statement / medium page — top accent bar, fully open
    return {
      ...base,
      ...layer(
        `linear-gradient(to bottom, rgba(230,224,212,0.55) 0%, rgba(230,224,212,0.55) 5px, transparent 5px)`,
        "100% 100%"
      ),
    };
  }

  if (pageIndex === 7) {
    // Back: colophon zone
    return {
      ...base,
      ...layers(
        [
          `linear-gradient(to bottom, transparent 55%, rgba(246,242,234,0.85) 55%)`,
          artColophonSvg,
        ],
        ["100% 100%", "100% 100%"]
      ),
    };
  }

  // Interior pages 2–6: caption strip at bottom 18%
  return {
    ...base,
    ...layers(
      [
        `linear-gradient(to bottom, transparent 82%, rgba(246,242,234,0.9) 82%)`,
        artCaptionSvg,
      ],
      ["100% 100%", "100% 100%"]
    ),
  };
}

// ─── 3. Product Catalog — "Showroom" ────────────────────────────────────────
// Airy warm off-white. Every interior panel: top 62% image zone, bottom 38%
// label/price zone separated by a thin rule + dashed placeholder lines.

const CATALOG_BG = "#fafaf8";

const catalogSplitSvg = svgUrl(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>
    <line x1='0'  y1='62' x2='100' y2='62' stroke='rgba(130,120,105,0.28)' stroke-width='0.8'/>
    <line x1='6'  y1='73' x2='94'  y2='73' stroke='rgba(130,120,105,0.15)' stroke-width='0.5' stroke-dasharray='3 3'/>
    <line x1='6'  y1='83' x2='70'  y2='83' stroke='rgba(130,120,105,0.15)' stroke-width='0.5' stroke-dasharray='3 3'/>
    <line x1='6'  y1='91' x2='50'  y2='91' stroke='rgba(130,120,105,0.12)' stroke-width='0.4' stroke-dasharray='2 4'/>
  </svg>`
);

const catalogCoverSvg = svgUrl(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>
    <rect x='10' y='22' width='80' height='56' fill='none' stroke='rgba(130,120,105,0.2)' stroke-width='0.7'/>
    <line x1='10' y1='55' x2='90' y2='55' stroke='rgba(130,120,105,0.15)' stroke-width='0.5'/>
  </svg>`
);

function catalogSlotStyle(pageIndex: number): CSSProperties {
  const base = { backgroundColor: CATALOG_BG };

  if (pageIndex === 0) {
    // Cover: centered brand zone
    return {
      ...base,
      ...layers(
        [
          `linear-gradient(to bottom, transparent 22%, rgba(238,234,226,0.45) 22%, rgba(238,234,226,0.45) 78%, transparent 78%)`,
          catalogCoverSvg,
        ],
        ["100% 100%", "100% 100%"]
      ),
    };
  }

  if (pageIndex === 7) {
    // Back: URL / order / location zone at bottom
    return {
      ...base,
      ...layer(
        `linear-gradient(to bottom, transparent 62%, rgba(238,234,226,0.88) 62%)`,
        "100% 100%"
      ),
    };
  }

  // Interior: image zone + label zone
  return {
    ...base,
    ...layers(
      [
        `linear-gradient(to bottom, transparent 62%, rgba(238,234,226,0.82) 62%)`,
        catalogSplitSvg,
      ],
      ["100% 100%", "100% 100%"]
    ),
  };
}

// ─── 4. Menu Zine — "Mise en Place" ─────────────────────────────────────────
// Warm paper tone. Interior panels: section-header band at top, ruled lines
// below for item names. Cover: double-rule border + restaurant name zone.

const MENU_BG = "#fdf8ef";

const menuRuledSvg = svgUrl(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>
    <line x1='5' y1='27' x2='95' y2='27' stroke='rgba(155,125,75,0.2)'  stroke-width='0.6'/>
    <line x1='5' y1='38' x2='95' y2='38' stroke='rgba(155,125,75,0.2)'  stroke-width='0.6'/>
    <line x1='5' y1='49' x2='95' y2='49' stroke='rgba(155,125,75,0.18)' stroke-width='0.5'/>
    <line x1='5' y1='60' x2='95' y2='60' stroke='rgba(155,125,75,0.18)' stroke-width='0.5'/>
    <line x1='5' y1='71' x2='95' y2='71' stroke='rgba(155,125,75,0.18)' stroke-width='0.5'/>
    <line x1='5' y1='82' x2='95' y2='82' stroke='rgba(155,125,75,0.18)' stroke-width='0.5'/>
    <line x1='5' y1='93' x2='95' y2='93' stroke='rgba(155,125,75,0.15)' stroke-width='0.4'/>
  </svg>`
);

const menuCoverSvg = svgUrl(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>
    <rect x='5'  y='5'  width='90' height='90' fill='none' stroke='rgba(155,125,75,0.28)' stroke-width='0.9'/>
    <rect x='9'  y='9'  width='82' height='82' fill='none' stroke='rgba(155,125,75,0.14)' stroke-width='0.4'/>
    <line x1='10' y1='32' x2='90' y2='32' stroke='rgba(155,125,75,0.22)' stroke-width='0.6'/>
    <line x1='10' y1='68' x2='90' y2='68' stroke='rgba(155,125,75,0.22)' stroke-width='0.6'/>
  </svg>`
);

const menuBackSvg = svgUrl(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>
    <line x1='10' y1='38' x2='90' y2='38' stroke='rgba(155,125,75,0.22)' stroke-width='0.6'/>
    <line x1='10' y1='54' x2='90' y2='54' stroke='rgba(155,125,75,0.18)' stroke-width='0.5'/>
    <line x1='10' y1='68' x2='90' y2='68' stroke='rgba(155,125,75,0.18)' stroke-width='0.5'/>
    <line x1='10' y1='82' x2='90' y2='82' stroke='rgba(155,125,75,0.15)' stroke-width='0.4'/>
  </svg>`
);

function menuSlotStyle(pageIndex: number): CSSProperties {
  const base = { backgroundColor: MENU_BG };

  if (pageIndex === 0) {
    // Cover: ornate double-rule border, name zone in center
    return {
      ...base,
      ...layers(
        [
          `linear-gradient(to bottom, rgba(250,240,215,0.7) 0%, rgba(250,240,215,0.7) 100%)`,
          menuCoverSvg,
        ],
        ["100% 100%", "100% 100%"]
      ),
    };
  }

  if (pageIndex === 7) {
    // Back: hours / dietary / contact info rows
    return {
      ...base,
      ...layers(
        [
          `linear-gradient(to bottom, rgba(250,240,215,0.5) 0%, rgba(250,240,215,0.5) 100%)`,
          menuBackSvg,
        ],
        ["100% 100%", "100% 100%"]
      ),
    };
  }

  // Interior: section header band (top 17%) + ruled lines for item rows
  return {
    ...base,
    ...layers(
      [
        `linear-gradient(to bottom, rgba(245,228,188,0.7) 0%, rgba(245,228,188,0.7) 17%, transparent 17%)`,
        menuRuledSvg,
      ],
      ["100% 100%", "100% 100%"]
    ),
  };
}

// ─── 5. Recipe Zine — "Kitchen Notes" ───────────────────────────────────────
// Aged paper. Interior panels: left 38% = ingredients column (short ruled lines),
// right 62% = steps column (ruled lines), vertical divider. Cover: title band.
// Back: notes area + dashed QR placeholder circle.

const RECIPE_BG = "#faf7f0";

const recipeTwoColSvg = svgUrl(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>
    <line x1='38' y1='14' x2='38' y2='96' stroke='rgba(135,105,65,0.22)' stroke-width='0.7'/>
    <line x1='4'  y1='24' x2='34' y2='24' stroke='rgba(135,105,65,0.2)'  stroke-width='0.5'/>
    <line x1='4'  y1='33' x2='34' y2='33' stroke='rgba(135,105,65,0.2)'  stroke-width='0.5'/>
    <line x1='4'  y1='42' x2='34' y2='42' stroke='rgba(135,105,65,0.2)'  stroke-width='0.5'/>
    <line x1='4'  y1='51' x2='34' y2='51' stroke='rgba(135,105,65,0.18)' stroke-width='0.4'/>
    <line x1='4'  y1='60' x2='34' y2='60' stroke='rgba(135,105,65,0.18)' stroke-width='0.4'/>
    <line x1='4'  y1='69' x2='34' y2='69' stroke='rgba(135,105,65,0.18)' stroke-width='0.4'/>
    <line x1='4'  y1='78' x2='34' y2='78' stroke='rgba(135,105,65,0.18)' stroke-width='0.4'/>
    <line x1='4'  y1='87' x2='34' y2='87' stroke='rgba(135,105,65,0.15)' stroke-width='0.4'/>
    <line x1='42' y1='28' x2='96' y2='28' stroke='rgba(135,105,65,0.15)' stroke-width='0.4'/>
    <line x1='42' y1='37' x2='96' y2='37' stroke='rgba(135,105,65,0.15)' stroke-width='0.4'/>
    <line x1='42' y1='46' x2='96' y2='46' stroke='rgba(135,105,65,0.15)' stroke-width='0.4'/>
    <line x1='42' y1='55' x2='96' y2='55' stroke='rgba(135,105,65,0.15)' stroke-width='0.4'/>
    <line x1='42' y1='64' x2='96' y2='64' stroke='rgba(135,105,65,0.15)' stroke-width='0.4'/>
    <line x1='42' y1='73' x2='96' y2='73' stroke='rgba(135,105,65,0.15)' stroke-width='0.4'/>
    <line x1='42' y1='82' x2='96' y2='82' stroke='rgba(135,105,65,0.15)' stroke-width='0.4'/>
    <line x1='42' y1='91' x2='96' y2='91' stroke='rgba(135,105,65,0.12)' stroke-width='0.4'/>
  </svg>`
);

const recipeBackSvg = svgUrl(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>
    <line x1='5' y1='32' x2='95' y2='32' stroke='rgba(135,105,65,0.22)' stroke-width='0.6'/>
    <line x1='5' y1='44' x2='95' y2='44' stroke='rgba(135,105,65,0.18)' stroke-width='0.5'/>
    <line x1='5' y1='56' x2='95' y2='56' stroke='rgba(135,105,65,0.18)' stroke-width='0.5'/>
    <circle cx='75' cy='80' r='12' fill='none' stroke='rgba(135,105,65,0.22)' stroke-width='0.6' stroke-dasharray='2.5 2'/>
  </svg>`
);

function recipeSlotStyle(pageIndex: number): CSSProperties {
  const base = { backgroundColor: RECIPE_BG };

  if (pageIndex === 0) {
    // Cover: title band + subtitle zone
    return {
      ...base,
      ...layers(
        [
          `linear-gradient(to bottom, transparent 16%, rgba(236,222,196,0.55) 16%, rgba(236,222,196,0.55) 62%, transparent 62%)`,
          svgUrl(
            `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>
              <line x1='12' y1='16' x2='88' y2='16' stroke='rgba(135,105,65,0.28)' stroke-width='0.7'/>
              <line x1='12' y1='62' x2='88' y2='62' stroke='rgba(135,105,65,0.28)' stroke-width='0.7'/>
            </svg>`
          ),
        ],
        ["100% 100%", "100% 100%"]
      ),
    };
  }

  if (pageIndex === 7) {
    // Back: notes lines + QR circle placeholder
    return { ...base, ...layer(recipeBackSvg) };
  }

  // Interior: header bar top 13% + two-column layout
  return {
    ...base,
    ...layers(
      [
        `linear-gradient(to bottom, rgba(236,222,196,0.55) 0%, rgba(236,222,196,0.55) 13%, transparent 13%)`,
        recipeTwoColSvg,
      ],
      ["100% 100%", "100% 100%"]
    ),
  };
}

// ─── 6. Event Zine — "Program" ───────────────────────────────────────────────
// Cool blue-white. Cover: bold bands top/bottom, center identity box.
// Interior: dark header band + time-block row dividers + left time-margin strip.
// Back: info/thanks zone with a divider.

const EVENT_BG = "#f8f9fb";

const eventTimeBlockSvg = svgUrl(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>
    <rect x='0' y='0' width='11' height='100' fill='rgba(95,105,125,0.07)'/>
    <line x1='0'  y1='26' x2='100' y2='26' stroke='rgba(95,105,125,0.2)'  stroke-width='0.7'/>
    <line x1='0'  y1='47' x2='100' y2='47' stroke='rgba(95,105,125,0.16)' stroke-width='0.5'/>
    <line x1='0'  y1='68' x2='100' y2='68' stroke='rgba(95,105,125,0.16)' stroke-width='0.5'/>
    <line x1='0'  y1='89' x2='100' y2='89' stroke='rgba(95,105,125,0.14)' stroke-width='0.4'/>
  </svg>`
);

const eventCoverSvg = svgUrl(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>
    <rect x='0'  y='0'  width='100' height='14' fill='rgba(95,105,125,0.18)'/>
    <rect x='8'  y='24' width='84'  height='52' fill='none' stroke='rgba(95,105,125,0.22)' stroke-width='0.7'/>
    <rect x='0'  y='86' width='100' height='14' fill='rgba(95,105,125,0.12)'/>
  </svg>`
);

const eventBackSvg = svgUrl(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>
    <line x1='0'  y1='50' x2='100' y2='50' stroke='rgba(95,105,125,0.22)' stroke-width='0.7'/>
    <line x1='6'  y1='64' x2='94'  y2='64' stroke='rgba(95,105,125,0.15)' stroke-width='0.5'/>
    <line x1='6'  y1='76' x2='94'  y2='76' stroke='rgba(95,105,125,0.15)' stroke-width='0.5'/>
    <line x1='6'  y1='88' x2='60'  y2='88' stroke='rgba(95,105,125,0.12)' stroke-width='0.4'/>
  </svg>`
);

function eventSlotStyle(pageIndex: number): CSSProperties {
  const base = { backgroundColor: EVENT_BG };

  if (pageIndex === 0) {
    // Cover: top/bottom bands + center identity box
    return {
      ...base,
      ...layers(
        [
          `linear-gradient(to bottom, rgba(220,225,235,0.65) 0%, rgba(220,225,235,0.65) 100%)`,
          eventCoverSvg,
        ],
        ["100% 100%", "100% 100%"]
      ),
    };
  }

  if (pageIndex === 7) {
    // Back: tickets / QR / thanks zone
    return {
      ...base,
      ...layers(
        [
          `linear-gradient(to bottom, transparent 50%, rgba(220,225,235,0.7) 50%)`,
          eventBackSvg,
        ],
        ["100% 100%", "100% 100%"]
      ),
    };
  }

  // Interior: header band top 13% + schedule time-block rows
  return {
    ...base,
    ...layers(
      [
        `linear-gradient(to bottom, rgba(95,105,125,0.14) 0%, rgba(95,105,125,0.14) 13%, transparent 13%)`,
        eventTimeBlockSvg,
      ],
      ["100% 100%", "100% 100%"]
    ),
  };
}

// ─── Plain (blank default) ───────────────────────────────────────────────────

const plain: CSSProperties = { backgroundColor: "#e5e7eb" };

// ─── Template registry ───────────────────────────────────────────────────────

export const MINI_ZINE_TEMPLATES: MiniZineTemplate[] = [
  {
    id: "plain",
    name: "Plain",
    shortLabel: "Neutral gray panels",
    tagline: "Clean starting point for any layout.",
    slotStyle: () => plain,
  },
  {
    id: "photo",
    name: "Photo Zine",
    shortLabel: "Sequence of images",
    tagline: "Corner frame guides, cover title zone, back credit strip.",
    slotStyle: photoSlotStyle,
  },
  {
    id: "art",
    name: "Art Zine",
    shortLabel: "Work & statement",
    tagline: "Gallery-clean panels with caption strips and an artist zone on the cover.",
    slotStyle: artSlotStyle,
  },
  {
    id: "catalog",
    name: "Product Catalog",
    shortLabel: "Image + label grid",
    tagline: "Each panel splits into an image zone and a name/price zone.",
    slotStyle: catalogSlotStyle,
  },
  {
    id: "menu",
    name: "Menu",
    shortLabel: "Sections & items",
    tagline: "Section header band at top, ruled lines for item names and prices.",
    slotStyle: menuSlotStyle,
  },
  {
    id: "recipe",
    name: "Recipe Zine",
    shortLabel: "Ingredients + steps",
    tagline: "Two-column layout — ingredients left, method right, back has a QR spot.",
    slotStyle: recipeSlotStyle,
  },
  {
    id: "event",
    name: "Event Program",
    shortLabel: "Schedule & identity",
    tagline: "Bold header band, time-block rows for interior, info zone on the back.",
    slotStyle: eventSlotStyle,
  },
];

export const DEFAULT_MINI_TEMPLATE_ID: MiniZineTemplateId = "plain";

export function getMiniTemplateById(id: MiniZineTemplateId): MiniZineTemplate {
  return MINI_ZINE_TEMPLATES.find((t) => t.id === id) ?? MINI_ZINE_TEMPLATES[0];
}
