#!/usr/bin/env node
/**
 * Export a liturgy section as a multi-page PDF.
 *
 * Each original book page becomes one A4 leaf. Chromium renders the cream
 * .book-page card to a *text-based* PDF (real fonts / selectable text),
 * scaled and centered on A4 while preserving aspect ratio. Uniform A4
 * size is required for print.
 *
 * Usage:
 *   node scripts/export-section-pdf.mjs [section-id]
 *   npm run export:introduction
 *   npm run export:appendices
 *   npm run export:all
 *
 * Default section: introduction-rite-of-preparation
 * Known ids: introduction-rite-of-preparation, liturgy-of-the-word,
 * liturgy-of-the-faithful, appendices, all
 */

import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { knownSectionIds, pageFilename, resolveExport } from './lib/sections.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PDF_DIR = path.join(ROOT, 'pdf');

/** ISO A4 portrait in PDF points (72 pt/inch). */
const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;

/** Small inset so content doesn't kiss the paper edge when printed. */
const A4_MARGIN_PT = 18;

/** CSS px per inch as used by Chromium's PDF layout. */
const CSS_DPI = 96;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
};

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        let filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
        if (!filePath.startsWith(ROOT) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        createReadStream(filePath).pipe(res);
      } catch (err) {
        res.writeHead(500);
        res.end(String(err));
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
    server.on('error', reject);
  });
}

/** Fit book card into the A4 content box (inside margins). */
function fitScale(widthPx, heightPx) {
  const contentWpx = ((A4_WIDTH_PT - 2 * A4_MARGIN_PT) / 72) * CSS_DPI;
  const contentHpx = ((A4_HEIGHT_PT - 2 * A4_MARGIN_PT) / 72) * CSS_DPI;
  const scale = Math.min(contentWpx / widthPx, contentHpx / heightPx, 1);
  return Math.max(0.1, Math.min(2, scale));
}

/**
 * Layout CSS so the book card is zoom-scaled and flex-centered on a full
 * A4 sheet. Chromium then prints at scale 1 with zero margins — text stays
 * vector/font-based, and leftover space is cream (same as the old png path).
 */
function layoutCss(scale) {
  const marginIn = A4_MARGIN_PT / 72;
  return `
@page {
  size: A4 portrait;
  margin: 0;
}
html, body {
  margin: 0 !important;
  padding: 0 !important;
  width: 210mm !important;
  height: 297mm !important;
  overflow: hidden !important;
  background: var(--color-page-bg, #fdfdf7) !important;
}
body {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  box-sizing: border-box !important;
  padding: ${marginIn}in !important;
}
body:has(.book-page) {
  zoom: 1 !important;
}
.book-page {
  margin: 0 !important;
  box-shadow: none !important;
  zoom: ${scale} !important;
  flex: 0 0 auto !important;
}
.page-number {
  display: none !important;
}
*, *::before, *::after {
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}
`;
}

async function renderPageLeaf(browser, baseUrl, pageNum, exportCss) {
  const page = await browser.newPage({
    viewport: { width: 900, height: 2000 },
  });
  const url = `${baseUrl}/pages/${pageFilename(pageNum)}`;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
    // Measure first with base export styles (no zoom), then re-apply with fit scale.
    await page.addStyleTag({ content: exportCss });
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      await Promise.all(
        [...document.images].map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                img.addEventListener('load', resolve, { once: true });
                img.addEventListener('error', resolve, { once: true });
              }),
        ),
      );
    });
    await new Promise((r) => setTimeout(r, 250));

    const book = page.locator('.book-page').first();
    await book.waitFor({ state: 'visible' });
    const box = await book.boundingBox();
    if (!box || box.width < 10 || box.height < 10) {
      throw new Error(`Could not measure .book-page on ${pageFilename(pageNum)}`);
    }

    const scale = fitScale(box.width, box.height);
    await page.addStyleTag({ content: layoutCss(scale) });

    // Text-based PDF: Chromium embeds real fonts / glyphs (selectable &
    // Acrobat-editable), unlike the previous screenshot → png pipeline.
    const pdfBytes = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      scale: 1,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      pageRanges: '1',
    });

    return {
      pageNum,
      pdfBytes,
      widthPx: box.width,
      heightPx: box.height,
      scale,
    };
  } finally {
    await page.close();
  }
}

async function mergeLeaves(leaves) {
  const out = await PDFDocument.create();
  for (const leaf of leaves) {
    const doc = await PDFDocument.load(leaf.pdfBytes);
    const pages = await out.copyPages(doc, doc.getPageIndices());
    for (const p of pages) out.addPage(p);
  }
  return out.save();
}

async function main() {
  const sectionId = process.argv[2] || 'introduction-rite-of-preparation';
  const section = resolveExport(sectionId, 'pdf');
  if (!section) {
    console.error(`Unknown section "${sectionId}". Known: ${knownSectionIds(true).join(', ')}`);
    process.exit(1);
  }

  for (const n of section.pages) {
    const file = path.join(ROOT, 'pages', pageFilename(n));
    if (!existsSync(file)) {
      console.error(`Missing page file: ${file}`);
      process.exit(1);
    }
  }

  const exportCss = await readFile(path.join(ROOT, 'css/print-export.css'), 'utf8');
  mkdirSync(PDF_DIR, { recursive: true });

  const { server, baseUrl } = await startStaticServer();
  console.log(`Serving ${ROOT} at ${baseUrl}`);
  console.log(`Exporting "${section.title}" (${section.pages.length} pages, A4, text PDF)…`);

  const browser = await chromium.launch({ headless: true });
  try {
    const leaves = [];
    for (const n of section.pages) {
      process.stdout.write(`  page ${n}… `);
      const leaf = await renderPageLeaf(browser, baseUrl, n, exportCss);
      console.log(
        `${Math.round(leaf.widthPx)}×${Math.round(leaf.heightPx)}px @ scale ${leaf.scale.toFixed(3)}`,
      );
      leaves.push(leaf);
    }

    const merged = await mergeLeaves(leaves);
    const outPath = path.join(PDF_DIR, section.outfile);
    await writeFile(outPath, merged);
    console.log(`Wrote ${outPath} (${leaves.length} pages)`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
