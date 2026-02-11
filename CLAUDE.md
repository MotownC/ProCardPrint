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

### Layout System
- Front sheet: 3x3 grid, positions 1-9 (left to right, top to bottom)
- Back sheet: Mirrored horizontally for double-sided printing alignment
  - Columns swap: position 1↔3, 4↔6, 7↔9 (center stays)
  - Back sheet slot numbers: 3-2-1 / 6-5-4 / 9-8-7
  - Mirroring formula: `mirroredCol = 2 - col`, `mirroredIndex = row * 3 + mirroredCol`

### Card Dimensions
- Card: 2.5" x 3.5" (240px x 336px at 96 DPI)
- Sheet: 8.5" x 11" (816px x 1056px at 96 DPI)
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

### Card Border Toggle
- Checkbox in the layout tabs bar, visible when any card is placed
- When enabled, draws a solid black rectangle behind the card grid
- Fills the 0.125" gaps between cards AND adds 0.125" border on outer edges
- Applied consistently across: preview (CSS `::before` pseudo-element), print preview (`card-grid` background), PDF (`pdf.rect` fill), and PNG (canvas `fillRect`)

### Export System
- **Export dropdown** with two sections: PDF and Photoshop (300 DPI PNG)
- PDF modes: Front Only, Back Only, Both (Front + Back)
- PNG modes: Front Only, Back Only (2550x3300px at 300 DPI for 8.5"x11")
- Both respect the card border toggle
- Filenames include mode suffix and date: `trading-cards-fronts-2026-02-07.pdf`

### Print Preview
- Opens in a new window via `window.open()`
- Must include Google Fonts links in the preview HTML head
- Grid positioned at `top: 0.125in` (not centered) to prevent bottom row cutoff
- Guided double-sided print workflow with step-by-step confirm dialogs
- Card border state carries over to print preview via `has-border` class on `card-grid`

### PDF Generation
- Uses jsPDF with letter size (8.5" x 11")
- Page 2 mirrors card backs horizontally to match front positions
- Images converted to JPEG format in PDF for file size
- Border background drawn before card images so cards sit on top

### PNG Export (Photoshop)
- Uses HTML5 Canvas at 300 DPI (2550x3300px)
- Opens at correct 8.5"x11" dimensions in Photoshop
- Border background drawn before cards via `fillRect`
- Downloads as PNG via data URL and anchor click

## Common Gotchas

1. **Duplicate cards bug**: Only attach drop listeners to `printSheet.querySelectorAll('.card-slot')`, never `document.querySelectorAll`
2. **Server caching**: `localhost` servers cache JS/CSS aggressively - use `file://` URL or restart server to see changes
3. **Print preview grid cutoff**: Don't vertically center the card grid - use fixed `top: 0.125in`
4. **Back sheet mirroring**: The HTML slot numbers AND the JS rendering both need to mirror correctly
5. **Recommended image format**: PNG for lossless quality with crisp text and graphics
6. **Add Back button**: Uses `onclick` on a `<button>` element appended to the slot (not click on flip container) for reliable event handling through layered absolute-positioned elements

## Target Printer

Canon Pro-200s inkjet photo printer. Print settings: Letter size, Actual Size/100%, Color, Printer Manages Colors.
