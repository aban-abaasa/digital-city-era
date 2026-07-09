// Shared CSV / Excel / PDF import & export helpers for bulk product upload
// features (Admin Inventory panel, Order Inventory - POS control, etc).
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import inventoryService from '../services/inventorySupabaseService';

// new URL(..., import.meta.url) — rather than a plain `?url` import — is the
// pattern Vite's import analysis reliably picks up for bundler-agnostic
// worker resolution in both dev and production builds.
GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;

export const SUPPORTED_IMPORT_EXTENSIONS = ['csv', 'xlsx', 'xls', 'pdf'];

const normalizeKey = (key) => String(key).toLowerCase().trim().replace(/\s+/g, '_');

// Parses a CSV file (handles quoted fields) into an array of lowercase-keyed row objects
const parseCSV = (text) => {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];

  const parseLine = (line) => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);
    return values.map(v => v.trim());
  };

  const headers = parseLine(lines[0]).map(normalizeKey);
  return lines.slice(1).map(line => {
    const values = parseLine(line);
    const row = {};
    headers.forEach((header, i) => { row[header] = (values[i] ?? '').trim(); });
    return row;
  });
};

// Parses an Excel workbook (.xlsx/.xls), reading its first sheet
const parseExcel = async (file) => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return json.map(row => {
    const normalized = {};
    Object.entries(row).forEach(([key, value]) => {
      normalized[normalizeKey(key)] = String(value).trim();
    });
    return normalized;
  });
};

// Races a promise against a timeout so a hang surfaces as a clear error
// instead of leaving the caller stuck waiting forever.
const withTimeout = (promise, ms, message) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

// Scanned/image-heavy PDFs can have dozens of pages with no extractable text
// at all; capping this keeps a bad upload fast-failing instead of grinding
// through every page before giving up. Text-only extraction is cheap even
// for a large multi-page report, so this is generous.
const MAX_PDF_PAGES = 200;

// Text runs on the same visual row often have tiny y-offset jitter (mixed
// fonts, kerning, subscript-ish glyphs) — an exact Math.round() bucket
// fragments a single row into several one-cell "lines" whenever items straddle
// a rounding boundary. Grouping by proximity instead keeps a real row intact.
const Y_TOLERANCE = 3;

const buildLine = (items) => {
  let line = '';
  let lastX = null;
  items.sort((a, b) => a.transform[4] - b.transform[4]).forEach(item => {
    const x = item.transform[4];
    if (lastX !== null && x - lastX > 10) {
      line += '\t'; // heuristic column break on a wide horizontal gap
    } else if (line && !line.endsWith(' ') && !item.str.startsWith(' ')) {
      line += ' ';
    }
    line += item.str;
    lastX = x + (item.width || 0);
  });
  return line;
};

const extractPdfLines = async (pdf) => {
  const lines = [];
  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    // PDF y-coordinates increase upward; sort top-to-bottom, then group
    // consecutive items into a row while their y stays within tolerance.
    const sortedItems = [...content.items].sort((a, b) => b.transform[5] - a.transform[5]);

    let currentY = null;
    let currentItems = [];
    sortedItems.forEach(item => {
      const y = item.transform[5];
      if (currentY === null || Math.abs(currentY - y) > Y_TOLERANCE) {
        if (currentItems.length > 0) {
          const line = buildLine(currentItems);
          if (line.trim()) lines.push(line);
        }
        currentItems = [];
        currentY = y;
      }
      currentItems.push(item);
    });
    if (currentItems.length > 0) {
      const line = buildLine(currentItems);
      if (line.trim()) lines.push(line);
    }
  }

  return lines;
};

// Many real-world "stock summary" style reports (common export from
// legacy POS/inventory systems) render each line as tightly space-packed
// text with no wide gaps at all — e.g. "070001 BROADWAY CRUMBLE CAKE
// PIECES 6.00" — so the x-gap column-break heuristic above never fires
// anywhere in the document. Rather than try to reconstruct arbitrary
// columns from spacing, match this specific and very common shape
// directly: <numeric code> <name...> <unit word> <decimal quantity>.
// Trailing columns (unit cost, total value, reorder level, etc.) are
// allowed and ignored rather than required to be absent — anchoring the
// match on "quantity is the last thing on the line" is what caused most
// rows of a report with cost/value columns to be silently dropped.
const STOCK_REPORT_LINE = /^(\d{3,})\s+(.+?)\s+([A-Za-z]+)\s+([\d,]+(?:\.\d+)?)(?:\s+.*)?$/;

// Fallback shape for reports with no separate unit-word column:
// <numeric code> <name...> <decimal quantity> [more columns].
const STOCK_REPORT_LINE_NO_UNIT = /^(\d{3,})\s+(.+?)\s+([\d,]+(?:\.\d+)?)(?:\s+.*)?$/;

// Non-matching lines (letterhead, print date, repeated page headers, page
// numbers) are expected and simply skipped rather than counted as failed
// rows — but if only a small fraction of lines match, that's a sign the
// pattern doesn't actually fit this report, not that most lines are noise.
const parseAsStockReport = (lines) => {
  const withUnit = [];
  const withoutUnit = [];
  const unmatchedSample = [];

  lines.forEach(line => {
    const matchWithUnit = line.match(STOCK_REPORT_LINE);
    if (matchWithUnit) {
      const [, code, name, unit, quantity] = matchWithUnit;
      withUnit.push({ sku: code, name: name.trim(), unit, initial_stock: quantity.replace(/,/g, '') });
      return;
    }
    const matchNoUnit = line.match(STOCK_REPORT_LINE_NO_UNIT);
    if (matchNoUnit) {
      const [, code, name, quantity] = matchNoUnit;
      withoutUnit.push({ sku: code, name: name.trim(), initial_stock: quantity.replace(/,/g, '') });
      return;
    }
    if (unmatchedSample.length < 15) unmatchedSample.push(line);
  });

  // Prefer whichever variant actually explains more of the document —
  // a report either consistently has a unit column or consistently doesn't.
  const rows = withUnit.length >= withoutUnit.length ? withUnit : withoutUnit;
  return { rows, unmatchedSample };
};

// Words that plausibly appear in a real column header, used to find the
// actual header row rather than assuming it's line 1 — reports commonly lead
// with a title, company letterhead, or print date before the data table.
const HEADER_HINT_KEYWORDS = ['name', 'item', 'description', 'product', 'title', 'sku', 'barcode', 'code', 'price', 'cost', 'qty', 'quantity', 'stock', 'category'];

const looksLikeHeaderRow = (cells) => {
  if (cells.length < 2) return false; // a real table header has multiple columns
  return cells.some(cell => {
    const key = normalizeKey(cell);
    return HEADER_HINT_KEYWORDS.some(keyword => key.includes(keyword));
  });
};

// Best-effort table extraction from a PDF: groups text runs into rows by
// y-position and into columns by x-gaps. Works reliably for simple, clean
// tables (like the ones this app's own "Export as PDF" produces) but isn't
// a general-purpose PDF table parser — scanned/image PDFs or complex,
// multi-column layouts may not extract cleanly. The whole operation is
// capped by a single timeout since text extraction (not just document
// loading) can hang on malformed or image-based PDFs.
const parsePDF = (file) => withTimeout((async () => {
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const lines = await extractPdfLines(pdf);
  console.log(`[parsePDF] extracted ${lines.length} line(s); first 15:`, lines.slice(0, 15));

  if (lines.length === 0) return [];

  const { rows: stockReportRows, unmatchedSample } = parseAsStockReport(lines);
  const matchRatio = stockReportRows.length / lines.length;
  console.log(`[parsePDF] stock-report pattern matched ${stockReportRows.length}/${lines.length} line(s) (${Math.round(matchRatio * 100)}%)`);

  // Only commit to the stock-report interpretation when it explains most of
  // the document. A handful of matches out of hundreds of lines means the
  // pattern coincidentally fit a few rows, not that the rest are letterhead —
  // falling through to the generic parser (or at least surfacing the
  // mismatch) avoids silently importing 2% of the file.
  if (stockReportRows.length > 0 && matchRatio >= 0.5) {
    return stockReportRows;
  }
  if (unmatchedSample.length > 0) {
    console.warn('[parsePDF] stock-report pattern only matched a minority of lines; sample of unmatched lines:', unmatchedSample);
  }

  const splitRow = (line) => line.split('\t').map(v => v.trim());
  const rows = lines.map(splitRow);

  // Skip any preamble (title, letterhead, print date, page numbers) before
  // the first row that actually looks like a multi-column table header.
  const headerIndex = rows.findIndex(looksLikeHeaderRow);
  if (headerIndex === -1) {
    if (stockReportRows.length > 0) {
      // Better a partial import than none — but this is a strong signal the
      // stock-report pattern needs adjusting for this report's exact layout.
      console.warn(`[parsePDF] falling back to ${stockReportRows.length} partial stock-report match(es); most lines did not match either parser`);
      return stockReportRows;
    }
    console.warn('[parsePDF] no row looked like a table header — none had 2+ columns with a recognizable keyword');
    return [];
  }
  console.log(`[parsePDF] using row ${headerIndex} as header:`, rows[headerIndex]);

  const headers = rows[headerIndex].map(normalizeKey);
  const genericRows = rows.slice(headerIndex + 1).map(values => {
    const row = {};
    headers.forEach((header, i) => { row[header] = (values[i] ?? '').trim(); });
    return row;
  });

  // Whichever approach actually captured more of the document wins.
  return genericRows.length >= stockReportRows.length ? genericRows : stockReportRows;
})(), 30000, 'Timed out reading the PDF — it may be too large, scanned/image-based, or the background worker failed to start');

export const parseProductFile = async (file) => {
  const ext = file.name.toLowerCase().split('.').pop();
  if (ext === 'csv') return parseCSV(await file.text());
  if (ext === 'xlsx' || ext === 'xls') return parseExcel(file);
  if (ext === 'pdf') return parsePDF(file);
  throw new Error(`Unsupported file type ".${ext}". Please upload a .csv, .xlsx, .xls, or .pdf file`);
};

// Header names that plausibly hold the product name/description, checked in
// order. Real-world documents (especially PDFs this app didn't generate)
// often label this column "Item" or "Description" rather than "Name".
const NAME_KEYS = ['name', 'product_name', 'product', 'item', 'item_name', 'description', 'title'];
const resolveRowName = (row) => {
  for (const key of NAME_KEYS) {
    if (row[key]) return row[key];
  }
  return null;
};

// Bulk-creates products via inventoryService.createProduct (same path the
// single "Add Product" form uses), resolving/creating categories by name.
export const bulkImportProductRows = async (rows) => {
  if (rows.length > 0) {
    // Diagnostic breadcrumb: if a lot of rows fail, check the console for
    // this to see exactly what the parser extracted as headers/first row —
    // it usually reveals a header-name mismatch or a bad file structure.
    console.log('[bulkImportProductRows] detected headers:', Object.keys(rows[0]));
    console.log('[bulkImportProductRows] sample row:', rows[0]);
  }

  const categories = await inventoryService.getCategories();
  const categoryMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));

  let created = 0;
  let failed = 0;

  for (const row of rows) {
    const name = resolveRowName(row);
    if (!name) { failed++; continue; }

    let category_id;
    const categoryName = row.category;
    if (categoryName) {
      const key = categoryName.toLowerCase();
      if (categoryMap.has(key)) {
        category_id = categoryMap.get(key);
      } else {
        try {
          const newCategory = await inventoryService.createCategory({ name: categoryName, is_active: true });
          categoryMap.set(key, newCategory.id);
          category_id = newCategory.id;
        } catch {
          // Fall back to no category rather than failing the whole row
        }
      }
    }

    try {
      await inventoryService.createProduct({
        name,
        sku: row.sku,
        barcode: row.barcode,
        description: row.description,
        category_id,
        brand: row.brand,
        cost_price: row.cost_price || row.cost,
        selling_price: row.selling_price || row.price,
        tax_rate: row.tax_rate,
        initial_stock: row.initial_stock || row.stock || row.quantity,
        minimum_stock: row.minimum_stock || row.min_stock,
        maximum_stock: row.maximum_stock || row.max_stock,
        reorder_point: row.reorder_point,
        location: row.location,
        warehouse: row.warehouse
      });
      created++;
    } catch (err) {
      console.error('Bulk import row failed:', name, err);
      failed++;
    }
  }

  return { created, failed };
};

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const TEMPLATE_ROWS = [
  { name: 'Sugar - 1kg', sku: '', barcode: '', category: 'Groceries', brand: 'Kakira', cost_price: 3000, selling_price: 3500, initial_stock: 50, minimum_stock: 10, location: 'Main Storage' }
];

// PDF isn't offered as a template format — filling in PDF cells by hand
// isn't practical, unlike CSV/Excel.
export const downloadProductTemplate = (format) => {
  if (format === 'xlsx') {
    const worksheet = XLSX.utils.json_to_sheet(TEMPLATE_ROWS);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
    XLSX.writeFile(workbook, 'inventory_upload_template.xlsx');
    return;
  }
  const headers = Object.keys(TEMPLATE_ROWS[0]);
  const csv = [headers.join(','), headers.map(h => TEMPLATE_ROWS[0][h]).join(',')].join('\n');
  downloadBlob(new Blob([csv], { type: 'text/csv' }), 'inventory_upload_template.csv');
};

// Exports an already-shaped array of plain row objects (caller decides which
// product fields/labels to include) to CSV, Excel, or PDF.
export const exportRowsToFile = (rows, format, baseFilename = 'inventory_export') => {
  if (rows.length === 0) return false;

  if (format === 'xlsx') {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');
    XLSX.writeFile(workbook, `${baseFilename}.xlsx`);
    return true;
  }

  if (format === 'pdf') {
    const headers = Object.keys(rows[0]);
    const doc = new jsPDF({ orientation: headers.length > 6 ? 'landscape' : 'portrait' });
    doc.setFontSize(14);
    doc.text('Inventory Export', 14, 15);
    doc.autoTable({
      startY: 20,
      head: [headers.map(h => h.replace(/_/g, ' '))],
      body: rows.map(row => headers.map(h => row[h] ?? '')),
      styles: { fontSize: 8 }
    });
    doc.save(`${baseFilename}.pdf`);
    return true;
  }

  const headers = Object.keys(rows[0]);
  const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(h => escapeCsv(row[h])).join(','))
  ].join('\n');
  downloadBlob(new Blob([csv], { type: 'text/csv' }), `${baseFilename}.csv`);
  return true;
};
