// Where the eight pages actually land on the sheet.
//
// Fold a US Letter sheet in eight and the pages do not come out in reading
// order: page 1 is not the top-left panel, and four of the eight print upside
// down. A 4x2 grid filled 1..8 left to right looks like a print sheet and is
// not one — folded, it reads 1, 6, 3, 8, and half of it is upside down.
//
// So the sheet is never authored. Pages are made upright, in reading order, and
// this file is the arithmetic that puts them where the fold needs them.

export const SHEET = {
  /** Points, 72 to the inch. US Letter landscape. */
  width: 792,
  height: 612,
  cols: 4,
  rows: 2,
  pages: 8,
  paper: "US Letter, landscape",
} as const;

/** One printed panel: 2.75 x 4.25 inches. */
export const PANEL = {
  width: SHEET.width / SHEET.cols,
  height: SHEET.height / SHEET.rows,
} as const;

/** Panel aspect as a CSS ratio string, so a page preview is the shape it prints. */
export const PANEL_ASPECT = `${PANEL.width} / ${PANEL.height}`;

export interface Cell {
  /** 1-based page in reading order. Page 1 is the front cover. */
  page: number;
  col: number;
  row: number;
  /** True when the panel prints upside down, which is what the fold requires. */
  flipped: boolean;
}

/**
 * The page map, written out rather than computed.
 *
 * A formula would be shorter and would hide the one thing worth checking. Fold
 * a sheet in eight, number the panels, and this table is what you get:
 *
 *      col 0      col 1      col 2      col 3
 *   +----------+----------+----------+----------+
 *   |  7 (up   |  6 side  |  5 down) |  4       |  row 0  — prints upside down
 *   +----------+----------+----------+----------+
 *   |  8       |  1       |  2       |  3       |  row 1  — prints upright
 *   +----------+----------+----------+----------+
 *                 ^front cover
 */
export const CELLS: Cell[] = [
  { page: 1, col: 1, row: 1, flipped: false },
  { page: 2, col: 2, row: 1, flipped: false },
  { page: 3, col: 3, row: 1, flipped: false },
  { page: 4, col: 3, row: 0, flipped: true },
  { page: 5, col: 2, row: 0, flipped: true },
  { page: 6, col: 1, row: 0, flipped: true },
  { page: 7, col: 0, row: 0, flipped: true },
  { page: 8, col: 0, row: 1, flipped: false },
];

/**
 * The sheet in CSS-grid order — row-major, top-left first.
 *
 * A `grid-cols-4 grid-rows-2` fills itself this way, so rendering the real
 * sheet is a matter of mapping over this instead of over the pages in order.
 */
export const GRID_ORDER: Cell[] = [...CELLS].sort(
  (a, b) => a.row - b.row || a.col - b.col,
);

/** The cell a 1-based page number occupies. */
export function cellForPage(page: number): Cell {
  return CELLS[page - 1] ?? CELLS[0];
}

/** Top-left corner of a page's panel on the sheet, in points. */
export function panelOrigin(page: number): { x: number; y: number } {
  const cell = cellForPage(page);
  return { x: cell.col * PANEL.width, y: cell.row * PANEL.height };
}

/**
 * The creases and the one cut, as fractions of the sheet.
 *
 * The cut is a separate thing from the folds on purpose: it is the only line a
 * knife goes near, and a dashed "cut here" sitting among dashed "fold here"
 * lines is how people cut their zine in half. It runs along the horizontal
 * centre, across the middle two columns only.
 */
export const GUIDES = {
  folds: {
    vertical: [1 / 4, 2 / 4, 3 / 4],
    /** The horizontal crease, minus the span the cut takes over. */
    horizontalSegments: [
      { from: 0, to: 1 / 4 },
      { from: 3 / 4, to: 1 },
    ],
  },
  cut: { y: 1 / 2, from: 1 / 4, to: 3 / 4 },
} as const;

/** Reading-order labels, for page strips and checklists. */
export function pageLabel(page: number): string {
  if (page === 1) return "Front cover";
  if (page === SHEET.pages) return "Back cover";
  return `Page ${page}`;
}
