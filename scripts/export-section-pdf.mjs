#!/usr/bin/env node
/**
 * Export a liturgy section as a multi-page PDF.
 *
 * Each original book page becomes one A4 leaf. The cream .book-page card
 * is screenshotted (no gray viewport) and scaled to fit centered on A4
 * while preserving aspect ratio. Uniform A4 size is required for print.
 *
 * Usage:
 *   node scripts/export-section-pdf.mjs [section-id]
 *   npm run export:introduction
 *
 * Default section: introduction-rite-of-preparation
 */

import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PDFDocument, rgb } from 'pdf-lib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PDF_DIR = path.join(ROOT, 'pdf');

/** ISO A4 portrait in PDF points (72 pt/inch). */
const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;

/** Small inset so content doesn't kiss the paper edge when printed. */
const A4_MARGIN_PT = 18;

/** Cream page background (matches --color-page-bg #fdfdf7). */
const PAGE_BG = rgb(253 / 255, 253 / 255, 247 / 255);

/** Section id → ordered list of page numbers (as they appear in the book). */
const SECTIONS = {
  'introduction-rite-of-preparation': {
    title: 'An introduction. The Rite of Preparation',
    outfile: 'introduction-rite-of-preparation.pdf',
    pages: [2, 3, 4, 5, 6, 8, 9, 10],
  },
  'liturgy-of-the-word': {
    title: 'The Liturgy of the Word',
    outfile: 'liturgy-of-the-word.pdf',
    pages: [
      12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
      28, 29, 30, 31, 32, 33, 34, 35, 36, 37,
    ],
  },
  'liturgy-of-the-faithful': {
    title: 'The Liturgy of the Faithful',
    outfile: 'liturgy-of-the-faithful.pdf',
    pages: [
      44, 45, 46, 47, 48, 49, 50, 51,
      54, 55, 56, 57, 58, 59,
      62, 63, 64, 65, 66, 68, 69, 70, 71, 72, 73,
      76, 77, 78, 79, 80, 81, 82, 83, 84,
      88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99,
    ],
  },
};

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

function pageFilename(n) {
  return `page-${String(n).padStart(3, '0')}.html`;
}

async function renderPageLeaf(browser, baseUrl, pageNum, exportCss) {
  const page = await browser.newPage({
    deviceScaleFactor: 2, // sharper text/images in the PDF
    viewport: { width: 900, height: 1600 },
  });
  const url = `${baseUrl}/pages/${pageFilename(pageNum)}`;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
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
    // Brief settle after fonts/images (Playwright has no waitForTimeout in some versions).
    await new Promise((r) => setTimeout(r, 250));

    const book = page.locator('.book-page').first();
    await book.waitFor({ state: 'visible' });
    const box = await book.boundingBox();
    if (!box || box.width < 10 || box.height < 10) {
      throw new Error(`Could not measure .book-page on ${pageFilename(pageNum)}`);
    }

    const pngBytes = await book.screenshot({ type: 'png', omitBackground: false });
    return {
      pageNum,
      pngBytes,
      widthPx: box.width,
      heightPx: box.height,
    };
  } finally {
    await page.close();
  }
}

async function mergeLeaves(leaves) {
  const out = await PDFDocument.create();
  const contentW = A4_WIDTH_PT - 2 * A4_MARGIN_PT;
  const contentH = A4_HEIGHT_PT - 2 * A4_MARGIN_PT;

  for (const leaf of leaves) {
    const png = await out.embedPng(leaf.pngBytes);
    const scale = Math.min(contentW / png.width, contentH / png.height);
    const drawW = png.width * scale;
    const drawH = png.height * scale;
    const x = (A4_WIDTH_PT - drawW) / 2;
    const y = (A4_HEIGHT_PT - drawH) / 2;

    const page = out.addPage([A4_WIDTH_PT, A4_HEIGHT_PT]);
    page.drawRectangle({
      x: 0,
      y: 0,
      width: A4_WIDTH_PT,
      height: A4_HEIGHT_PT,
      color: PAGE_BG,
    });
    page.drawImage(png, { x, y, width: drawW, height: drawH });
  }
  return out.save();
}

async function main() {
  const sectionId = process.argv[2] || 'introduction-rite-of-preparation';
  const section = SECTIONS[sectionId];
  if (!section) {
    console.error(`Unknown section "${sectionId}". Known: ${Object.keys(SECTIONS).join(', ')}`);
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
  console.log(`Exporting "${section.title}" (${section.pages.length} pages, A4)…`);

  const browser = await chromium.launch({ headless: true });
  try {
    const leaves = [];
    for (const n of section.pages) {
      process.stdout.write(`  page ${n}… `);
      const leaf = await renderPageLeaf(browser, baseUrl, n, exportCss);
      console.log(`${Math.round(leaf.widthPx)}×${Math.round(leaf.heightPx)}px`);
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
