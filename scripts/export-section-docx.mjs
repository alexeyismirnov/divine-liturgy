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
 *   npm run export:docx:appendices
 *   npm run export:docx:all
 *
 * Default section: introduction-rite-of-preparation
 * Known ids: introduction-rite-of-preparation, liturgy-of-the-word,
 * liturgy-of-the-faithful, appendices, all
 */

import { existsSync, mkdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { Document, Packer, PageNumber, Paragraph, TextRun, Footer, AlignmentType } from 'docx';
import {
  collectPageFootnotes,
  convertBookPage,
  createFootnoteState,
  footnotesForDocument,
} from './lib/html-to-docx.mjs';
import { knownSectionIds, pageFilename, resolveExport } from './lib/sections.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOCX_DIR = path.join(ROOT, 'docx');

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
  const section = resolveExport(sectionId, 'docx');
  if (!section) {
    console.error(
      `Unknown section "${sectionId}". Known: ${knownSectionIds(true).join(', ')}`,
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

  const footnoteState = createFootnoteState();
  const loadedPages = [];
  for (const n of section.pages) {
    const loaded = await loadBookPage(n);
    collectPageFootnotes(loaded.$, loaded.pageEl, footnoteState);
    loadedPages.push(loaded);
  }

  const children = [];
  for (let i = 0; i < loadedPages.length; i++) {
    const { $, pageEl, pageNum } = loadedPages[i];
    process.stdout.write(`  page ${pageNum}… `);
    const blocks = convertBookPage($, pageEl, { pageBreakBefore: i > 0 });
    console.log(`${blocks.length} blocks`);
    children.push(...blocks);
  }

  const footnotes = footnotesForDocument(footnoteState);
  const footnoteCount = Object.keys(footnotes).length;
  if (footnoteCount) {
    console.log(`  footnotes: ${footnoteCount} (${[...footnoteState.byId.keys()].sort((a, b) => a - b).join(', ')})`);
  }

  const doc = new Document({
    creator: 'Divine Liturgy HTML → DOCX',
    title: section.title,
    description: 'Layout-approximating export from the static HTML edition (images as filename stubs).',
    footnotes,
    styles: {
      default: {
        document: {
          run: { font: 'Georgia', size: 20 },
        },
        footnoteText: {
          run: { font: 'Georgia', size: 18 },
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
