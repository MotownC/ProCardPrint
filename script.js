// State management
let uploadedCards = [];
let cardSlots = Array(9).fill(null);
let cardBacks = Array(9).fill(null); // Store back images for each slot
let currentSlotForBack = null; // Track which slot is getting a back
let showCardBorders = false; // Toggle for thin black card borders

// DOM Elements
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const cardThumbnails = document.getElementById('cardThumbnails');
const printSheet = document.getElementById('printSheet');
const backSheet = document.getElementById('backSheet');
const layoutTabs = document.getElementById('layoutTabs');
const clearBtn = document.getElementById('clearBtn');
const printPreviewBtn = document.getElementById('printPreviewBtn');
const generatePdfBtn = document.getElementById('generatePdfBtn');
const cardCount = document.getElementById('cardCount');
const backCardModal = document.getElementById('backCardModal');
const uploadBackBtn = document.getElementById('uploadBackBtn');
const skipBackBtn = document.getElementById('skipBackBtn');
const backFileInput = document.getElementById('backFileInput');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    updateCardCount();
});

// Setup Event Listeners
function setupEventListeners() {
    // Upload zone click
    uploadZone.addEventListener('click', () => fileInput.click());

    // File input change
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop on upload zone
    uploadZone.addEventListener('dragover', handleDragOver);
    uploadZone.addEventListener('dragleave', handleDragLeave);
    uploadZone.addEventListener('drop', handleDrop);

    // Clear button
    clearBtn.addEventListener('click', clearAll);

    // Print Preview button
    printPreviewBtn.addEventListener('click', openPrintPreview);

    // Generate PDF dropdown toggle
    generatePdfBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = document.getElementById('pdfDropdownMenu');
        menu.classList.toggle('open');
    });

    // Close dropdown when clicking elsewhere
    document.addEventListener('click', () => {
        const menu = document.getElementById('pdfDropdownMenu');
        menu.classList.remove('open');
    });

    // Setup card slots for drag and drop (only on front sheet)
    const frontSlots = printSheet.querySelectorAll('.card-slot');
    frontSlots.forEach((slot, index) => {
        slot.addEventListener('dragover', handleSlotDragOver);
        slot.addEventListener('dragleave', handleSlotDragLeave);
        slot.addEventListener('drop', (e) => handleSlotDrop(e, index));
    });

    // Back card modal events
    uploadBackBtn.addEventListener('click', () => backFileInput.click());
    skipBackBtn.addEventListener('click', closeBackModal);
    backFileInput.addEventListener('change', handleBackFileSelect);

    // Card border toggle
    const borderToggle = document.getElementById('cardBorderToggle');
    borderToggle.addEventListener('change', (e) => {
        showCardBorders = e.target.checked;
        printSheet.classList.toggle('show-card-borders', showCardBorders);
        backSheet.classList.toggle('show-card-borders', showCardBorders);
    });

    // Layout tab events
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => switchLayout(btn.dataset.layout));
    });
}

// Switch between front and back layouts
function switchLayout(layout) {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.layout === layout);
    });

    if (layout === 'front') {
        printSheet.style.display = 'grid';
        backSheet.style.display = 'none';
    } else {
        printSheet.style.display = 'none';
        backSheet.style.display = 'grid';
    }
}

// Handle file selection
function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    files.forEach(file => {
        if (file.type.startsWith('image/')) {
            addCardToLibrary(file);
        }
    });
    fileInput.value = ''; // Reset input
}

// Handle drag over upload zone
function handleDragOver(e) {
    e.preventDefault();
    uploadZone.classList.add('dragover');
}

// Handle drag leave upload zone
function handleDragLeave(e) {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
}

// Handle drop on upload zone
function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.classList.remove('dragover');

    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => {
        if (file.type.startsWith('image/')) {
            addCardToLibrary(file);
        }
    });
}

// Add card to library
function addCardToLibrary(file) {
    const reader = new FileReader();

    reader.onload = (e) => {
        const cardData = {
            id: Date.now() + Math.random(),
            src: e.target.result,
            name: file.name
        };

        uploadedCards.push(cardData);
        renderThumbnails();
    };

    reader.readAsDataURL(file);
}

// Render thumbnails
function renderThumbnails() {
    cardThumbnails.innerHTML = '';

    uploadedCards.forEach((card) => {
        const thumbnail = document.createElement('div');
        thumbnail.className = 'thumbnail';
        thumbnail.draggable = true;
        thumbnail.dataset.cardId = card.id;

        const img = document.createElement('img');
        img.src = card.src;
        img.alt = card.name;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '×';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            removeCardFromLibrary(card.id);
        };

        thumbnail.appendChild(img);
        thumbnail.appendChild(removeBtn);
        cardThumbnails.appendChild(thumbnail);

        // Drag events for thumbnails
        thumbnail.addEventListener('dragstart', handleThumbnailDragStart);
        thumbnail.addEventListener('dragend', handleThumbnailDragEnd);
    });
}

// Handle thumbnail drag start
function handleThumbnailDragStart(e) {
    e.dataTransfer.effectAllowed = 'copy';
    // Get the thumbnail div, not the img inside it
    const thumbnail = e.target.closest('.thumbnail');
    e.dataTransfer.setData('cardId', thumbnail.dataset.cardId);
    thumbnail.classList.add('dragging');
}

// Handle thumbnail drag end
function handleThumbnailDragEnd(e) {
    const thumbnail = e.target.closest('.thumbnail');
    thumbnail.classList.remove('dragging');
}

// Handle slot drag over
function handleSlotDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
}

// Handle slot drag leave
function handleSlotDragLeave(e) {
    e.currentTarget.classList.remove('dragover');
}

// Handle slot drop
function handleSlotDrop(e, slotIndex) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');

    // Check if dropping a file directly
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
            // Read the file and place directly in slot
            const reader = new FileReader();
            reader.onload = (event) => {
                const cardData = {
                    id: Date.now() + Math.random(),
                    src: event.target.result,
                    name: file.name
                };

                // Check if this exact image already exists in library (by src)
                const existingCard = uploadedCards.find(c => c.src === cardData.src);
                if (existingCard) {
                    // Use existing card instead of adding duplicate
                    placeCardInSlot(existingCard, slotIndex);
                } else {
                    // Add to library and place in slot
                    uploadedCards.push(cardData);
                    renderThumbnails();
                    placeCardInSlot(cardData, slotIndex);
                }
            };
            reader.readAsDataURL(file);
        }
        return;
    }

    // Otherwise, check if dropping from thumbnail library
    const cardId = e.dataTransfer.getData('cardId');
    const card = uploadedCards.find(c => c.id == cardId);

    if (card) {
        placeCardInSlot(card, slotIndex);
    }
}

// Place card in slot
function placeCardInSlot(card, slotIndex) {
    cardSlots[slotIndex] = card;
    renderSlots();
    updateCardCount();

    // Show modal to ask about back card
    showBackCardModal(slotIndex);
}

// Show back card modal
function showBackCardModal(slotIndex) {
    currentSlotForBack = slotIndex;
    backCardModal.classList.add('active');
}

// Close back card modal
function closeBackModal() {
    backCardModal.classList.remove('active');
    currentSlotForBack = null;
}

// Handle back file selection
function handleBackFileSelect(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();

        reader.onload = (event) => {
            cardBacks[currentSlotForBack] = event.target.result;
            renderSlots();
            closeBackModal();
        };

        reader.readAsDataURL(file);
    }
    backFileInput.value = ''; // Reset input
    e.stopPropagation(); // Prevent event bubbling
}

// Render slots
function renderSlots() {
    // Render front sheet
    renderSheet(printSheet, false);

    // Render back sheet
    renderSheet(backSheet, true);

    // Show tabs bar when any cards are placed (for border toggle access)
    const hasAnyCards = cardSlots.some(slot => slot !== null);
    const hasAnyBacks = cardBacks.some(back => back !== null);
    layoutTabs.style.display = hasAnyCards ? 'flex' : 'none';

    // Show/hide Back Layout tab based on whether any cards have backs
    const backTab = layoutTabs.querySelector('[data-layout="back"]');
    if (backTab) {
        backTab.style.display = hasAnyBacks ? '' : 'none';
    }
}

// Render a sheet (front or back)
function renderSheet(sheetElement, isBackSheet) {
    const slots = sheetElement.querySelectorAll('.card-slot');

    slots.forEach((slot, index) => {
        let card, back;

        if (isBackSheet) {
            // For back sheet, mirror the positions
            const row = Math.floor(index / 3);
            const col = index % 3;
            const mirroredCol = 2 - col;
            const mirroredIndex = row * 3 + mirroredCol;

            card = cardSlots[mirroredIndex];
            back = cardBacks[mirroredIndex];
        } else {
            // Front sheet uses normal positions
            card = cardSlots[index];
            back = cardBacks[index];
        }

        const hasBack = back !== null;

        // Clear slot content except slot number
        const slotNumber = slot.querySelector('.slot-number');
        slot.innerHTML = '';
        slot.appendChild(slotNumber);

        if (card) {
            slot.classList.add('filled');

            // For back sheet, show the back image directly (no flip container needed)
            if (isBackSheet && hasBack) {
                const img = document.createElement('img');
                img.src = back;
                img.alt = `${card.name} back`;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                slot.appendChild(img);
            } else if (!isBackSheet) {
                // Front sheet: create flip container
                const flipContainer = document.createElement('div');
                flipContainer.className = 'card-flip-container';
                if (!hasBack) {
                    flipContainer.classList.add('no-back');
                }

                // Front face
                const frontFace = document.createElement('div');
                frontFace.className = 'card-face card-front-face';
                const frontImg = document.createElement('img');
                frontImg.src = card.src;
                frontImg.alt = card.name;
                frontFace.appendChild(frontImg);
                flipContainer.appendChild(frontFace);

                // Back face (if exists)
                if (hasBack) {
                    const backFace = document.createElement('div');
                    backFace.className = 'card-face card-back-face';
                    const backImg = document.createElement('img');
                    backImg.src = back;
                    backImg.alt = `${card.name} back`;
                    backFace.appendChild(backImg);
                    flipContainer.appendChild(backFace);

                    // Add flip hint
                    const flipHint = document.createElement('div');
                    flipHint.className = 'flip-hint';
                    flipHint.textContent = 'Click to flip';
                    slot.appendChild(flipHint);

                    // Add click handler for flip
                    flipContainer.addEventListener('click', (e) => {
                        if (e.target.closest('.remove-card')) {
                            return;
                        }
                        flipContainer.classList.toggle('flipped');
                    });
                } else {
                    // No back yet - add a button to upload back
                    const addBackBtn = document.createElement('button');
                    addBackBtn.className = 'add-back-btn';
                    addBackBtn.textContent = '+ Add Back';
                    addBackBtn.onclick = (e) => {
                        e.stopPropagation();
                        currentSlotForBack = index;
                        backCardModal.classList.add('active');
                    };
                    slot.appendChild(addBackBtn);
                }

                slot.appendChild(flipContainer);

                // Remove button (only on front sheet)
                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-card';
                removeBtn.innerHTML = '×';
                removeBtn.onclick = (e) => {
                    e.stopPropagation();
                    removeCardFromSlot(index);
                };
                slot.appendChild(removeBtn);

                // Show indicator if card has a back
                if (hasBack) {
                    const backIndicator = document.createElement('div');
                    backIndicator.className = 'back-indicator';
                    backIndicator.textContent = 'Has Back';
                    slot.appendChild(backIndicator);
                }
            }
        } else {
            slot.classList.remove('filled');
        }
    });
}

// Remove card from library
function removeCardFromLibrary(cardId) {
    uploadedCards = uploadedCards.filter(c => c.id !== cardId);

    // Also remove from slots if placed
    cardSlots = cardSlots.map(slot => {
        if (slot && slot.id === cardId) return null;
        return slot;
    });

    renderThumbnails();
    renderSlots();
    updateCardCount();
}

// Remove card from slot
function removeCardFromSlot(slotIndex) {
    cardSlots[slotIndex] = null;
    cardBacks[slotIndex] = null; // Also remove back if present
    renderSlots();
    updateCardCount();
}

// Clear all
function clearAll() {
    if (confirm('Are you sure you want to clear all cards?')) {
        uploadedCards = [];
        cardSlots = Array(9).fill(null);
        cardBacks = Array(9).fill(null);
        renderThumbnails();
        renderSlots();
        updateCardCount();
    }
}

// Update card count
function updateCardCount() {
    const placedCount = cardSlots.filter(slot => slot !== null).length;
    cardCount.textContent = `${placedCount} of 9 cards placed`;

    // Enable/disable buttons
    generatePdfBtn.disabled = placedCount === 0;
    printPreviewBtn.disabled = placedCount === 0;
}

// Open Print Preview
function openPrintPreview() {
    const placedCount = cardSlots.filter(slot => slot !== null).length;

    if (placedCount === 0) {
        alert('Please place at least one card on the sheet before previewing.');
        return;
    }

    const hasAnyBacks = cardBacks.some(back => back !== null);

    // Create print preview window
    const previewWindow = window.open('', 'Print Preview', 'width=900,height=1100');

    // Build HTML for print preview
    let html = `
<!DOCTYPE html>
<html>
<head>
    <title>ProCard Legends Print Preview</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Teko:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', sans-serif;
            background: #f1f5f9;
            padding: 2rem;
        }

        .controls {
            max-width: 8.5in;
            margin: 0 auto 1.5rem;
            text-align: center;
        }

        .controls h1 {
            font-family: 'Teko', sans-serif;
            font-size: 2rem;
            color: #0f172a;
            margin-bottom: 1rem;
        }

        .view-toggle {
            display: flex;
            gap: 0.5rem;
            justify-content: center;
            margin-bottom: 1rem;
        }

        .view-toggle button {
            padding: 0.5rem 1rem;
            border: 2px solid #cbd5e1;
            background: white;
            color: #64748b;
            border-radius: 6px;
            font-family: 'Inter', sans-serif;
            font-size: 0.9rem;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .view-toggle button.active {
            background: #3b82f6;
            border-color: #3b82f6;
            color: white;
        }

        .print-buttons {
            display: flex;
            gap: 0.75rem;
            justify-content: center;
            flex-wrap: wrap;
        }

        .btn {
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 8px;
            font-family: 'Teko', sans-serif;
            font-size: 1.1rem;
            text-transform: uppercase;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .btn-primary {
            background: #3b82f6;
            color: white;
        }

        .btn-primary:hover {
            background: #2563eb;
        }

        .btn-secondary {
            background: #64748b;
            color: white;
        }

        .btn-secondary:hover {
            background: #475569;
        }

        .page {
            width: 8.5in;
            height: 11in;
            background: white;
            margin: 0 auto 2rem;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            position: relative;
            page-break-after: always;
        }

        .page:last-child {
            margin-bottom: 0;
        }

        .card-grid {
            position: absolute;
            top: 0.125in;
            left: 50%;
            transform: translateX(-50%);
            display: grid;
            grid-template-columns: repeat(3, 2.5in);
            grid-template-rows: repeat(3, 3.5in);
            gap: 0.125in;
        }

        .card {
            width: 2.5in;
            height: 3.5in;
            border: 1px solid #e2e8f0;
        }

        .card-grid.has-border {
            background: #000000;
            padding: 0.125in;
        }

        .card img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }

        .page-label {
            position: absolute;
            top: 0.5in;
            left: 0.5in;
            font-family: 'Teko', sans-serif;
            font-size: 1.2rem;
            color: #64748b;
            text-transform: uppercase;
        }

        @media print {
            body {
                background: white;
                padding: 0;
            }

            .controls {
                display: none;
            }

            .page {
                margin: 0;
                box-shadow: none;
                page-break-after: always;
            }

            .page:last-child {
                page-break-after: auto;
            }

            .page-label {
                display: none;
            }
        }
        .page.hidden {
            display: none;
        }

        @media print {
            .page.hidden {
                display: none !important;
            }
        }
    </style>
</head>
<body>
    <div class="controls">
        <h1>Print Preview - ${hasAnyBacks ? '2 Pages' : '1 Page'}</h1>

        ${hasAnyBacks ? `
        <div class="view-toggle">
            <button class="active" onclick="filterView('both')">Show Both</button>
            <button onclick="filterView('front')">Front Only</button>
            <button onclick="filterView('back')">Back Only</button>
        </div>
        ` : ''}

        <div class="print-buttons">
            ${hasAnyBacks ? `
            <button class="btn btn-primary" onclick="startGuidedPrint()">Guided Double-Sided Print</button>
            ` : ''}
            <button class="btn ${hasAnyBacks ? 'btn-secondary' : 'btn-primary'}" onclick="printPage('front')">Print Front${hasAnyBacks ? 's' : ''} Only</button>
            ${hasAnyBacks ? `
            <button class="btn btn-secondary" onclick="printPage('back')">Print Backs Only</button>
            ` : ''}
        </div>
    </div>

    <!-- Page 1: Fronts -->
    <div class="page" id="frontPage">
        <div class="page-label">Page 1 - Card Fronts</div>
        <div class="card-grid${showCardBorders ? ' has-border' : ''}">
`;

    // Add front cards
    for (let i = 0; i < 9; i++) {
        const card = cardSlots[i];
        if (card) {
            html += `<div class="card"><img src="${card.src}" alt="Card ${i + 1}"></div>`;
        } else {
            html += `<div class="card"></div>`;
        }
    }

    html += `
        </div>
    </div>
`;

    // Add page 2 if there are backs
    if (hasAnyBacks) {
        html += `
    <!-- Page 2: Backs (Mirrored) -->
    <div class="page" id="backPage">
        <div class="page-label">Page 2 - Card Backs (Mirrored for Double-Sided)</div>
        <div class="card-grid${showCardBorders ? ' has-border' : ''}">
`;

        // Add back cards (mirrored)
        for (let i = 0; i < 9; i++) {
            const row = Math.floor(i / 3);
            const col = i % 3;
            const mirroredCol = 2 - col;
            const mirroredIndex = row * 3 + mirroredCol;

            const back = cardBacks[mirroredIndex];
            if (back) {
                html += `<div class="card"><img src="${back}" alt="Card ${mirroredIndex + 1} back"></div>`;
            } else {
                html += `<div class="card"></div>`;
            }
        }

        html += `
        </div>
    </div>
`;
    }

    html += `
    <script>
        function filterView(view) {
            const frontPage = document.getElementById('frontPage');
            const backPage = document.getElementById('backPage');
            const buttons = document.querySelectorAll('.view-toggle button');

            buttons.forEach(btn => {
                btn.classList.remove('active');
            });

            if (view === 'both') {
                frontPage.classList.remove('hidden');
                if (backPage) backPage.classList.remove('hidden');
                buttons[0].classList.add('active');
            } else if (view === 'front') {
                frontPage.classList.remove('hidden');
                if (backPage) backPage.classList.add('hidden');
                buttons[1].classList.add('active');
            } else if (view === 'back') {
                frontPage.classList.add('hidden');
                if (backPage) backPage.classList.remove('hidden');
                buttons[2].classList.add('active');
            }
        }

        function printPage(page) {
            const frontPage = document.getElementById('frontPage');
            const backPage = document.getElementById('backPage');

            if (page === 'front') {
                frontPage.classList.remove('hidden');
                if (backPage) backPage.classList.add('hidden');
            } else if (page === 'back') {
                frontPage.classList.add('hidden');
                if (backPage) backPage.classList.remove('hidden');
            }

            window.print();

            // Restore view
            setTimeout(() => {
                frontPage.classList.remove('hidden');
                if (backPage) backPage.classList.remove('hidden');
            }, 100);
        }

        function startGuidedPrint() {
            if (confirm('Step 1 of 2: Ready to print the FRONT side?\\n\\nClick OK to open the print dialog for fronts.')) {
                printPage('front');

                setTimeout(() => {
                    const flipInstructions = 'Step 2 of 2: Print the BACK side\\n\\n' +
                        '1. Remove the printed sheet from the output tray\\n' +
                        '2. Flip it over (like turning a page in a book)\\n' +
                        '3. Place it back in the input tray\\n\\n' +
                        'Ready to print the backs?';

                    if (confirm(flipInstructions)) {
                        printPage('back');
                        setTimeout(() => {
                            alert('Double-sided printing complete! ✓');
                        }, 500);
                    }
                }, 1000);
            }
        }
    </script>
</body>
</html>
`;

    previewWindow.document.write(html);
    previewWindow.document.close();
}

// Generate PDF
async function generatePDF(mode) {
    // Close dropdown
    document.getElementById('pdfDropdownMenu').classList.remove('open');

    const placedCount = cardSlots.filter(slot => slot !== null).length;
    const hasAnyBacks = cardBacks.some(back => back !== null);

    if (placedCount === 0) {
        alert('Please place at least one card on the sheet before generating PDF.');
        return;
    }

    if (mode === 'back' && !hasAnyBacks) {
        alert('No card backs have been added yet.');
        return;
    }

    // Show loading state
    const originalText = generatePdfBtn.textContent;
    generatePdfBtn.textContent = 'Generating...';
    generatePdfBtn.disabled = true;

    try {
        const { jsPDF } = window.jspdf;

        // Create PDF in letter size (8.5 x 11 inches)
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'in',
            format: 'letter'
        });

        // Card dimensions in inches
        const cardWidth = 2.5;
        const cardHeight = 3.5;

        // Spacing between cards in inches (0.125" = 1/8 inch for cutting buffer)
        const spacing = 0.125;

        // Calculate margins to center the 3x3 grid with spacing
        const totalWidth = (cardWidth * 3) + (spacing * 2);
        const totalHeight = (cardHeight * 3) + (spacing * 2);
        const marginX = (8.5 - totalWidth) / 2;
        const marginY = (11 - totalHeight) / 2;

        let needsNewPage = false;

        // Helper: draw black border background behind card grid
        function drawBorderBackground() {
            if (showCardBorders) {
                pdf.setFillColor(0, 0, 0);
                pdf.rect(
                    marginX - spacing, marginY - spacing,
                    totalWidth + spacing * 2, totalHeight + spacing * 2, 'F'
                );
            }
        }

        // Card fronts
        if (mode === 'front' || mode === 'both') {
            drawBorderBackground();
            for (let i = 0; i < cardSlots.length; i++) {
                const card = cardSlots[i];
                if (card) {
                    const row = Math.floor(i / 3);
                    const col = i % 3;

                    const x = marginX + (col * (cardWidth + spacing));
                    const y = marginY + (row * (cardHeight + spacing));

                    try {
                        pdf.addImage(card.src, 'JPEG', x, y, cardWidth, cardHeight);
                    } catch (error) {
                        console.error(`Error adding card ${i}:`, error);
                    }
                }
            }
            needsNewPage = true;
        }

        // Card backs (mirrored horizontally for double-sided printing)
        if ((mode === 'back' || mode === 'both') && hasAnyBacks) {
            if (needsNewPage) {
                pdf.addPage('letter', 'portrait');
            }
            drawBorderBackground();

            for (let i = 0; i < cardBacks.length; i++) {
                const back = cardBacks[i];
                if (back) {
                    const row = Math.floor(i / 3);
                    const col = i % 3;

                    // Mirror the column: 0->2, 1->1, 2->0
                    const mirroredCol = 2 - col;

                    const x = marginX + (mirroredCol * (cardWidth + spacing));
                    const y = marginY + (row * (cardHeight + spacing));

                    try {
                        pdf.addImage(back, 'JPEG', x, y, cardWidth, cardHeight);
                    } catch (error) {
                        console.error(`Error adding back for card ${i}:`, error);
                    }
                }
            }
        }

        // Save PDF with descriptive filename
        const timestamp = new Date().toISOString().slice(0, 10);
        const suffix = mode === 'front' ? '-fronts' : mode === 'back' ? '-backs' : '';
        pdf.save(`trading-cards${suffix}-${timestamp}.pdf`);

        const modeLabel = mode === 'front' ? 'fronts' : mode === 'back' ? 'backs' : 'front + back';
        alert(`PDF generated (${modeLabel})! ${placedCount} card(s) included.`);
    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Error generating PDF. Please try again.');
    } finally {
        // Restore button state
        generatePdfBtn.textContent = 'Export ▾';
        updateCardCount();
    }
}

// Export as 300 DPI PNG for Photoshop
async function exportPNG(mode) {
    // Close dropdown
    document.getElementById('pdfDropdownMenu').classList.remove('open');

    const placedCount = cardSlots.filter(slot => slot !== null).length;
    const hasAnyBacks = cardBacks.some(back => back !== null);

    if (placedCount === 0) {
        alert('Please place at least one card on the sheet before exporting.');
        return;
    }

    if (mode === 'back' && !hasAnyBacks) {
        alert('No card backs have been added yet.');
        return;
    }

    // Show loading state
    const originalText = generatePdfBtn.textContent;
    generatePdfBtn.textContent = 'Exporting...';
    generatePdfBtn.disabled = true;

    try {
        // 300 DPI: 8.5" x 11" = 2550 x 3300 pixels
        const DPI = 300;
        const pageW = 8.5 * DPI;  // 2550
        const pageH = 11 * DPI;   // 3300

        const cardW = 2.5 * DPI;  // 750
        const cardH = 3.5 * DPI;  // 1050
        const gap = 0.125 * DPI;  // 37.5

        const totalW = (cardW * 3) + (gap * 2);
        const totalH = (cardH * 3) + (gap * 2);
        const offsetX = (pageW - totalW) / 2;
        const offsetY = (pageH - totalH) / 2;

        const canvas = document.createElement('canvas');
        canvas.width = pageW;
        canvas.height = pageH;
        const ctx = canvas.getContext('2d');

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageW, pageH);

        // Draw black border background behind card grid
        if (showCardBorders) {
            ctx.fillStyle = '#000000';
            ctx.fillRect(
                offsetX - gap, offsetY - gap,
                totalW + gap * 2, totalH + gap * 2
            );
        }

        // Load and draw card images
        const drawCard = (src, col, row) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    const x = offsetX + (col * (cardW + gap));
                    const y = offsetY + (row * (cardH + gap));
                    ctx.drawImage(img, x, y, cardW, cardH);
                    resolve();
                };
                img.onerror = () => resolve();
                img.src = src;
            });
        };

        const promises = [];

        if (mode === 'front') {
            for (let i = 0; i < cardSlots.length; i++) {
                const card = cardSlots[i];
                if (card) {
                    const row = Math.floor(i / 3);
                    const col = i % 3;
                    promises.push(drawCard(card.src, col, row));
                }
            }
        } else if (mode === 'back') {
            for (let i = 0; i < cardBacks.length; i++) {
                const back = cardBacks[i];
                if (back) {
                    const row = Math.floor(i / 3);
                    const col = i % 3;
                    const mirroredCol = 2 - col;
                    promises.push(drawCard(back, mirroredCol, row));
                }
            }
        }

        await Promise.all(promises);

        // Download as PNG
        const timestamp = new Date().toISOString().slice(0, 10);
        const suffix = mode === 'front' ? '-fronts' : '-backs';
        const link = document.createElement('a');
        link.download = `trading-cards${suffix}-300dpi-${timestamp}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        alert(`PNG exported (${mode}s) at 300 DPI — 2550×3300px.\nOpen in Photoshop for 8.5" × 11" print-ready layout.`);
    } catch (error) {
        console.error('Error exporting PNG:', error);
        alert('Error exporting PNG. Please try again.');
    } finally {
        generatePdfBtn.textContent = 'Export ▾';
        updateCardCount();
    }
}
