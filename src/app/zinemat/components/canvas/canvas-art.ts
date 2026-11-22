import type { PlacedQr } from "@/lib/zine-qr-placement";
import { canvasJpeg } from "@/lib/zine-pdf";
import { LETTER_HEIGHT, LETTER_WIDTH, miniMaps, miniPanel } from "@/lib/zine-view-map";
import type { ZineFormat } from "../interactivity/BasicsSection";

export type Frame = "full" | "inset" | "portrait" | "split";
export type TextLayer = { id: string; text: string; x: number; y: number; size: number; color?: string };
export type LayerBox = { x: number; y: number; w: number; h: number };
export type ArtworkLayer = LayerBox & { id: string } & (
  | { kind: "image"; src: string; name: string; fit: "cover" | "contain" }
  | { kind: "text"; text: string; color?: string; size: number; bold?: boolean; legacy?: boolean }
);
export type CanvasPage = {
  image: string;
  frame: Frame;
  texts?: TextLayer[];
  background?: string;
  layers?: ArtworkLayer[];
  qrCodes?: PlacedQr[];
};
export type CanvasState = {
  pages: CanvasPage[];
  background: string;
  texts: TextLayer[];
  halfLetterPages?: number;
};

export const frames: { id: Frame; label: string; bounds: [number, number, number, number] }[] = [
  { id: "full", label: "Full bleed", bounds: [0, 0, 1, 1] },
  { id: "inset", label: "Gallery", bounds: [0.1, 0.1, 0.8, 0.8] },
  { id: "portrait", label: "Portrait", bounds: [0.18, 0.05, 0.64, 0.9] },
  { id: "split", label: "Offset", bounds: [0, 0, 0.72, 0.85] },
];

export const emptyPage = (): CanvasPage => ({ image: "", frame: "full", texts: [] });
export const newCanvas = (): CanvasState => ({
  pages: Array.from({ length: 8 }, emptyPage),
  background: "#FFF7D6",
  texts: [],
});

export function frameBox(frame: Frame): LayerBox {
  const [x, y, w, h] = (frames.find(candidate => candidate.id === frame) ?? frames[0]).bounds;
  return { x: x * 100, y: y * 100, w: w * 100, h: h * 100 };
}

export function artworkLayers(page: CanvasPage): ArtworkLayer[] {
  if (page.layers) return page.layers;
  const image: ArtworkLayer[] = page.image ? [
    { id: "page-image", kind: "image", src: page.image, name: "Image", fit: "cover", ...frameBox(page.frame) },
  ] : [];
  return [...image, ...page.texts?.map(layer => ({
    ...layer, kind: "text" as const, w: 100 - layer.x, h: 100 - layer.y, bold: true, legacy: true,
  })) ?? []];
}

export function pageHasArtwork(page: CanvasPage | undefined) {
  return Boolean(page && artworkLayers(page).some(layer => layer.kind === "image" || layer.text.trim()));
}

export function layerName(layer: ArtworkLayer) {
  return layer.kind === "image" ? layer.name : layer.text.trim().split("\n")[0] || "Text";
}

export function pageCount(state: CanvasState, format: ZineFormat) {
  return format === "mini" ? 8 : state.halfLetterPages ?? 8;
}

export function canvasHasArtwork(state: CanvasState, format: ZineFormat) {
  return (format === "mini" && state.texts.some(layer => layer.text.trim())) ||
    state.pages.slice(0, pageCount(state, format)).some(pageHasArtwork);
}

function createSurface(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

const images = new Map<string, Promise<HTMLImageElement>>();

function loadImage(src: string) {
  const cached = images.get(src);
  if (cached) return cached;
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("This image couldn’t open."));
    image.src = src;
  });
  if (!src.startsWith("blob:")) {
    const oldest = images.keys().next().value;
    if (oldest && images.size >= 32) images.delete(oldest);
    images.set(src, pending);
    void pending.catch(() => { if (images.get(src) === pending) images.delete(src); });
  }
  return pending;
}

export async function importCanvasImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
    const canvas = createSurface(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)));
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawText(context: CanvasRenderingContext2D, layers: TextLayer[], width: number, height: number) {
  context.textBaseline = "top";
  for (const layer of layers) {
    const fontSize = layer.size * width / 550;
    context.font = `bold ${fontSize}px Arial, sans-serif`;
    context.fillStyle = layer.color ?? "#171717";
    const x = layer.x * width / 100;
    const y = layer.y * height / 100;
    layer.text.split("\n").forEach((line, index) => {
      context.fillText(line, x, y + index * fontSize * 1.15, width - x);
    });
  }
}

function wrapText(context: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (context.measureText(next).width <= width) {
        line = next;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      for (const character of word) {
        if (line && context.measureText(line + character).width > width) {
          lines.push(line);
          line = "";
        }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function renderArtwork(
  state: CanvasState,
  format: ZineFormat,
  index: number,
  width: number,
  sheet = false
) {
  const dimensions = sheet ? [LETTER_WIDTH, LETTER_HEIGHT] : format === "mini"
    ? [LETTER_WIDTH / 4, LETTER_HEIGHT / 2]
    : [LETTER_HEIGHT, LETTER_WIDTH];
  const canvas = createSurface(width, Math.round(width * dimensions[1] / dimensions[0]));
  const context = canvas.getContext("2d")!;
  context.fillStyle = state.background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (sheet) {
    const panels = await Promise.all(miniMaps["mini-center"].order.map((number, slot) => {
      const start = Math.round(slot % 4 * width / 4);
      return renderArtwork(state, "mini", number - 1, Math.round((slot % 4 + 1) * width / 4) - start);
    }));
    panels.forEach((panel, slot) => {
      const x = Math.round(slot % 4 * width / 4);
      const y = slot < 4 ? 0 : Math.round(canvas.height / 2);
      const height = slot < 4 ? Math.round(canvas.height / 2) : canvas.height - y;
      context.save();
      if (slot < 4) {
        context.translate(x + panel.width, height);
        context.rotate(Math.PI);
        context.drawImage(panel, 0, 0, panel.width, height);
      } else {
        context.drawImage(panel, x, y, panel.width, height);
      }
      context.restore();
    });
    drawText(context, state.texts, canvas.width, canvas.height);
    return canvas;
  }

  const page = state.pages[index];
  const layers = page ? artworkLayers(page) : [];
  if (page?.background) {
    context.fillStyle = page.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  const decoded = await Promise.all(layers.map(layer => layer.kind === "image" ? loadImage(layer.src) : null));
  layers.forEach((layer, index) => {
    const x = layer.x * canvas.width / 100;
    const y = layer.y * canvas.height / 100;
    const w = layer.w * canvas.width / 100;
    const h = layer.h * canvas.height / 100;
    context.save();
    context.beginPath();
    context.rect(x, y, w, h);
    context.clip();
    const image = decoded[index];
    if (layer.kind === "image" && image) {
      const fit = layer.fit === "cover" ? Math.max : Math.min;
      const scale = fit(w / image.width, h / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      context.drawImage(image, x + (w - width) / 2, y + (h - height) / 2, width, height);
    } else if (layer.kind === "text") {
      if (layer.legacy) drawText(context, [layer], canvas.width, canvas.height);
      else {
        const size = layer.size * canvas.width / 550;
        context.font = `${layer.bold ? 700 : 400} ${size}px Arial, sans-serif`;
        context.fillStyle = layer.color || "#171717";
        context.textBaseline = "top";
        wrapText(context, layer.text, w).forEach((line, index) => context.fillText(line, x, y + index * size * 1.2));
      }
    }
    context.restore();
  });
  for (const code of page?.qrCodes ?? []) {
    const image = await loadImage(code.src);
    const size = code.width * canvas.width;
    context.save();
    context.imageSmoothingEnabled = false;
    context.drawImage(image, code.x * canvas.width, code.y * canvas.height, size, size);
    context.restore();
  }
  return canvas;
}

export async function exportArtwork(state: CanvasState, format: ZineFormat) {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const mini = format === "mini";
  let cover: Blob | undefined;
  for (let index = 0; index < (mini ? 1 : pageCount(state, format)); index++) {
    const artwork = await renderArtwork(state, format, index, mini ? 2376 : 1836, mini);
    const jpeg = await canvasJpeg(artwork);
    if (index === 0) cover = mini ? await canvasJpeg(miniPanel(artwork, "mini-center", 1)) : jpeg;
    const image = await pdf.embedJpg(await jpeg.arrayBuffer());
    const [width, height] = mini ? [LETTER_WIDTH, LETTER_HEIGHT] : [LETTER_HEIGHT, LETTER_WIDTH];
    pdf.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
  }
  return {
    cover: cover!,
    pdf: new Blob([new Uint8Array(await pdf.save())], { type: "application/pdf" }),
  };
}
