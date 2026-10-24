# ProCard Legends Print

A web application for uploading, arranging, and printing 2.5" x 3.5" sports trading cards onto 8.5" x 11" sheets. Supports double-sided printing with mirrored back layouts and a guided print workflow optimized for the Canon Pro-200s printer.

Part of the **ProCard** ecosystem alongside [ProCard Editor](https://pro-card-editor.vercel.app/).

## What It Does

- Upload PNG card images via drag-and-drop or file browser
- Arrange up to 9 cards in a 3x3 grid on a standard US Letter sheet
- Optionally add card back images for double-sided printing
- Preview cards with a 3D flip animation (click any card with a back to flip it)
- View front and mirrored back layouts in separate tabs
- Print via guided double-sided workflow or generate a PDF
- Cutting buffer (1/8" spacing) between cards for easy trimming

## Tech Stack

| Technology | Purpose |
|---|---|
| HTML5 | Application structure and semantics |
| CSS3 | Styling, 3D transforms (card flip), CSS Grid layout, print media queries |
| Vanilla JavaScript | Application logic, drag-and-drop, state management |
| [jsPDF](https://github.com/parallax/jsPDF) | Client-side PDF generation (loaded via CDN) |
| Google Fonts | Teko (headings) and Inter (body text) |

No build tools, frameworks, or server-side dependencies. Runs entirely in the browser.

## Project Structure

```
ProCardPrint/
├── index.html              # Main HTML structure, modals, layout tabs
├── styles.css              # ProCard design system (dark theme, 3D flip, grid)
├── script.js               # App logic: drag-and-drop, print preview, PDF generation
├── logo.png                # ProCard Legends logo
├── README.md               # This file
├── SETUP.md                # Additional setup documentation
└── .claude/
    └── skills/
        ├── canvas-design.md      # Frontend design skill reference
        └── react-ui-patterns.md  # UI patterns skill reference
```

## Setup Instructions

No installation or build step required.

1. Clone or download the repository
2. Open `index.html` in a modern web browser (Chrome/Edge recommended)

That's it. All dependencies (jsPDF, Google Fonts) are loaded via CDN.

### Local Development

To serve locally (optional, for features that require a server):

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .

# Using PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

## Build / Deployment

### Static Hosting

Since this is a static site with no build step, deploy by copying all files to any static hosting provider:

- **Vercel**: `vercel deploy`
- **Netlify**: Drag and drop the project folder into Netlify
- **GitHub Pages**: Push to a repo and enable Pages in settings
- **Any web server**: Copy files to the document root

### No Build Commands Required

There is no build process. The application runs directly from the source files.

## Usage

1. **Upload cards**: Drag PNG files onto the upload zone or click to browse
2. **Place cards**: Drag cards from the uploaded section onto any of the 9 grid positions
3. **Add backs** (optional): After placing a front, a modal prompts you to upload the card's back image
4. **Preview backs**: Click any card with a green "Has Back" badge to see a 3D flip preview
5. **Switch views**: Use the "Front Layout" / "Back Layout (Mirrored)" tabs to see both sides
6. **Print**:
   - Click "Print Preview" to open the preview window
   - Use "Guided Double-Sided Print" for step-by-step double-sided printing
   - Or use "Print Fronts Only" / "Print Backs Only" for single-sided
7. **Generate PDF**: Click "Generate PDF" to download a print-ready PDF

## Special Configurations

### Canon Pro-200s Printer Setup

This app is optimized for the Canon Pro-200s inkjet photo printer. Whether you print from the browser, the PDF, or Photoshop, use these settings for **both** sides:

1. Printer: **Canon PRO-200 series**
2. Paper size: **Letter** or **4×6** (match the paper size picked in the app)
3. Scaling: **Actual Size / 100%** (never "fit to page")
4. **Borderless: off** (borderless enlarges the image slightly, which throws off front/back alignment)
5. Paper type: match your paper
6. Color management: **Printer Manages Colors**

### Printing from Photoshop (PNG export)

The PNG export is 300 DPI and opens at the exact page size (8.5"×11", 4"×6", or 6"×4" for 4×6 ×2). In Photoshop's Print dialog (Ctrl+P):

- **Print Settings…**: paper size Letter or 4×6, borderless off, paper type to match
- **Layout**: Portrait for Letter and 4×6, **Landscape for 4×6 ×2**
- **Color Management**: Printer Manages Colors
- **Position and Size**: Center Image on, **Scale 100%**, **Scale to Fit Media off**
- **Printing Marks / Functions**: leave **Emulsion Down** and **Negative** off (the backs PNG is already mirrored; don't flip it again)
- On Letter, Photoshop may warn that the image is larger than the printable area. Click **Proceed**; only the outer margin and the tips of the cut marks are clipped.

Print the `-fronts` PNG, reload the sheet (below), then print the `-backs` PNG with identical settings.

### Double-Sided Printing

The Pro-200s has no automatic duplex, so the sheet is flipped by hand. The back layout is mirrored left-to-right on the page so each back lands behind its front, **if** the sheet is turned over the right way:

| Layout | How to turn the sheet over | Load for the backs |
|---|---|---|
| **Letter** (3×3) | Side to side, like a book page | Printed side **down**, the **same edge** goes in first |
| **4×6** (single card) | Side to side, like a book page | Printed side **down**, the **same edge** goes in first |
| **4×6 ×2** (landscape) | **End over end** | Printed side **down**, the edge that came out **last** goes in **first** |

4×6 ×2 is different because the printer feeds 4×6 paper short edge first and rotates the landscape page, so the page's left-to-right direction runs along the feed direction.

The guided workflow in Print Preview and the PNG export message show the right steps for the selected layout.

**Test on plain paper first:** print the fronts, pencil a small arrow on the blank side pointing at the edge you're about to feed in, print the backs, then hold the sheet up to a light. Each back should sit directly behind its front. If the backs land in swapped positions, use the other flip. Expect about 1/32"–1/16" of drift, which is normal for manual duplex; the optional card border bleed helps hide it.

### Card Dimensions

- **Card size**: 2.5" x 3.5" (standard trading card)
- **Sheet sizes**:
  - Letter 8.5" x 11": 3 x 3 grid (9 cards)
  - 4×6 photo paper: 1 card centered
  - 4×6 ×2: landscape 6" x 4", 2 cards side by side
- **Cutting buffer**: 0.125" (1/8") gap between cards
- **Recommended format**: PNG (lossless quality, crisp text and graphics)

## Design System

Matches the ProCard ecosystem aesthetic:

- **Background**: `#0f172a` (Tailwind slate-900)
- **Text**: `#f8fafc` (Tailwind slate-50)
- **Accent**: `#22d3ee` (Tailwind cyan-400) - used for "LEGENDS" in the title
- **Headings font**: Teko (bold, uppercase)
- **Body font**: Inter

## Browser Compatibility

- Chrome / Edge (recommended)
- Firefox
- Safari

Requires JavaScript enabled and support for CSS Grid, 3D Transforms, and the Drag and Drop API.

## License

See LICENSE.txt for complete terms.
