/**
 * Shared section map for PDF and DOCX exporters.
 *
 * Keys are CLI section ids. `all` is handled by resolveExport().
 */

export const SECTIONS = {
  'introduction-rite-of-preparation': {
    title: 'An introduction. The Rite of Preparation',
    pages: [2, 3, 4, 5, 6, 8, 9, 10],
  },
  'liturgy-of-the-word': {
    title: 'The Liturgy of the Word',
    pages: [
      12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
      28, 29, 30, 31, 32, 33, 34, 35, 36, 37,
    ],
  },
  'liturgy-of-the-faithful': {
    title: 'The Liturgy of the Faithful',
    pages: [
      44, 45, 46, 47, 48, 49, 50, 51,
      54, 55, 56, 57, 58, 59,
      62, 63, 64, 65, 66, 68, 69, 70, 71, 72, 73,
      76, 77, 78, 79, 80, 81, 82, 83, 84,
      88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99,
    ],
  },
  appendices: {
    title: 'Appendices',
    pages: [101, 104, 105],
  },
};

/** Book order for the combined export. */
export const ALL_SECTION_IDS = [
  'introduction-rite-of-preparation',
  'liturgy-of-the-word',
  'liturgy-of-the-faithful',
  'appendices',
];

export function pageFilename(n) {
  return `page-${String(n).padStart(3, '0')}.html`;
}

/**
 * Resolve a CLI section id to { title, outfile, pages }.
 * `all` concatenates every section in book order.
 */
export function resolveExport(sectionId, ext) {
  if (sectionId === 'all') {
    return {
      title: 'Study of Divine Liturgy',
      outfile: `study-of-divine-liturgy.${ext}`,
      pages: ALL_SECTION_IDS.flatMap((id) => SECTIONS[id].pages),
    };
  }
  const section = SECTIONS[sectionId];
  if (!section) return null;
  return {
    title: section.title,
    outfile: `${sectionId}.${ext}`,
    pages: section.pages,
  };
}

export function knownSectionIds(includeAll = false) {
  const ids = Object.keys(SECTIONS);
  return includeAll ? [...ids, 'all'] : ids;
}
