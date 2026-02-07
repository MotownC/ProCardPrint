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

This app is optimized for the Canon Pro-200s inkjet photo printer:

1. Open the print preview or generated PDF
2. Select **Canon PRO-200 series** as the destination
3. Paper size: **Letter (8.5" x 11")**
4. Scaling: **Actual Size / 100%** (do not fit to page)
5. Color: **Color**
6. Paper type: Use high-quality photo paper for best results
7. Color management: **Printer Manages Colors**

### Double-Sided Printing

The back layout is automatically **mirrored horizontally** so that when you flip the printed sheet, each card back aligns with its front. The guided workflow walks you through:

1. Print the front side
2. Remove the sheet from the output tray
3. Flip it over (like turning a page in a book)
4. Place it back in the input tray
5. Print the back side

### Card Dimensions

- **Card size**: 2.5" x 3.5" (standard trading card)
- **Sheet size**: 8.5" x 11" (US Letter)
- **Grid**: 3 columns x 3 rows (9 cards per sheet)
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
