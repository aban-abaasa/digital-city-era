// The barcode sheet: a printable PDF of labels (name, bars, digits, price) that the cashier scans
// straight from the page instead of searching for the product. A4, three labels across,
// grouped by category. Bars are drawn as vector rectangles, so they stay sharp at any print size.

import { jsPDF } from 'jspdf';
import { barRuns, printableBarcode } from './barcodeSymbols.js';

const PAGE = { width: 210, height: 297, margin: 10, top: 24, bottom: 285 };
const COLUMNS = 3;
const GAP = 3;
const MODULE = 0.4; // mm per bar; a little over the 0.33 mm standard, which prints more forgivingly
const BAR_HEIGHT = 14;
const GUARD_EXTRA = 1.6;
const HEADING_HEIGHT = 9;

const ink = [15, 23, 42];
const muted = [100, 116, 139];
const line = [203, 213, 225];

// Standard PDF fonts only cover Latin-1; anything else would print as garbage
const clean = (value) => String(value ?? '').replace(/\xa0/g, ' ').replace(/[^\x20-\xFF]/g, '?').replace(/\s+/g, ' ').trim();

const defaultPrice = (value) => `UGX ${Math.round(Number(value) || 0).toLocaleString('en-US')}`;

// Guard bars (start, middle, end) run a little lower than the rest, as on retail packs
const guardRanges = (kind) => (kind === 'ean13' ? [[0, 3], [45, 50], [92, 95]] : [[0, 3], [31, 36], [64, 67]]);

const drawBars = (doc, symbol, x, y) => {
  const guards = guardRanges(symbol.kind);
  doc.setFillColor(0, 0, 0);
  barRuns(symbol.modules).forEach(([start, width]) => {
    const inGuard = guards.some(([from, to]) => start >= from && start < to);
    doc.rect(x + start * MODULE, y, width * MODULE, BAR_HEIGHT + (inGuard ? GUARD_EXTRA : 0), 'F');
  });
};

// The digits under the bars: EAN-13 shows the first digit left of the bars, then two groups of six
const drawDigits = (doc, symbol, x, y) => {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  const baseline = y + BAR_HEIGHT + 2.7;
  const group = (from, to, startModule, endModule) =>
    doc.text(symbol.digits.slice(from, to), x + ((startModule + endModule) / 2) * MODULE, baseline, { align: 'center', charSpace: 0.6 });
  if (symbol.kind === 'ean13') {
    doc.text(symbol.digits[0], x - 0.8, baseline, { align: 'right' });
    group(1, 7, 3, 45);
    group(7, 13, 50, 92);
  } else {
    group(0, 4, 3, 31);
    group(4, 8, 36, 64);
  }
};

const fitLines = (doc, text, width, maxLines) => {
  const lines = doc.splitTextToSize(text, width);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 1 && doc.getTextWidth(`${last}…`) > width) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last.trimEnd()}...`;
  return kept;
};

const drawLabel = (doc, x, y, width, height, item, options, placements) => {
  const { product, symbol } = item;
  doc.setDrawColor(...line);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, width, height, 1.5, 1.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...ink);
  fitLines(doc, clean(product.name) || 'Product', width - 5, 2).forEach((text, i) => doc.text(text, x + 2.5, y + 4.4 + i * 3.6));

  const barsWidth = symbol.modules.length * MODULE;
  const barsX = x + (width - barsWidth) / 2 + (symbol.kind === 'ean13' ? 1.2 : 0);
  const barsY = y + 10.5;
  drawBars(doc, symbol, barsX, barsY);
  drawDigits(doc, symbol, barsX, barsY);
  placements.push({
    digits: symbol.digits,
    kind: symbol.kind,
    page: doc.getCurrentPageInfo().pageNumber,
    x: barsX, y: barsY, width: barsWidth, height: BAR_HEIGHT
  });

  if (options.includePrice) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...ink);
    doc.text(clean(options.formatPrice(product.selling_price)), x + width / 2, y + height - 3.6, { align: 'center' });
  }
};

const byName = (a, b) => clean(a.product.name).localeCompare(clean(b.product.name), undefined, { sensitivity: 'base' });

const groupItems = (items, categories, groupByCategory) => {
  if (!groupByCategory) return [{ title: '', items: [...items].sort(byName) }];
  const names = new Map((categories || []).map((category) => [category.id, clean(category.name)]));
  const groups = new Map();
  items.forEach((item) => {
    const title = names.get(item.product.category_id) || 'Other products';
    if (!groups.has(title)) groups.set(title, []);
    groups.get(title).push(item);
  });
  return [...groups.entries()]
    .sort(([a], [b]) => (a === 'Other products') - (b === 'Other products') || a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .map(([title, list]) => ({ title, items: list.sort(byName) }));
};

const drawPageFrame = (doc, { storeName, date, pages }) => {
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...ink);
    doc.text('Product barcodes', PAGE.margin, 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.text([clean(storeName), date].filter(Boolean).join('  ·  '), PAGE.width - PAGE.margin, 13, { align: 'right' });
    doc.setDrawColor(...line);
    doc.setLineWidth(0.3);
    doc.line(PAGE.margin, 16.5, PAGE.width - PAGE.margin, 16.5);
    if (page === 1) doc.text('Point the scanner at a label to add the item to the sale. No searching.', PAGE.margin, 21.5);
    doc.text('Keep labels flat and clean; replace any that are creased or faded.', PAGE.margin, 291);
    doc.text(`Page ${page} of ${pages}`, PAGE.width - PAGE.margin, 291, { align: 'right' });
  }
};

// Builds the sheet. Products whose barcode can't be drawn (text codes, wrong check digit) are
// listed in `skipped` rather than printed wrongly. `placements` says where every barcode sits
// on its page (mm), which is also how the tests check the bars can be read back.
export const buildBarcodeSheet = ({
  products,
  categories = [],
  storeName = '',
  includePrice = true,
  groupByCategory = true,
  formatPrice = defaultPrice,
  now = new Date()
}) => {
  const items = [];
  const skipped = [];
  (products || []).forEach((product) => {
    const symbol = printableBarcode(product.barcode);
    if (symbol) items.push({ product, symbol });
    else skipped.push(product);
  });

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const placements = [];
  const options = { includePrice, formatPrice };
  const labelWidth = (PAGE.width - 2 * PAGE.margin - (COLUMNS - 1) * GAP) / COLUMNS;
  const labelHeight = includePrice ? 38 : 33;

  let y = PAGE.top;
  const newPage = () => { doc.addPage(); y = PAGE.top; };
  const room = (needed) => y + needed <= PAGE.bottom;

  groupItems(items, categories, groupByCategory).forEach((group) => {
    // A heading is never left alone at the bottom of a page
    const drawHeading = (title) => {
      if (!room(HEADING_HEIGHT + labelHeight)) newPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...ink);
      doc.text(title, PAGE.margin, y + 5);
      doc.setDrawColor(...ink);
      doc.setLineWidth(0.4);
      doc.line(PAGE.margin, y + 6.8, PAGE.width - PAGE.margin, y + 6.8);
      y += HEADING_HEIGHT;
    };

    if (group.title) drawHeading(`${group.title}  (${group.items.length})`);
    group.items.forEach((item, index) => {
      const column = index % COLUMNS;
      if (column === 0 && index > 0) y += labelHeight + GAP;
      if (!room(labelHeight)) {
        newPage();
        if (group.title) drawHeading(`${group.title} (continued)`);
      }
      drawLabel(doc, PAGE.margin + column * (labelWidth + GAP), y, labelWidth, labelHeight, item, options, placements);
    });
    y += labelHeight + GAP + 2;
  });

  if (items.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...muted);
    doc.text('No printable barcodes to show.', PAGE.margin, PAGE.top + 6);
  }

  const pages = doc.getNumberOfPages();
  drawPageFrame(doc, { storeName, date: now.toISOString().slice(0, 10), pages });

  return { doc, printed: items.length, skipped, pages, placements };
};

export const barcodeSheetFilename = (storeName, now = new Date()) => {
  const slug = clean(storeName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `barcodes${slug ? `-${slug}` : ''}-${now.toISOString().slice(0, 10)}.pdf`;
};

export const downloadBarcodeSheet = (options) => {
  const sheet = buildBarcodeSheet(options);
  sheet.doc.save(barcodeSheetFilename(options.storeName, options.now));
  return sheet;
};

// Opens the sheet in a new tab, ready to print
export const openBarcodeSheet = (options) => {
  const sheet = buildBarcodeSheet(options);
  window.open(sheet.doc.output('bloburl'), '_blank');
  return sheet;
};
