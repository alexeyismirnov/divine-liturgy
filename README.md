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
