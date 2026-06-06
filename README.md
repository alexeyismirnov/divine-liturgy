# Divine Liturgy

A static, browser-friendly edition of selected pages from a printed
**Divine Liturgy** book (Orthodox / Byzantine rite). Each page of the
book is a separate HTML file that visually mirrors the original scan —
fonts, colors, alignment, decorative borders, and the colored-triangle
cues for silent/aloud parts of the priest's and deacon's prayers.

The book scans (`IMG_0xxx.jpeg`) are reference material only and are
**not** tracked in this repo (see `.gitignore`).

## Project structure

```
.
├── index.html              Landing page — links to every built page
├── css/
│   ├── book.css            General / shared styles (colors, fonts,
│   │                        3-col preface-grid, liturgical box,
│   │                        decorative diamond dividers, words of
│   │                        institution, QUESTIONS box, etc.)
│   ├── page-066.css       Page-specific overrides for page 66
│   │                        (The Remembrance — 2-col outer layout
│   │                        with a long vertical separator and
│   │                        5 stage-direction blocks distributed
│   │                        along the full column height)
│   ├── page-067.css       Page-specific overrides for page 67
│   │                        (equal-width 2-col top section with
│   │                        commentary on the left and lead quote +
│   │                        Last Supper image on the right)
│   ├── page-068.css       Page-specific overrides for page 68
│   │                        (two stacked liturgical boxes: a 2-titled
│   │                        top box for The Consecration + The
│   │                        Elevation of the Gifts, and a 3-col
│   │                        Epiclesis box with 10+ short right-column
│   │                        stage-direction blocks)
│   └── page-069.css       Page-specific overrides for page 69
│                            (2-col top section: commentary with a
│                            chalice figure floated inside the body
│                            text on the left, and a St John of
│                            Damascus quote box + bold pullout on the
│                            right; bottom QUESTION box with the
│                            header anchored in the top right corner)
│   ├── page-070.css       Page-specific overrides for page 70
│   │                        (single liturgical box with two stacked
│   │                        3-col grids + a full-width priest prayer
│   │                        line between them; a new `.cue-yellow`
│   │                        for the gold "exclaims out loud" cue;
│   │                        bottom commentary with the Theotokos
│   │                        icon floated to the left)
│   └── page-071.css       Page-specific overrides for page 71
│                            (top commentary with a St John the Baptist
│                            image floated right and a pullout floated
│                            left, both with large top margins; middle
│                            QUESTIONS box; bottom commentary with a
│                            pullout floated right)
├── pages/
│   ├── page-064.html       The Eucharistic Prayer / The Preface Prayer
│   ├── page-065.html       The Sanctus (commentary + questions)
│   ├── page-066.html       The Remembrance (silent prayer + words
│   │                        of institution + QUESTIONS)
│   ├── page-067.html       The Remembrance (continued) + QUESTIONS
│   │                        + bottom commentary
│   ├── page-068.html       The Consecration of the Gifts + The
│   │                        Prayer of the Epiclesis (two stacked
│   │                        liturgical boxes)
│   ├── page-069.html       The Consecration (commentary with
│   │                        St John of Damascus callout + QUESTION
│   │                        box at the bottom)
│   ├── page-070.html       The Intercession + The Hymn to the
│   │                        Theotokos (liturgical box with two
│   │                        stacked 3-col grids) + Theotokos
│   │                        commentary (icon floated left)
│   └── page-071.html       The Intercession + The Hymn to the
│                            Theotokos commentary (with floated
│                            image and pullouts) + QUESTIONS box
└── .gitignore              Excludes IMG_*.jpeg scans + editor noise
```

## How the CSS is split

- **`css/book.css`** holds everything shared across pages:
  color palette, web fonts (`MedievalSharp`, `Cardo`, `EB Garamond`),
  the page chrome (`.book-page`, `.chapter-title`, `.section-title`),
  the `.liturgical-box` decorative container, the standard 3-column
  `.preface-grid`, the `.col-left` / `.col-center` / `.col-right`
  columns, the `.vdivider` diamond-pattern separator, the cue
  triangles (`.cue-silent`, `.cue-aloud`, `.cue-red`, `.cue-blue`,
  `.cue-green`, `.cue-brown`), the words-of-institution base styles
  (`.prayer-continuation`, `.dialogue-line`), the QUESTIONS box
  (`.question-box`, `.bible-quote`, `.bible-emph`, `.citation`),
  the commentary layout (`.commentary-grid`, `.pullout`,
  `.commentary-body`, `.drop-cap`, `.quote-inline`), the Liturgy
  outline (`.liturgy-outline`), the image placeholder
  (`.image-placeholder`, `.figure-right`), and print styles.

- **`css/page-XXX.css`** files hold only the layout pieces unique to
  one page. For example `page-066.css` defines the outer
  2-column `.remembrance-layout`, the full-height right-column
  variant `.col-right-full` (with 5 stage-direction blocks
  distributed along the column height via `flex-grow` on the
  2nd and 3rd children), the long vertical separator
  `.vdivider.vdivider-long`, and the centred silent prayer
  modifier `.prayer-continuation-centered`.

This split keeps the shared file from getting cluttered with
page-specific overrides while still letting each page's layout
evolve independently.

## Built pages

| Page | Section | Description |
|------|---------|-------------|
| 64 | The Eucharistic Prayer | The Preface Prayer (3-col grid with silent + aloud cues) |
| 65 | The Sanctus | Commentary + QUESTIONS box + Sanctus commentary + bottom QUESTION + Isaiah quote |
| 66 | The Remembrance | Priest's silent prayer + 5 stage-direction blocks + words of institution + QUESTIONS |
| 67 | The Remembrance (cont.) | Commentary continued + Last Supper image + QUESTIONS + bottom commentary |
| 68 | The Consecration / The Epiclesis | Two stacked liturgical boxes: The Consecration + The Elevation of the Gifts, then The Prayer of the Epiclesis |
| 69 | The Consecration | Commentary (body text + chalice image) with a St John of Damascus quote box + bold pullout, then a QUESTION box |
| 70 | The Intercession | Two stacked 3-col grids (The Intercession + The Hymn to the Theotokos) with a full-width priest prayer line between them, then Theotokos commentary with icon floated left |
| 71 | The Intercession / The Hymn to the Theotokos | Top commentary with floated St John the Baptist image (right) and pullout (left), middle QUESTIONS box, bottom commentary on the Theotokos with a pullout floated right |

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
