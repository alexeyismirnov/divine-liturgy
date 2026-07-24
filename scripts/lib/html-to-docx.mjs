/**
 * HTML book-page → layout-approximating DOCX elements.
 *
 * Strategy:
 *  - Multi-column CSS grids → Word tables (divider tracks omitted)
 *  - Floated figure + text → 2-col table (image stub | text)
 *  - <img> → gray shaded stub with basename of src
 *  - Decorative dividers / SVG → skipped
 *  - Speakers / cues / prayers keep approximate colors & emphasis
 */

import path from 'node:path';
import {
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';

/** Usable content width in DXA (A4 @ ~0.6" side margins). */
export const CONTENT_WIDTH_DXA = 10206;

/** Leave a little room inside a parent cell so nested tables don't overflow. */
const CELL_INSET_DXA = 120;

const COLORS = {
  heading: '1A1A2E',
  text: '1D1D20',
  priest: '7A1F24',
  prayer: '1F2A6B',
  emphasis: '1F6B3A',
  cueSilent: 'B8732E',
  cueAloud: '2E9D57',
  cueRed: 'D63344',
  cueBlue: '3A5FDE',
  boxBorder: '4A3A76',
  boxBg: 'F1EAD0',
  pageBg: 'FDFDF7',
  questionBorder: '6F9C80',
  questionHeader: '2F6A45',
  stubBg: 'CFCFCF',
  stubBorder: '8A8A8A',
  stubText: '444444',
  outlineBg: 'F7F3E8',
};

const NO_BORDER = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

const THIN = (color) => ({ style: BorderStyle.SINGLE, size: 8, color });

/** Known multi-col recipes: class regex → fr weights for content columns only. */
const GRID_RECIPES = [
  { test: /remembrance-layout/, fr: [3.4, 0.85] },
  { test: /preface-grid-hymn-2col/, fr: [0.7, 1.3] },
  { test: /preface-grid-two-col/, fr: [1.2, 0.8] },
  { test: /preface-grid-two-titles|epiclesis-grid/, fr: [0.3, 1, 1] },
  { test: /preface-grid-hymn\b/, fr: [1, 1, 0.55] },
  { test: /preface-grid\b/, fr: [0.9, 2.5, 0.85] },
  { test: /commentary-grid/, fr: [0.55, 1.45] },
  { test: /bottom-split/, fr: [1.05, 1] },
  { test: /liturgy-outline/, fr: [0.22, 0.78] },
  { test: /scripture-pair/, fr: [1, 1] },
];

function classOf(el) {
  if (!el || el.type !== 'tag') return '';
  const c = el.attribs?.class;
  return typeof c === 'string' ? c : '';
}

function hasClass(el, name) {
  return new RegExp(`(?:^|\\s)${name}(?:\\s|$)`).test(classOf(el));
}

function isDivider(el) {
  const c = classOf(el);
  return (
    el.name === 'svg' ||
    /\bvdivider\b/.test(c) ||
    /\bhdivider\b/.test(c) ||
    /\blead-diamond\b/.test(c)
  );
}

function isSkipped(el) {
  if (!el || el.type !== 'tag') return true;
  if (el.name === 'script' || el.name === 'style' || el.name === 'br') return true;
  if (isDivider(el)) return true;
  if (hasClass(el, 'page-number')) return true;
  // Decorative-only nodes marked aria-hidden that aren't meaningful content wrappers.
  if (el.attribs?.['aria-hidden'] === 'true' && isDivider(el)) return true;
  return false;
}

function frToDxa(frs, total = CONTENT_WIDTH_DXA) {
  const sum = frs.reduce((a, b) => a + b, 0) || 1;
  const raw = frs.map((f) => Math.floor((total * f) / sum));
  const used = raw.reduce((a, b) => a + b, 0);
  if (raw.length) raw[raw.length - 1] += total - used;
  return raw;
}

function nestWidth(parentWidth) {
  return Math.max(200, parentWidth - CELL_INSET_DXA);
}

function widthsForGrid(className, colCount, totalWidth = CONTENT_WIDTH_DXA) {
  for (const recipe of GRID_RECIPES) {
    if (recipe.test.test(className) && recipe.fr.length === colCount) {
      return frToDxa(recipe.fr, totalWidth);
    }
  }
  // Image-ish side column heuristic: last/first child often ~210–300px ≈ 26–35%.
  if (colCount === 2) return frToDxa([1.7, 1], totalWidth);
  if (colCount === 3) return frToDxa([1, 1.6, 1], totalWidth);
  return frToDxa(Array(colCount).fill(1), totalWidth);
}

function isGridContainer(el) {
  const c = classOf(el);
  if (!c) return false;
  // These are bordered single-column blocks, even when a page class
  // mentions "grid" (e.g. page-047-questions-in-grid = placement in a parent grid).
  if (hasClass(el, 'question-box') || hasClass(el, 'liturgical-box')) return false;

  if (
    /\b(preface-grid|remembrance-layout|commentary-grid|bottom-split|liturgy-outline|epiclesis-grid)\b/.test(
      c,
    )
  ) {
    return true;
  }

  // Match layout tokens like "page-010-opening-grid", but not placement
  // modifiers like "questions-in-grid" (child of a grid, not a grid itself).
  const tokens = c.split(/\s+/).filter(Boolean);
  if (tokens.some((t) => /-grid$/.test(t) && !/-in-grid$/.test(t))) return true;
  if (tokens.some((t) => /-pair$/.test(t))) return true;
  return false;
}

function floatSideFromClass(c) {
  if (/\bfigure-right\b|\bpullout-right\b|-right\b/.test(c)) return 'right';
  if (/\bfigure-left\b|\bpullout-left\b|-left\b/.test(c)) return 'left';
  // Common page-local float wrappers (image / altar / icon in the name → often left).
  if (/synagogue|altar|icon|christ-|image/.test(c)) return 'left';
  if (/last-supper|ascension|figure/.test(c)) return 'right';
  return null;
}

function contentChildren($, el) {
  return $(el)
    .children()
    .toArray()
    .filter((child) => child.type === 'tag' && !isSkipped(child));
}

function decodeText(text) {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ');
}

function cueColor(className) {
  if (/\bcue-red\b/.test(className)) return COLORS.cueRed;
  if (/\bcue-blue\b/.test(className)) return COLORS.cueBlue;
  if (/\bcue-green\b|\bcue-aloud\b/.test(className)) return COLORS.cueAloud;
  if (/\bcue-brown\b|\bcue-silent\b/.test(className)) return COLORS.cueSilent;
  return COLORS.cueSilent;
}

/**
 * Convert an inline/phrasing subtree into TextRun[].
 */
function convertInlines($, node, base = {}) {
  const runs = [];

  const walk = (n, style) => {
    if (!n) return;
    if (n.type === 'text') {
      const t = decodeText(n.data || '');
      if (!t) return;
      // Preserve intentional leading/trailing spaces from mixed markup lightly.
      const text = t;
      if (!text.trim() && text.length === 0) return;
      runs.push(
        new TextRun({
          text,
          font: 'Georgia',
          size: style.size ?? 20, // 10pt
          bold: style.bold || false,
          italics: style.italics || false,
          color: style.color || COLORS.text,
          superScript: style.superScript || false,
          smallCaps: style.smallCaps || false,
        }),
      );
      return;
    }
    if (n.type !== 'tag') return;
    if (n.name === 'br') {
      runs.push(new TextRun({ break: 1 }));
      return;
    }
    if (isSkipped(n) && n.name !== 'span') return;

    const c = classOf(n);
    const next = { ...style };

    if (n.name === 'strong' || n.name === 'b') next.bold = true;
    if (n.name === 'em' || n.name === 'i') next.italics = true;
    if (n.name === 'sup' || hasClass(n, 'footnote-ref') || hasClass(n, 'gloss-mark')) {
      next.superScript = true;
      next.size = 16;
    }
    if (hasClass(n, 'speaker')) {
      next.bold = true;
      next.color = COLORS.priest;
    }
    if (hasClass(n, 'dialogue-text') || hasClass(n, 'prayer-text') || hasClass(n, 'body')) {
      next.color = next.color === COLORS.priest ? next.color : COLORS.prayer;
    }
    if (/\bcue\b/.test(c)) {
      next.bold = true;
      next.color = cueColor(c);
    }
    if (hasClass(n, 'drop-cap')) {
      next.bold = true;
      next.size = 56;
      next.color = COLORS.heading;
    }
    if (hasClass(n, 'opening-quote')) {
      next.size = 28;
      next.color = COLORS.heading;
    }
    if (hasClass(n, 'citation') || /cite/.test(c)) {
      next.italics = true;
      next.size = 18;
    }
    if (hasClass(n, 'quote-green')) {
      next.bold = true;
      next.color = COLORS.emphasis;
    }
    if (hasClass(n, 'quote-blue')) {
      next.bold = true;
      next.color = COLORS.prayer;
    }

    for (const child of n.children || []) walk(child, next);
  };

  walk(node, base);
  return runs;
}

function paragraphFromElement($, el, opts = {}) {
  const c = classOf(el);
  const runs = [];
  for (const child of el.children || []) {
    runs.push(...convertInlines($, child, opts.runStyle || {}));
  }
  if (!runs.length) {
    const text = decodeText($(el).text());
    if (text.trim()) {
      runs.push(
        new TextRun({
          text: text.trim(),
          font: 'Georgia',
          size: opts.size ?? 20,
          color: opts.color || COLORS.text,
          bold: opts.bold || false,
          italics: opts.italics || false,
        }),
      );
    }
  }
  if (!runs.length) {
    return new Paragraph({ children: [new TextRun({ text: '' })] });
  }

  let alignment = opts.alignment;
  if (!alignment) {
    if (/title|epigraph|scripture-quote|box-header|chapter-title|section-title/.test(c)) {
      alignment = AlignmentType.CENTER;
    } else if (/attribution|stage-/.test(c)) {
      alignment = AlignmentType.LEFT;
    }
  }

  const isTitle =
    el.name === 'h1' ||
    el.name === 'h2' ||
    el.name === 'h3' ||
    /title|box-header/.test(c);

  return new Paragraph({
    alignment,
    spacing: { after: opts.after ?? 120, before: opts.before ?? 0, line: opts.line },
    border: opts.underlineTitle
      ? undefined
      : undefined,
    children: runs.map((r) => r),
    ...(isTitle && el.name === 'h1'
      ? { heading: HeadingLevel.HEADING_1 }
      : el.name === 'h2'
        ? { heading: HeadingLevel.HEADING_2 }
        : {}),
  });
}

function emptyPara() {
  return new Paragraph({ children: [new TextRun({ text: '' })] });
}

function ensureBlockChildren(nodes) {
  const list = (nodes || []).filter(Boolean);
  return list.length ? list : [emptyPara()];
}

function imageStub(filename, caption, availWidth = CONTENT_WIDTH_DXA) {
  const label = caption ? `${filename}\n${caption}` : filename;
  const lines = label.split('\n');
  const w = Math.max(200, availWidth);
  const stubBorder = {
    top: THIN(COLORS.stubBorder),
    bottom: THIN(COLORS.stubBorder),
    left: THIN(COLORS.stubBorder),
    right: THIN(COLORS.stubBorder),
  };
  return new Table({
    width: { size: w, type: WidthType.DXA },
    columnWidths: [w],
    layout: TableLayoutType.FIXED,
    borders: {
      ...stubBorder,
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: w, type: WidthType.DXA },
            borders: stubBorder,
            shading: { type: ShadingType.CLEAR, fill: COLORS.stubBg },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 60 },
                children: [
                  new TextRun({
                    text: lines[0] || '[image]',
                    font: 'Courier New',
                    size: 18,
                    color: COLORS.stubText,
                  }),
                ],
              }),
              ...lines.slice(1).map(
                (line) =>
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 200 },
                    children: [
                      new TextRun({
                        text: line,
                        font: 'Georgia',
                        size: 16,
                        italics: true,
                        color: COLORS.stubText,
                      }),
                    ],
                  }),
              ),
              new Paragraph({
                spacing: { after: 120 },
                children: [new TextRun({ text: '' })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function figureToBlocks($, figure, availWidth = CONTENT_WIDTH_DXA) {
  const img = $(figure).find('img').first();
  const src = img.attr('src') || '';
  const filename = src ? path.basename(src) : '[image]';
  const caption = decodeText($(figure).find('figcaption').first().text()).trim();
  return [imageStub(filename, caption, availWidth)];
}

function makeTable(colWidths, cellContents, { borders = NO_BORDER, cellShading } = {}) {
  const total = colWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: colWidths,
    layout: TableLayoutType.FIXED,
    borders: {
      top: borders.top,
      bottom: borders.bottom,
      left: borders.left,
      right: borders.right,
      insideHorizontal: borders.top,
      insideVertical: borders.left,
    },
    rows: [
      new TableRow({
        children: colWidths.map((w, i) => {
          const kids = ensureBlockChildren(cellContents[i]);
          return new TableCell({
            width: { size: w, type: WidthType.DXA },
            borders,
            // Allow normal wrapping; do not set noWrap.
            shading: cellShading
              ? { type: ShadingType.CLEAR, fill: cellShading }
              : undefined,
            children: kids,
          });
        }),
      }),
    ],
  });
}

function convertGrid($, el, availWidth = CONTENT_WIDTH_DXA) {
  const cols = contentChildren($, el).filter((child) => !isDivider(child));
  if (!cols.length) return [];
  const widths = widthsForGrid(classOf(el), cols.length, availWidth);
  const cells = cols.map((col, i) => convertBlocks($, col, nestWidth(widths[i])));
  const c = classOf(el);
  const bordered = /\bliturgy-outline\b/.test(c);
  return [
    makeTable(widths, cells, {
      borders: bordered
        ? {
            top: THIN(COLORS.boxBorder),
            bottom: THIN(COLORS.boxBorder),
            left: THIN(COLORS.boxBorder),
            right: THIN(COLORS.boxBorder),
          }
        : NO_BORDER,
      cellShading: bordered ? COLORS.outlineBg : undefined,
    }),
  ];
}

/**
 * If el is a wrapper whose first figure is floated beside sibling text,
 * emit a 2-col table approximating the float.
 */
function convertFloatWrap($, el, availWidth = CONTENT_WIDTH_DXA) {
  const kids = contentChildren($, el);
  const figures = kids.filter((k) => k.name === 'figure' || hasClass(k, 'figure-right') || hasClass(k, 'figure-left'));
  const others = kids.filter((k) => !figures.includes(k));
  if (!figures.length || !others.length) return null;

  // Only auto-split when there's exactly one figure among mixed content.
  if (figures.length !== 1) return null;

  const fig = figures[0];
  const side =
    floatSideFromClass(classOf(fig)) ||
    floatSideFromClass(classOf(el)) ||
    'left';

  const widths = side === 'left' ? frToDxa([0.9, 2.1], availWidth) : frToDxa([2.1, 0.9], availWidth);
  const figW = nestWidth(side === 'left' ? widths[0] : widths[1]);
  const textW = nestWidth(side === 'left' ? widths[1] : widths[0]);
  const figBlocks = figureToBlocks($, fig, figW);
  const textBlocks = others.flatMap((k) => convertBlocks($, k, textW));
  const cells = side === 'left' ? [figBlocks, textBlocks] : [textBlocks, figBlocks];
  return [makeTable(widths, cells)];
}

function boxedSection($, el, borderColor, fill, availWidth = CONTENT_WIDTH_DXA) {
  const inner = convertChildren($, el, nestWidth(availWidth));
  const boxBorder = {
    top: THIN(borderColor),
    bottom: THIN(borderColor),
    left: THIN(borderColor),
    right: THIN(borderColor),
  };
  return [
    new Table({
      width: { size: availWidth, type: WidthType.DXA },
      columnWidths: [availWidth],
      layout: TableLayoutType.FIXED,
      borders: {
        top: boxBorder.top,
        bottom: boxBorder.bottom,
        left: boxBorder.left,
        right: boxBorder.right,
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: availWidth, type: WidthType.DXA },
              borders: boxBorder,
              shading: { type: ShadingType.CLEAR, fill },
              children: ensureBlockChildren(inner),
            }),
          ],
        }),
      ],
    }),
  ];
}

/**
 * Convert a node into zero or more block-level DOCX nodes (Paragraph|Table).
 * @param {number} availWidth  Max width in DXA for tables rooted at this node.
 */
export function convertBlocks($, el, availWidth = CONTENT_WIDTH_DXA) {
  if (!el || el.type !== 'tag' || isSkipped(el)) return [];

  const c = classOf(el);

  // Standalone image / figure
  if (el.name === 'img') {
    const src = el.attribs?.src || '';
    return [imageStub(src ? path.basename(src) : '[image]', '', availWidth)];
  }
  if (el.name === 'figure' || hasClass(el, 'image-placeholder')) {
    if (el.name === 'figure') return figureToBlocks($, el, availWidth);
    const label = decodeText($(el).text()).trim() || '[image]';
    return [imageStub(label, '', availWidth)];
  }

  // Bordered single-column boxes BEFORE grid detection — page classes like
  // "questions-in-grid" only mean CSS placement inside a parent grid.
  if (hasClass(el, 'liturgical-box')) {
    return boxedSection($, el, COLORS.boxBorder, COLORS.boxBg, availWidth);
  }
  if (hasClass(el, 'question-box')) {
    return boxedSection($, el, COLORS.questionBorder, 'FBF9F1', availWidth);
  }

  // Float wrap (figure + text siblings)
  if (!isGridContainer(el)) {
    const floated = convertFloatWrap($, el, availWidth);
    if (floated) return floated;
  }

  // Explicit multi-column containers
  if (isGridContainer(el)) {
    return convertGrid($, el, availWidth);
  }

  // Blockquote / commentary / section wrappers: unwrap and convert children
  if (
    el.name === 'section' ||
    el.name === 'aside' ||
    el.name === 'blockquote' ||
    el.name === 'div' ||
    el.name === 'header' ||
    el.name === 'main' ||
    hasClass(el, 'commentary') ||
    hasClass(el, 'commentary-body') ||
    hasClass(el, 'main-content') ||
    hasClass(el, 'pullout') ||
    /^col-/.test(c.split(/\s+/)[0] || '') ||
    hasClass(el, 'col-left') ||
    hasClass(el, 'col-center') ||
    hasClass(el, 'col-right')
  ) {
    // If this div only wraps phrasing content (no block children), treat as paragraph.
    const kids = contentChildren($, el);
    const blockTags = new Set([
      'p',
      'div',
      'section',
      'aside',
      'figure',
      'table',
      'ul',
      'ol',
      'blockquote',
      'h1',
      'h2',
      'h3',
      'h4',
      'header',
    ]);
    if (kids.length && kids.every((k) => !blockTags.has(k.name))) {
      return [paragraphFromElement($, el)];
    }
    if (!kids.length) {
      const text = decodeText($(el).text()).trim();
      if (!text) return [];
      return [paragraphFromElement($, el)];
    }
    return kids.flatMap((k) => convertBlocks($, k, availWidth));
  }

  // Headings & paragraphs
  if (/^h[1-6]$/.test(el.name) || el.name === 'p' || el.name === 'li') {
    const opts = {};
    if (/title|epigraph-text/.test(c)) {
      opts.runStyle = { size: /chapter-title|page-\d+-title/.test(c) ? 28 : 22, bold: true, color: COLORS.heading };
      opts.alignment = AlignmentType.CENTER;
      opts.after = 160;
    }
    if (/epigraph-attribution|subtitle/.test(c)) {
      opts.runStyle = { size: 18, italics: true };
      opts.alignment = AlignmentType.CENTER;
    }
    if (hasClass(el, 'box-header') || (/QUESTIONS?/i.test($(el).text()) && el.name === 'h3')) {
      opts.runStyle = { size: 24, color: COLORS.questionHeader };
      opts.alignment = AlignmentType.CENTER;
    }
    if (hasClass(el, 'prayer-text') || hasClass(el, 'prayer-continuation')) {
      opts.runStyle = { size: 18, color: COLORS.prayer };
    }
    if (/stage-/.test(c)) {
      opts.runStyle = { size: 16, color: COLORS.prayer, italics: true };
    }
    if (hasClass(el, 'sanctus') || hasClass(el, 'people-response')) {
      opts.runStyle = { size: 20, color: COLORS.emphasis };
    }
    return [paragraphFromElement($, el, opts)];
  }

  // Fallback: recurse or text dump
  const kids = contentChildren($, el);
  if (kids.length) return kids.flatMap((k) => convertBlocks($, k, availWidth));
  const text = decodeText($(el).text()).trim();
  if (!text) return [];
  return [paragraphFromElement($, el)];
}

function convertChildren($, el, availWidth = CONTENT_WIDTH_DXA) {
  return contentChildren($, el).flatMap((child) => convertBlocks($, child, availWidth));
}

/**
 * Convert one article.book-page into DOCX block nodes.
 */
export function convertBookPage($, pageEl, { pageBreakBefore = false } = {}) {
  const blocks = convertChildren($, pageEl, CONTENT_WIDTH_DXA);
  if (!blocks.length) return [emptyPara()];

  if (pageBreakBefore) {
    // Prefer pageBreakBefore on a leading empty paragraph so tables aren't first.
    return [
      new Paragraph({
        children: [new TextRun({ text: '' })],
        pageBreakBefore: true,
      }),
      ...blocks,
    ];
  }
  return blocks;
}
