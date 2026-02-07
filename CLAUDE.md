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
├── script.js           # App logic: drag-and-drop, state, print preview, PDF
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

### Layout System
- Front sheet: 3x3 grid, positions 1-9 (left to right, top to bottom)
- Back sheet: Mirrored horizontally for double-sided printing alignment
  - Columns swap: position 1↔3, 4↔6, 7↔9 (center stays)
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

### Print Preview
- Opens in a new window via `window.open()`
- Must include Google Fonts links in the preview HTML head
- Grid positioned at `top: 0.125in` (not centered) to prevent bottom row cutoff
- Guided double-sided print workflow with step-by-step confirm dialogs

### PDF Generation
- Uses jsPDF with letter size (8.5" x 11")
- Page 2 mirrors card backs horizontally to match front positions
- Images converted to JPEG format in PDF for file size

## Common Gotchas

1. **Duplicate cards bug**: Only attach drop listeners to `printSheet.querySelectorAll('.card-slot')`, never `document.querySelectorAll`
2. **Print preview caching**: Browser/server may cache JS/CSS - use Ctrl+Shift+R or open file directly
3. **Print preview grid cutoff**: Don't vertically center the card grid - use fixed `top: 0.125in`
4. **Back sheet mirroring**: The HTML slot numbers AND the JS rendering both need to mirror correctly
5. **Recommended image format**: PNG for lossless quality with crisp text and graphics

## Target Printer

Canon Pro-200s inkjet photo printer. Print settings: Letter size, Actual Size/100%, Color, Printer Manages Colors.
