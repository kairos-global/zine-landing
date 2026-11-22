import type { PDFDocumentProxy } from "pdfjs-dist";
import { miniMaps, type ViewMap } from "./zine-view-map";

export type QrPlacement = { src: string; x: number; y: number; width: number };
export type PlacedQr = QrPlacement & { id: string };

export function pdfHasQrPlacement(url: string | null) {
  return new URLSearchParams(url?.split("#")[1]).get("zinemat-qr") === "1";
}

export function withQrPlacement(url: string) {
  const [base, hash] = url.split("#");
  const params = new URLSearchParams(hash);
  params.set("zinemat-qr", "1");
  return `${base}#${params}`;
}

export async function placeQrInPdf(pdf: PDFDocumentProxy, map: ViewMap, page: number, placement: QrPlacement) {
  const { PDFDocument, degrees } = await import("pdf-lib");
  const document = await PDFDocument.load(await pdf.getData());
  const qr = await document.embedPng(placement.src);
  const physicalPage = map === "pages" ? page : 1;
  const viewport = (await pdf.getPage(physicalPage)).getViewport({ scale: 1 });
  const panelWidth = viewport.width / (map === "pages" ? 1 : 4);
  const size = placement.width * panelWidth;
  let { x, y } = placement;
  x *= panelWidth;
  y *= viewport.height / (map === "pages" ? 1 : 2);
  let direction = 1;
  if (map !== "pages") {
    const slot = miniMaps[map].order.findIndex(number => number === page);
    const left = (slot % 4) * panelWidth;
    if (slot < 4) {
      x = left + panelWidth - x;
      y = viewport.height / 2 - y;
      direction = -1;
    } else {
      x += left;
      y += viewport.height / 2;
    }
  }
  const [left, bottom] = viewport.convertToPdfPoint(x, y + direction * size);
  const [right, endY] = viewport.convertToPdfPoint(x + direction * size, y + direction * size);
  const dimension = Math.hypot(right - left, endY - bottom);
  document.getPage(physicalPage - 1).drawImage(qr, {
    x: left,
    y: bottom,
    width: dimension,
    height: dimension,
    rotate: degrees(Math.atan2(endY - bottom, right - left) * 180 / Math.PI),
  });
  return new Blob([new Uint8Array(await document.save())], { type: "application/pdf" });
}
