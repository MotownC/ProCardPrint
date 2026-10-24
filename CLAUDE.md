# CLAUDE.md - Project Instructions for Claude Code

## Project Overview

**ProCard Legends Print** is a static web application for arranging and printing 2.5" x 3.5" sports trading cards onto 8.5" x 11" sheets. It supports double-sided printing with mirrored back layouts. Part of the ProCard ecosystem alongside [ProCard Editor](https://pro-card-editor.vercel.app/).

## Tech Stack

- **Pure HTML/CSS/JavaScript** - No frameworks, no build tools, no server-side dependencies
- **jsPDF** - PDF generation (loaded via CDN)
- **Google Fonts** - Teko (headings) and Inter (body text)

## Project Structure

```
ProCardPrint/
├── index.html          # Main app structure, modals, front/back sheet grids
├── styles.css          # All styling, 3D transforms, print media queries
├── script.js           # App logic: drag-and-drop, state, print preview, PDF, PNG export
├── logo.png            # ProCard Legends logo
├── README.md           # User-facing documentation
├── CLAUDE.md           # This file
└── .claude/skills/     # Claude Code skill references
```

## Key Architecture

### State Management (script.js)
- `uploadedCards` - Array of uploaded card objects `{id, src, name}`
- `cardSlots` - Array(9) mapping grid positions to card objects (null if empty)
- `cardBacks` - Array(9) mapping grid positions to back image data URLs (null if no back)
- `currentSlotForBack` - Tracks which slot is pending a back upload
- `showCardBorders` - Boolean toggle for black card borders
- `paperSize` - `'letter'`, `'4x6'` (one centered card) or `'4x6-2up'` (two cards, landscape) — controls sheet dimensions and slot count
- `PAPER_LAYOUTS` / `getLayout()` - single source of page size, cols/rows, cut-mark length, label and filename suffix for each paper size; `mirrorIndex(i, cols)` gives the back-sheet source slot

### Layout System
- Front sheet: 3x3 grid, positions 1-9 (left to right, top to bottom)
- Back sheet: Mirrored horizontally for double-sided printing alignment
  - Columns swap: position 1↔3, 4↔6, 7↔9 (center stays)
  - Back sheet slot numbers: 3-2-1 / 6-5-4 / 9-8-7
  - Mirroring formula: `mirroredCol = 2 - col`, `mirroredIndex = row * 3 + mirroredCol`

### Card Dimensions
- Card: 2.5" x 3.5" (240px x 336px at 96 DPI)
- Letter sheet: 8.5" x 11" (816px x 1056px at 96 DPI) — 3x3 grid, 9 cards
- 4×6 photo sheet: 4" x 6" (384px x 576px at 96 DPI) — single card, centered
- 4×6 ×2 photo sheet: landscape 6" x 4" (576px x 384px at 96 DPI) — two cards side by side (slots 1-2), mirrored 1↔2 on the back
- Cutting buffer: 0.125" (12px) gap between cards

## Design System

- **Background**: `#0f172a` (Tailwind slate-900)
- **Text**: `#f8fafc` (Tailwind slate-50)
- **Accent/Cyan**: `#22d3ee` (Tailwind cyan-400) - used for "LEGENDS" in title
- **Headings**: Teko font, bold, uppercase
- **Body**: Inter font
- **Dark theme** matching ProCard Editor aesthetic

## Important Patterns

### Event Handling
- Drop events are attached to front sheet slots ONLY (`printSheet.querySelectorAll`) to prevent duplicate card bug
- Use `e.stopPropagation()` on interactive elements inside slots
- Remove button and Add Back button use `onclick` with `stopPropagation`
- Card flip uses click listener on the flip container element

### Rendering
- `renderSlots()` calls `renderSheet()` for both front and back sheets
- Each render clears slot innerHTML and rebuilds (preserves slot-number span)
- Cards with backs show: green "Has Back" badge, flip animation on click, "Click to flip" hint
- Cards without backs show: "+ Add Back" cyan button on hover
- Layout tabs appear when any card is placed; Back Layout tab appears only when backs exist

### Rotate
- Blue ↻ button on hover (left of the × on the front sheet; top-right on the back sheet) rotates that slot's front or back 90° clockwise
- On the front sheet the ↻ rotates whichever face is showing: the back when the card is flipped (`flippedSlots` Set tracks flip state so it survives `renderSlots()` rebuilds)
- `rotateImage90(src)` bakes the rotation into a new lossless PNG data URL, so preview, print preview, PDF and PNG need no rotation logic
- Front rotation replaces `cardSlots[i]` with a copy (`{...card, src}`), so the library thumbnail and other slots using the same upload are unaffected; the slot's bleed is regenerated after rotating

### Brighten
- Amber ☀ button on hover (left of ↻) brightens that slot's front or back, same "side showing" rule as Rotate
- `brightenImage(src)` approximates a Photoshop Brightness/Contrast layer at +40 (non-legacy): per-channel gamma LUT `255*(v/255)^(1/1.4)`, so black/white stay fixed and midtones lift (128 → 156); baked into a PNG like rotation
- Each click stacks another +40; both buttons go through `transformSlotImage(slotIndex, isBack, transform, label)`, which also regenerates the bleed

### Card Border Toggle
- Checkbox in the layout tabs bar, visible when any card is placed
- When enabled, adds a 0.0625" (`BLEED_IN`) bleed around each card: the card's own outer pixels mirrored outward, so the border looks like a continuation of the card (gradients, textures and per-side colors carry through)
- `cardBleeds` and `cardBackBleeds` (Array(9) of JPEG data URLs) cache the bleed images; populated when a card is placed/back is added, cleared when removed
- `createBleedImage(src)` — async, draws the card at 320 DPI onto a canvas 20px larger on each side, then mirrors the edge columns and rows outward (rows last, so corners fill too)
- The bleed image is always drawn first and the original card image on top, so card quality is unchanged
- Applied consistently across:
  - Preview: `.card-bleed` div inside the slot (`inset: -6px; z-index: -1`, kept behind the card by the slot's `perspective` stacking context)
  - Print preview: `card-border-bg` div with the bleed as `background-image`, `inset: -0.0625in`
  - PDF: `pdf.addImage(bleed)` at card rect expanded by `BLEED_IN`, before the card image
  - PNG: `drawCard` loads the bleed and the card together and draws the bleed first (so the order holds even with async image loads)

### Paper Size Toggle
- Toggle buttons (Letter / 4×6 / 4×6 ×2) in the layout tabs bar, next to Card Border toggle
- 4×6 ×2: `.size-4x6-2up` shows slots 1-2 only, card count "X of 2"; PDF/print preview pages are 6"×4" landscape, PNG 1800x1200; back slot numbers are set dynamically in `renderSheet` from `mirrorIndex`
- `paperSize` state drives all dimensions across preview, print preview, PDF, and PNG
- When 4×6: preview sheet resizes, slots 1-8 hidden via CSS `.size-4x6`, card count shows "X of 1"
- 4×6 uses centered card positioning in print preview (`top: 50%; transform: translate(-50%, -50%)`)
- Letter uses `top: 0.125in` positioning (prevents bottom row cutoff)
- Back sheet mirroring is skipped for 4×6 (single card, same centered position)

### Export System
- **Export dropdown** with two sections: PDF and Photoshop (300 DPI PNG)
- PDF modes: Front Only, Back Only, Both (Front + Back)
- PNG modes: Front Only, Back Only, Both (Front + Back)
- Letter: 2550x3300px at 300 DPI (8.5"x11") | 4×6: 1200x1800px at 300 DPI (4"x6")
- Both respect the card border toggle and paper size toggle
- Filenames include size and mode suffix: `trading-cards-4x6-fronts-2026-02-07.pdf`

### Print Preview
- Opens in a new window via `window.open()`
- Must include Google Fonts links in the preview HTML head
- Letter: grid at `top: 0.125in` (not centered) to prevent bottom row cutoff
- 4×6: grid centered vertically and horizontally via `translate(-50%, -50%)`
- Page dimensions, grid columns/rows, and slot count all driven by `paperSize`
- Guided double-sided print workflow with step-by-step confirm dialogs
- Flip steps come from `getFlipInstructions()` (driven by each layout's `flip`: `'side'` for Letter/4×6, `'end'` for 4×6 ×2, since that landscape page is fed short edge first) and are injected into the preview window as `flipSteps`; the PNG export alert shows the same steps plus Photoshop print settings
- Card border state carries over to print preview via per-card `card-border-bg` divs inside `card-with-border` wrappers

### Cut Marks
- Small black tick marks (0.5" for letter, 0.35" for 4×6) at all four page edges aligned with card boundaries — 0.5" survives non-borderless printer margins (~0.25") and leaves a clearly visible mark
- Letter: 6 vertical marks on top/bottom edges, 6 horizontal marks on left/right edges
- 4×6: 2 vertical marks on top/bottom, 2 horizontal marks on left/right (single card edges)
- 4×6 ×2: 4 vertical marks on top/bottom shortened to 0.15" (`markLenTB`) so they stop before the card/bleed (cards are 0.25" from those edges); left/right marks stay 0.35"
- Applied across all outputs: preview (`renderCutMarks` divs), print preview (`generatePreviewCutMarks` HTML), PDF (`drawPdfCutMarks` lines), PNG (canvas strokes)
- All cut mark functions use `cols`/`rows` variables derived from `paperSize`
- Always visible (not tied to border toggle) - guides for cutting cards to size

### PDF Generation
- Uses jsPDF with `format: 'letter'` or `format: [4, 6]` based on `paperSize`
- Letter: page 2 mirrors card backs horizontally to match front positions
- 4×6: single card centered, no mirroring needed for backs
- Images converted to JPEG format in PDF for file size
- Border background drawn before card images so cards sit on top
- Cut marks drawn after cards via `drawPdfCutMarks()`

### PNG Export (Photoshop)
- Uses HTML5 Canvas at 300 DPI — Letter: 2550x3300px, 4×6: 1200x1800px
- Opens at correct dimensions in Photoshop (8.5"x11" or 4"x6")
- **pHYs chunk injection**: `setPngDpi()` injects PNG metadata so Photoshop reads 300 DPI (not default 72 DPI)
  - Converts DPI to pixels/meter (300 DPI = 11811 ppm), builds pHYs chunk with CRC32, inserts after IHDR
- Border background drawn before cards via `fillRect`
- Cut marks drawn after cards via canvas strokes
- "Both" mode loops over `['front', 'back']`, rendering a separate canvas for each and downloading two PNG files
- Downloads as PNG via data URL and anchor click

## Common Gotchas

1. **Duplicate cards bug**: Only attach drop listeners to `printSheet.querySelectorAll('.card-slot')`, never `document.querySelectorAll`
2. **Server caching**: `localhost` servers cache JS/CSS aggressively - use `file://` URL or restart server to see changes
3. **Print preview grid cutoff**: Don't vertically center the letter-size card grid - use fixed `top: 0.125in` (4×6 uses centering since single card fits easily)
4. **Back sheet mirroring**: The HTML slot numbers AND the JS rendering both need to mirror correctly
5. **Recommended image format**: PNG for lossless quality with crisp text and graphics
6. **Add Back button**: Uses `onclick` on a `<button>` element appended to the slot (not click on flip container) for reliable event handling through layered absolute-positioned elements
7. **PNG DPI metadata**: `canvas.toDataURL()` doesn't embed DPI — must inject `pHYs` chunk manually or Photoshop defaults to 72 DPI

## Target Printer

Canon Pro-200s inkjet photo printer. Supports both Letter (8.5"x11") and 4"x6" photo paper. Print settings: Actual Size/100%, Color, Printer Manages Colors.
