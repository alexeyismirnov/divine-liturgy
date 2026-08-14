# Divine Liturgy

A static, browser-friendly edition of selected pages from a printed
**Divine Liturgy** book (Orthodox / Byzantine rite). Each page of the
book is a separate HTML file that visually mirrors the original scan —
fonts, colors, alignment, decorative borders, and the colored-triangle
cues for silent/aloud parts of the priest's and deacon's prayers.

The book scans (`IMG_0xxx.jpeg`) are reference material only and are
**not** tracked in this repo (see `.gitignore`).


## How the CSS is split

- **`css/book.css`** holds everything shared across pages
- **`css/page-XXX.css`** files hold only the layout pieces unique to
  one page.
  
This split keeps the shared file from getting cluttered with
page-specific overrides while still letting each page's layout
evolve independently.

## Built pages

| Page | Section | Description |
|------|---------|-------------|
| 62 | The Anaphora / The Preparation | 2-col dialogue grid (Deacon/Priest/People | stage directions) with color-coded responses + Liturgy outline (Anaphora highlighted); commentary with left + right floated pullouts; bottom QUESTIONS box (Romans 3.9-23, Hebrews 13.15) |
| 63 | Let us lift up our hearts! / Liturgical Fans / The Eucharistic Prayer | Green decorative title + commentary (Cabasilas quote, drop cap "C") + QUESTIONS box (Matthew 6.19-21); Liturgical Fans 3-col grid (rhipidia close-up | body text with drop cap "I" | pullout + angel image) with section caption; "The Eucharistic Prayer" blue/grey box with numbered actions, right-floated St John 6.51 pullout, and bold summary |
| 64 | The Eucharistic Prayer | The Preface Prayer (3-col grid with silent + aloud cues) |
| 65 | The Sanctus | Commentary + QUESTIONS box + Sanctus commentary + bottom QUESTION + Isaiah quote |
| 66 | The Remembrance | Priest's silent prayer + 5 stage-direction blocks + words of institution + QUESTIONS |
| 67 | The Remembrance (cont.) | Commentary continued + Last Supper image + QUESTIONS + bottom commentary |
| 68 | The Consecration / The Epiclesis | Two stacked liturgical boxes: The Consecration + The Elevation of the Gifts, then The Prayer of the Epiclesis |
| 69 | The Consecration | Commentary (body text + chalice image) with a St John of Damascus quote box + bold pullout, then a QUESTION box |
| 70 | The Intercession | Two stacked 3-col grids (The Intercession + The Hymn to the Theotokos) with a full-width priest prayer line between them, then Theotokos commentary with icon floated left |
| 71 | The Intercession / The Hymn to the Theotokos | Top commentary with floated St John the Baptist image (right) and pullout (left), middle QUESTIONS box, bottom commentary on the Theotokos with a pullout floated right |
| 72 | The Intercession (Continued) | Liturgical box: 2-col grid (Hymn title + People line | Priest prayer p1+p2) + full-width prayer + 3-col grid (People | Priest | 3 stage directions) + aloud prayer (brown cue) + People: Amen + BLESSING title + aloud blessing (green cue) + People: And with your spirit + Liturgy outline (Intercession highlighted); commentary with drop cap "F" and right-floated pullout |
| 73 | Prayer for the Church | Top QUESTION box (Hebrews 7.25, Romans 8.34); "Prayer for the Church" commentary with left-floated icon of the Apostles (caption: "Feasts of St Peter and St Paul and The Synaxion of the 70 Apostles"), body text (drop cap "A"), and right-floated pullout; bottom QUESTIONS box (Hebrews 13.17-18, 1 Thess 5.25, Eph 6.19, Col 4.3); final commentary with drop cap "A" and blue-italic liturgical quotes |

## Tech notes

- Pure HTML + CSS, no JavaScript, no build step.
- All web fonts loaded from Google Fonts via `@import url(...)` in
  `book.css`.
- Each page is a standalone `<article class="book-page">` with a
  fixed width of 820px, centered in the viewport.
- Stage-direction cues use Unicode `&#9654;` (▶) with semantic
  color classes (`.cue-red` for silent prayer, `.cue-blue` for the
  chalice blessing, etc.) so the priest's silent and aloud parts
  are visually distinguishable.

## How to add a new page

1. Create `pages/page-XXX.html`. Copy the boilerplate from
   `pages/page-066.html` or `pages/page-067.html`.
2. If the page needs a new layout piece (e.g. a different grid
   structure), create `css/page-XXX.css` and link it from the
   page in the `<head>`. Keep page-specific styles in this file
   and shared styles in `css/book.css`.
3. Add a `.stage-bottom` block in the right column for each
   colored-triangle stage direction. The general `.stage-bottom`
   rule already places them via `space-between` in the right column.
4. Add the page to the list in `index.html`.

## Local viewing

Just open `index.html` (or any `pages/page-XXX.html`) in a browser.
No server is required, though Chrome/Chromium will block the
Google Fonts request under `file://` in some configurations;
serving from a local HTTP server (`python3 -m http.server`) avoids
this.

## PDF export

Section PDFs use **A4 portrait** leaves. Each original book page is
rendered by Chromium as a **text-based PDF** (selectable / Acrobat-
editable fonts, not a screenshot). The cream `.book-page` card (no gray
viewport margins, no page numbers) is scaled to fit centered on A4.

```bash
npm install
npx playwright install chromium   # first time only
npm run export:introduction
npm run export:liturgy-of-the-word
npm run export:liturgy-of-the-faithful
npm run export:appendices
npm run export:all   # all sections → one file
```

Output (gitignored under `pdf/`):
- `pdf/introduction-rite-of-preparation.pdf` (pages 2–6, 8–10)
- `pdf/liturgy-of-the-word.pdf` (pages 12–25, 28–37)
- `pdf/liturgy-of-the-faithful.pdf` (pages 44–51, 54–59, 62–66, 68–73, 76–84, 88–99)
- `pdf/appendices.pdf` (pages 101, 104–105)
- `pdf/study-of-divine-liturgy.pdf` (combined)

## DOCX export

Layout-approximating Word documents for the same sections. Multi-column
grids become tables; images are **gray stubs** labeled with the asset
filename (no binary images embedded). Visual fidelity is approximate —
good for editing text while keeping column structure.

```bash
npm run export:docx:introduction
npm run export:docx:liturgy-of-the-word
npm run export:docx:liturgy-of-the-faithful
npm run export:docx:appendices
npm run export:docx:all   # all sections → one file
```

Output (gitignored under `docx/`):
- `docx/introduction-rite-of-preparation.docx`
- `docx/liturgy-of-the-word.docx`
- `docx/liturgy-of-the-faithful.docx`
- `docx/appendices.docx`
- `docx/study-of-divine-liturgy.docx` (combined)

Regenerate as needed.
