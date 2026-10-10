# marrow
# Marrow Street Books

A single-page site for an independent bookstore. Plain HTML5 and CSS3, no frameworks, no build step, no JavaScript.

## Sections

- **Hero** with a Flexbox shelf of book spines
- **Fiction** and **Nonfiction**: a product grid of book cards
- **Staff picks**: the same grid, with a short note from a bookseller on each card
- **Events**: readings and book clubs
- **Visit**: address and hours in the footer

## Run it

Open `index.html` in a browser. Nothing to install.

## Structure

```
index.html
css/styles.css
```

## How it meets the brief

- **Semantic landmarks:** `header`, `nav`, `main`, `footer`, plus labelled `section`s. One `h1`.
- **Working nav:** every link points at a real `id` on the page. A skip link comes first in tab order.
- **CSS:** `box-sizing: border-box` on `*, *::before, *::after`. Colors, fonts, and spacing live in custom properties on `:root`.
- **Flexbox:** header and nav, hero buttons, the spine shelf, book card layout, event rows, footer.
- **Grid:** the book grid (2 columns on phones, 3 on tablets, 6 on desktop; 4 for staff picks), the hero layout, and the events list.
- **No horizontal scroll:** tested at 320, 360, 390, 768, 1024, 1280, and 1920 px wide. Grid tracks use `minmax(0, 1fr)` and long words wrap.

## Interaction details

- Hover, focus, and pressed states on every link and button.
- Focus ring is 3px and meets 3:1 contrast on both light and dark sections.
- Tap targets are at least 44px tall.
- Smooth scrolling and button transitions switch off under `prefers-reduced-motion`.
- "Hold a copy" and "Save a seat" are `mailto:` links, since there is no backend.

## Placeholder content

Book titles, authors, staff names, prices, events, and the address are invented. Replace them with real stock.
