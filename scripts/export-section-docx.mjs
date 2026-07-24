#!/usr/bin/env node
/**
 * Export a liturgy section as a layout-approximating DOCX.
 *
 * Multi-column HTML grids become Word tables; images become gray stubs
 * labeled with the asset filename (no binary images embedded).
 *
 * Usage:
 *   node scripts/export-section-docx.mjs [section-id]
 *   npm run export:docx:introduction
 *   npm run export:docx:all
 *
 * Default section: introduction-rite-of-preparation
 */

import { existsSync, mkdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { Document, Packer, PageNumber, Paragraph, TextRun, Footer, AlignmentType } from 'docx';
import { convertBookPage } from './lib/html-to-docx.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOCX_DIR = path.join(ROOT, 'docx');

/** Same section map as the PDF exporter. */
const SECTIONS = {
  'introduction-rite-of-preparation': {
    title: 'An introduction. The Rite of Preparation',
    outfile: 'introduction-rite-of-preparation.docx',
    pages: [2, 3, 4, 5, 6, 8, 9, 10],
  },
  'liturgy-of-the-word': {
    title: 'The Liturgy of the Word',
    outfile: 'liturgy-of-the-word.docx',
    pages: [
      12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
      28, 29, 30, 31, 32, 33, 34, 35, 36, 37,
    ],
  },
  'liturgy-of-the-faithful': {
    title: 'The Liturgy of the Faithful',
    outfile: 'liturgy-of-the-faithful.docx',
    pages: [
      44, 45, 46, 47, 48, 49, 50, 51,
      54, 55, 56, 57, 58, 59,
      62, 63, 64, 65, 66, 68, 69, 70, 71, 72, 73,
      76, 77, 78, 79, 80, 81, 82, 83, 84,
      88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99,
    ],
  },
};

/** Book order for the combined export. */
const ALL_SECTION_IDS = [
  'introduction-rite-of-preparation',
  'liturgy-of-the-word',
  'liturgy-of-the-faithful',
];

function resolveExport(sectionId) {
  if (sectionId === 'all') {
    return {
      title: 'Study of Divine Liturgy',
      outfile: 'study-of-divine-liturgy.docx',
      pages: ALL_SECTION_IDS.flatMap((id) => SECTIONS[id].pages),
    };
  }
  return SECTIONS[sectionId] || null;
}

function pageFilename(n) {
  return `page-${String(n).padStart(3, '0')}.html`;
}

async function loadBookPage(pageNum) {
  const file = path.join(ROOT, 'pages', pageFilename(pageNum));
  const html = await readFile(file, 'utf8');
  const $ = cheerio.load(html);
  const pageEl = $('.book-page').get(0);
  if (!pageEl) {
    throw new Error(`No .book-page in ${file}`);
  }
  return { $, pageEl, pageNum };
}

async function main() {
  const sectionId = process.argv[2] || 'introduction-rite-of-preparation';
  const section = resolveExport(sectionId);
  if (!section) {
    console.error(
      `Unknown section "${sectionId}". Known: ${[...Object.keys(SECTIONS), 'all'].join(', ')}`,
    );
    process.exit(1);
  }

  for (const n of section.pages) {
    const file = path.join(ROOT, 'pages', pageFilename(n));
    if (!existsSync(file)) {
      console.error(`Missing page file: ${file}`);
      process.exit(1);
    }
  }

  mkdirSync(DOCX_DIR, { recursive: true });
  console.log(`Exporting DOCX "${section.title}" (${section.pages.length} pages)…`);

  const children = [];
  for (let i = 0; i < section.pages.length; i++) {
    const n = section.pages[i];
    process.stdout.write(`  page ${n}… `);
    const { $, pageEl } = await loadBookPage(n);
    const blocks = convertBookPage($, pageEl, { pageBreakBefore: i > 0 });
    console.log(`${blocks.length} blocks`);
    children.push(...blocks);
  }

  const doc = new Document({
    creator: 'Divine Liturgy HTML → DOCX',
    title: section.title,
    description: 'Layout-approximating export from the static HTML edition (images as filename stubs).',
    styles: {
      default: {
        document: {
          run: { font: 'Georgia', size: 20 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            // A4
            size: { width: 11906, height: 16838 },
            margin: {
              top: 720, // 0.5"
              right: 850,
              bottom: 720,
              left: 850,
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: 'Georgia',
                    size: 16,
                    color: '666666',
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outPath = path.join(DOCX_DIR, section.outfile);
  await writeFile(outPath, buffer);
  console.log(`Wrote ${outPath} (${Math.round(buffer.length / 1024)} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
