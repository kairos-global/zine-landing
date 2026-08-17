// Turning a canvas into the sheet that goes to the printer.
//
// The editor's Page view is the truth about content; this is the truth about
// paper. Everything here works in points so the PDF lands at exactly
// 11 x 8.5 inches and no printer offers to rescale it.

import { PDFDocument } from "pdf-lib";
import { GRID_ORDER, GUIDES, PANEL, SHEET } from "./zine-imposition";

export type Frame = "full" | "inset" | "portrait" | "split";
export type Page = { image: string; frame: Frame; frameSet: boolean };
export type TextLayer = { id: string; text: string; x: number; y: number; size: number };
export type CanvasState = { pages: Page[]; background: string; backgroundSet: boolean; texts: TextLayer[] };

export const freshState = (): CanvasState => ({
  pages: Array.from({ length: SHEET.pages }, () => ({ image: "", frame: "full" as Frame, frameSet: false })),
  background: "#FFF7D6",
  backgroundSet: false,
  texts: [],
});

/** The same stack the preview uses, so exported type matches what was placed. */
export const SHEET_FONT = "system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

/**
 * Frame padding, as fractions of the panel's WIDTH on all four sides.
 *
 * Not a typo: CSS resolves percentage padding against the containing block's
 * inline size even for top and bottom, so `py-[5%]` is 5% of the width. The
 * export has to make the same mistake as the browser or the two disagree.
 */
export const FRAME_INSETS: Record<Frame, { left: number; right: number; top: number; bottom: number }> = {
  full: { left: 0, right: 0, top: 0, bottom: 0 },
  inset: { left: 0.1, right: 0.1, top: 0.1, bottom: 0.1 },
  portrait: { left: 0.18, right: 0.18, top: 0.05, bottom: 0.05 },
  split: { left: 0, right: 0.28, top: 0, bottom: 0.15 },
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("An image on the canvas could not be read."));
    image.src = src;
  });
}

/** `object-fit: cover` — fill the box, crop the overflow, keep the centre. */
function coverRect(image: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / image.width, h / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  return { x: x + (w - drawWidth) / 2, y: y + (h - drawHeight) / 2, w: drawWidth, h: drawHeight };
}

export interface RenderOptions {
  /** 300 is where a home laser stops showing the raster. */
  dpi?: number;
  /** Fold creases and the cut line. Off for a finished print run. */
  guides?: boolean;
}

/**
 * The imposed sheet, drawn to a canvas.
 *
 * Panels are placed by the page map, and the four that the fold turns over are
 * drawn through a half-turn about their own centre. Type is deliberately NOT
 * turned: it is placed on the sheet, across panel boundaries, so it belongs to
 * the sheet's orientation rather than to any one page.
 */
export async function renderSheet(state: CanvasState, options: RenderOptions = {}): Promise<HTMLCanvasElement> {
  const dpi = options.dpi ?? 300;
  const scale = dpi / 72;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(SHEET.width * scale);
  canvas.height = Math.round(SHEET.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser would not give us a canvas to draw on.");

  ctx.scale(scale, scale);
  ctx.fillStyle = state.background || "#ffffff";
  ctx.fillRect(0, 0, SHEET.width, SHEET.height);

  for (const cell of GRID_ORDER) {
    const page = state.pages[cell.page - 1];
    if (!page?.image) continue;
    const image = await loadImage(page.image);

    const originX = cell.col * PANEL.width;
    const originY = cell.row * PANEL.height;

    ctx.save();
    ctx.beginPath();
    ctx.rect(originX, originY, PANEL.width, PANEL.height);
    ctx.clip();

    if (cell.flipped) {
      ctx.translate(originX + PANEL.width / 2, originY + PANEL.height / 2);
      ctx.rotate(Math.PI);
      ctx.translate(-(originX + PANEL.width / 2), -(originY + PANEL.height / 2));
    }

    const inset = FRAME_INSETS[page.frame] ?? FRAME_INSETS.full;
    const boxX = originX + inset.left * PANEL.width;
    const boxY = originY + inset.top * PANEL.width;
    const boxW = PANEL.width - (inset.left + inset.right) * PANEL.width;
    const boxH = PANEL.height - (inset.top + inset.bottom) * PANEL.width;

    const fit = coverRect(image, boxX, boxY, boxW, boxH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(boxX, boxY, boxW, boxH);
    ctx.clip();
    ctx.drawImage(image, fit.x, fit.y, fit.w, fit.h);
    ctx.restore();
    ctx.restore();
  }

  for (const layer of state.texts) {
    ctx.save();
    ctx.fillStyle = "#111111";
    ctx.font = `700 ${layer.size}px ${SHEET_FONT}`;
    ctx.textBaseline = "top";
    ctx.fillText(layer.text, (layer.x / 100) * SHEET.width, (layer.y / 100) * SHEET.height);
    ctx.restore();
  }

  if (options.guides) {
    ctx.save();
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 0.6;
    ctx.setLineDash([4, 4]);
    for (const fraction of GUIDES.folds.vertical) {
      const x = fraction * SHEET.width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, SHEET.height);
      ctx.stroke();
    }
    for (const segment of GUIDES.folds.horizontalSegments) {
      const y = GUIDES.cut.y * SHEET.height;
      ctx.beginPath();
      ctx.moveTo(segment.from * SHEET.width, y);
      ctx.lineTo(segment.to * SHEET.width, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    const cutY = GUIDES.cut.y * SHEET.height;
    ctx.beginPath();
    ctx.moveTo(GUIDES.cut.from * SHEET.width, cutY);
    ctx.lineTo(GUIDES.cut.to * SHEET.width, cutY);
    ctx.stroke();
    ctx.restore();
  }

  return canvas;
}

/** The sheet as a US Letter landscape PDF, at its true physical size. */
export async function sheetPdf(state: CanvasState, options: RenderOptions & { title?: string } = {}): Promise<Blob> {
  const canvas = await renderSheet(state, options);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.94);
  const bytes = Uint8Array.from(atob(dataUrl.split(",")[1]), character => character.charCodeAt(0));

  const pdf = await PDFDocument.create();
  const image = await pdf.embedJpg(bytes);
  const page = pdf.addPage([SHEET.width, SHEET.height]);
  page.drawImage(image, { x: 0, y: 0, width: SHEET.width, height: SHEET.height });
  if (options.title) pdf.setTitle(options.title);

  const saved = await pdf.save();
  return new Blob([saved as unknown as BlobPart], { type: "application/pdf" });
}
