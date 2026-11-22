import type { PDFDocumentProxy } from "pdfjs-dist";

export async function openZinePdf(source: string | File) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
  return pdfjs.getDocument(typeof source === "string"
    ? { url: source.split("#")[0] }
    : { data: new Uint8Array(await source.arrayBuffer()) });
}

export async function renderPdfPage(pdf: PDFDocumentProxy, number: number, maxSide = 1600) {
  const page = await pdf.getPage(number);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({
    scale: Math.min(4, maxSide / Math.max(base.width, base.height)),
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
  return { canvas, width: base.width, height: base.height };
}

export function canvasJpeg(canvas: HTMLCanvasElement, quality = 0.92) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error("Could not export the artwork."));
    }, "image/jpeg", quality);
  });
}
