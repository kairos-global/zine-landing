export const miniMaps = {
  "mini-center": { label: "Cover in slot 2", order: [7, 6, 5, 4, 8, 1, 2, 3] },
  "mini-right": { label: "Cover in slot 4", order: [5, 4, 3, 2, 6, 7, 8, 1] },
} as const;

export type MiniMap = keyof typeof miniMaps;
export type ViewMap = "pages" | MiniMap;
export const miniMapIds = Object.keys(miniMaps) as MiniMap[];
export const LETTER_WIDTH = 792;
export const LETTER_HEIGHT = 612;

export function isMiniSheet(pages: number, width: number, height: number) {
  return pages === 1 && width > height &&
    Math.abs(width / height / (LETTER_WIDTH / LETTER_HEIGHT) - 1) < 0.02;
}

export function mapFromPdfUrl(url: string): ViewMap | null {
  const value = new URLSearchParams(url.split("#")[1]).get("zinemat-view");
  return value === "pages" || value === "mini-center" || value === "mini-right" ? value : null;
}

export function withViewMap(url: string, map: ViewMap) {
  return `${url.split("#")[0]}#zinemat-view=${map}`;
}

export function miniPanel(source: HTMLCanvasElement, map: MiniMap, page: number) {
  const slot = miniMaps[map].order.findIndex(number => number === page);
  const col = slot % 4;
  const row = Math.floor(slot / 4);
  const x = Math.round(source.width * col / 4);
  const y = Math.round(source.height * row / 2);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(source.width * (col + 1) / 4) - x;
  canvas.height = Math.round(source.height * (row + 1) / 2) - y;
  const context = canvas.getContext("2d")!;
  if (row === 0) {
    context.translate(canvas.width, canvas.height);
    context.rotate(Math.PI);
  }
  context.drawImage(source, x, y, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  return canvas;
}
