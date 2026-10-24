// State management
let uploadedCards = [];
let cardSlots = Array(9).fill(null);
let cardBacks = Array(9).fill(null); // Store back images for each slot
let cardBleeds = Array(9).fill(null); // Cached bleed image (data URL) for each front card
let cardBackBleeds = Array(9).fill(null); // Cached bleed image (data URL) for each back image
let currentSlotForBack = null; // Track which slot is getting a back
let flippedSlots = new Set(); // Front-sheet slots currently flipped to show their back (survives re-renders)
let showCardBorders = false; // Toggle for card borders (color-matched to card edges)
let brightenSheet = false; // Toggle: show/export every image on the sheet brightened (+40)
let paperSize = 'letter'; // 'letter', '4x6' (single centered card) or '4x6-2up' (two cards, landscape)

// Page layouts in inches. 4x6-2up is a landscape 6"x4" page with two cards side by side.
// flip: how to turn the sheet over for the back side. The back is mirrored left-to-right on the
// page, so portrait pages flip side-to-side; the landscape 4x6-2up page is fed short edge first
// (rotated 90°), so its left-to-right axis runs along the feed direction and it flips end-over-end.
// markLenTB (optional) shortens the top/bottom cut ticks; 4x6-2up cards sit only 0.25" from
// the top/bottom edges (0.1875" with border bleed), so 0.15" ticks stay clear of the picture.
const PAPER_LAYOUTS = {
    letter:    { pageW: 8.5, pageH: 11, cols: 3, rows: 3, flip: 'side', markLen: 0.5,  label: '8.5" × 11"',     fileSuffix: '' },
    '4x6':     { pageW: 4,   pageH: 6,  cols: 1, rows: 1, flip: 'side', markLen: 0.35, label: '4" × 6"',        fileSuffix: '-4x6' },
    '4x6-2up': { pageW: 6,   pageH: 4,  cols: 2, rows: 1, flip: 'end',  markLen: 0.35, markLenTB: 0.15, label: '6" × 4" (2-up)', fileSuffix: '-4x6-2up' }
};

function getLayout() {
    const layout = PAPER_LAYOUTS[paperSize];
    return { ...layout, markLenTB: layout.markLenTB ?? layout.markLen, slots: layout.cols * layout.rows, isLetter: paperSize === 'letter' };
}

// Step-by-step instructions for reloading the printed sheet to print the backs
function getFlipInstructions() {
    const turn = getLayout().flip === 'end'
        ? 'Turn it over END OVER END: the edge that came out LAST goes in FIRST'
        : 'Turn it over SIDE TO SIDE (like a book page): the SAME edge goes in first again';
    return [
        'Take the printed sheet from the output tray',
        turn,
        'Load it in the rear tray with the printed side DOWN (blank side facing up)',
        'Use the same print settings as the fronts (100% scale, borderless off)'
    ];
}

// Slot index whose card sits at position i on the horizontally mirrored back sheet
function mirrorIndex(i, cols) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    return row * cols + (cols - 1 - col);
}

// Bleed added beyond the card on each side when the border toggle is on (inches)
const BLEED_IN = 0.0625;

// Build a bleed image: the card drawn at 2.5"x3.5" with its outer pixels mirrored outward
// by BLEED_IN on every side, so the border reads as a continuation of the card's edge.
// The result covers (2.5 + 2*BLEED_IN) x (3.5 + 2*BLEED_IN) inches; the card is drawn on top of it.
function createBleedImage(src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            try {
                const DPI = 320; // 0.0625" = 20px exactly
                const W = 2.5 * DPI, H = 3.5 * DPI, bp = BLEED_IN * DPI;
                const canvas = document.createElement('canvas');
                canvas.width = W + bp * 2;
                canvas.height = H + bp * 2;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, bp, bp, W, H);

                // Mirror the left/right edge columns outward
                ctx.setTransform(-1, 0, 0, 1, 2 * bp, 0);
                ctx.drawImage(canvas, bp, bp, bp, H, bp, bp, bp, H);
                ctx.setTransform(-1, 0, 0, 1, 2 * (bp + W), 0);
                ctx.drawImage(canvas, W, bp, bp, H, W, bp, bp, H);

                // Mirror the top/bottom edge rows outward (full width, which fills the corners too)
                ctx.setTransform(1, 0, 0, -1, 0, 2 * bp);
                ctx.drawImage(canvas, 0, bp, canvas.width, bp, 0, bp, canvas.width, bp);
                ctx.setTransform(1, 0, 0, -1, 0, 2 * (bp + H));
                ctx.drawImage(canvas, 0, H, canvas.width, bp, 0, H, canvas.width, bp);

                resolve(canvas.toDataURL('image/jpeg', 0.92));
            } catch (err) {
                console.error('createBleedImage failed:', err);
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

// Rotate an image 90° clockwise; returns a lossless PNG data URL
function rotateImage90(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalHeight;
            canvas.height = img.naturalWidth;
            const ctx = canvas.getContext('2d');
            ctx.translate(canvas.width, 0);
            ctx.rotate(Math.PI / 2);
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = src;
    });
}

// Brighten an image like a Photoshop Brightness/Contrast layer at Brightness +40 (non-legacy):
// a tone curve that lifts midtones (128 -> ~156) while keeping pure black and white fixed,
// so highlights don't clip. Returns a lossless PNG data URL.
const BRIGHTNESS = 40;
function brightenImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const gamma = 1 / (1 + BRIGHTNESS / 100);
            const lut = new Uint8ClampedArray(256);
            for (let v = 0; v < 256; v++) lut[v] = Math.round(255 * Math.pow(v / 255, gamma));
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const px = data.data;
            for (let p = 0; p < px.length; p += 4) {
                px[p] = lut[px[p]];
                px[p + 1] = lut[px[p + 1]];
                px[p + 2] = lut[px[p + 2]];
            }
            ctx.putImageData(data, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = src;
    });
}

// Brightened copies of sheet images (original data URL -> brightened PNG), kept apart from the
// originals so unchecking the Brighten toggle restores them exactly
const brightCache = new Map();

// The image to display/export for src: its brightened copy while the Brighten toggle is on
function shown(src) {
    return brightenSheet && src ? brightCache.get(src) ?? src : src;
}

function sheetImages() {
    return [...cardSlots.map(card => card?.src), ...cardBacks, ...cardBleeds, ...cardBackBleeds].filter(Boolean);
}

// Brighten every image on the sheet (fronts, backs, bleeds) that isn't cached yet; drops stale entries
async function ensureBrightened() {
    if (!brightenSheet) return;
    const current = new Set(sheetImages());
    for (const src of brightCache.keys()) if (!current.has(src)) brightCache.delete(src);
    for (const src of current) {
        if (brightCache.has(src)) continue;
        try {
            brightCache.set(src, await brightenImage(src));
        } catch (err) {
            console.error('Brighten failed:', err);
            brightCache.set(src, src);
        }
    }
}

// Rotate a placed card's front (or its back) 90° clockwise; only this slot is affected
async function rotateSlotImage(slotIndex, isBack) {
    try {
        if (isBack) {
            cardBacks[slotIndex] = await rotateImage90(cardBacks[slotIndex]);
            cardBackBleeds[slotIndex] = await createBleedImage(cardBacks[slotIndex]);
        } else {
            const card = cardSlots[slotIndex];
            cardSlots[slotIndex] = { ...card, src: await rotateImage90(card.src) };
            cardBleeds[slotIndex] = await createBleedImage(cardSlots[slotIndex].src);
        }
        renderSlots();
    } catch (err) {
        console.error('Rotate failed:', err);
        showAlert('Could not rotate this image.', 'error');
    }
}

// isBack: true/false for a fixed side, or null to rotate whichever side is showing (front sheet flip)
function createRotateButton(slotIndex, isBack) {
    const rotateBtn = document.createElement('button');
    rotateBtn.className = 'rotate-card';
    rotateBtn.innerHTML = '↻';
    rotateBtn.title = isBack === null ? 'Rotate the side showing 90°' : isBack ? 'Rotate back 90°' : 'Rotate card 90°';
    rotateBtn.onclick = (e) => {
        e.stopPropagation();
        rotateSlotImage(slotIndex, isBack ?? flippedSlots.has(slotIndex));
    };
    return rotateBtn;
}

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
const alertModal = document.getElementById('alertModal');
const alertIcon = document.getElementById('alertIcon');
const alertMessage = document.getElementById('alertMessage');
const alertOkBtn = document.getElementById('alertOkBtn');

// Themed alert modal
function showAlert(message, type = 'success') {
    const icons = { success: '✓', warning: '⚠', error: '✕' };
    alertIcon.textContent = icons[type] || icons.success;
    alertMessage.innerHTML = message.replace(/\n/g, '<br>');
    alertModal.className = 'modal active alert-' + type;
}

alertOkBtn.addEventListener('click', () => {
    alertModal.className = 'modal';
});

alertModal.addEventListener('click', (e) => {
    if (e.target === alertModal) alertModal.className = 'modal';
});

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
        renderSlots();
    });

    // Brighten toggle (whole sheet)
    document.getElementById('brightenToggle').addEventListener('change', (e) => {
        brightenSheet = e.target.checked;
        renderSlots();
    });

    // Layout tab events
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => switchLayout(btn.dataset.layout));
    });

    // Paper size toggle
    const sizeButtons = document.querySelectorAll('.paper-size-toggle .size-btn');
    sizeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            sizeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            paperSize = btn.dataset.size;
            [printSheet, backSheet].forEach(sheet => {
                sheet.classList.toggle('size-4x6', paperSize === '4x6');
                sheet.classList.toggle('size-4x6-2up', paperSize === '4x6-2up');
            });
            document.getElementById('sheetSizeLabel').textContent = getLayout().label;
            renderSlots();
            updateCardCount();
        });
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
async function placeCardInSlot(card, slotIndex) {
    cardSlots[slotIndex] = card;
    flippedSlots.delete(slotIndex);
    cardBleeds[slotIndex] = await createBleedImage(card.src);
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

        reader.onload = async (event) => {
            cardBacks[currentSlotForBack] = event.target.result;
            cardBackBleeds[currentSlotForBack] = await createBleedImage(event.target.result);
            renderSlots();
            closeBackModal();
        };

        reader.readAsDataURL(file);
    }
    backFileInput.value = ''; // Reset input
    e.stopPropagation(); // Prevent event bubbling
}

// Render slots
let brightenPending = false;

function renderSlots() {
    // Brightened copies are made asynchronously; render the originals now and again once they're ready
    if (brightenSheet && !brightenPending && sheetImages().some(src => !brightCache.has(src))) {
        brightenPending = true;
        ensureBrightened().finally(() => {
            brightenPending = false;
            renderSlots();
        });
    }

    // Render front sheet
    renderSheet(printSheet, false);

    // Render back sheet
    renderSheet(backSheet, true);

    // Add cut marks to both sheets
    renderCutMarks(printSheet);
    renderCutMarks(backSheet);

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

// Render cut marks on a print sheet (96 DPI)
function renderCutMarks(sheet) {
    // Remove existing cut marks
    sheet.querySelectorAll('.cut-mark').forEach(el => el.remove());

    // Dimensions at 96 DPI
    const cardW = 240, cardH = 336, gap = 12;
    const layout = getLayout();
    const { cols, rows } = layout;
    const gridW = cardW * cols + gap * (cols - 1);
    const gridH = cardH * rows + gap * (rows - 1);
    const sheetW = layout.pageW * 96;
    const sheetH = layout.pageH * 96;
    const mx = (sheetW - gridW) / 2;
    const my = (sheetH - gridH) / 2;
    const markLen = Math.round(layout.markLen * 96); // 4x6: ~0.35", letter: ~0.5" (survives non-borderless printer margin)
    const markLenTB = Math.round(layout.markLenTB * 96);
    const markThick = 1;

    // X positions of vertical cuts (left/right edges of each card)
    const xPositions = [];
    for (let col = 0; col < cols; col++) {
        const left = mx + col * (cardW + gap);
        xPositions.push(left);
        xPositions.push(left + cardW);
    }

    // Y positions of horizontal cuts (top/bottom edges of each card)
    const yPositions = [];
    for (let row = 0; row < rows; row++) {
        const top = my + row * (cardH + gap);
        yPositions.push(top);
        yPositions.push(top + cardH);
    }

    // Top and bottom edge tick marks (vertical lines at each x position)
    xPositions.forEach(x => {
        // Top tick
        const topMark = document.createElement('div');
        topMark.className = 'cut-mark';
        Object.assign(topMark.style, {
            position: 'absolute', left: x + 'px', top: '0px',
            width: markThick + 'px', height: markLenTB + 'px', background: '#000'
        });
        sheet.appendChild(topMark);

        // Bottom tick
        const botMark = document.createElement('div');
        botMark.className = 'cut-mark';
        Object.assign(botMark.style, {
            position: 'absolute', left: x + 'px', bottom: '0px',
            width: markThick + 'px', height: markLenTB + 'px', background: '#000'
        });
        sheet.appendChild(botMark);
    });

    // Left and right edge tick marks (horizontal lines at each y position)
    yPositions.forEach(y => {
        // Left tick
        const leftMark = document.createElement('div');
        leftMark.className = 'cut-mark';
        Object.assign(leftMark.style, {
            position: 'absolute', left: '0px', top: y + 'px',
            width: markLen + 'px', height: markThick + 'px', background: '#000'
        });
        sheet.appendChild(leftMark);

        // Right tick
        const rightMark = document.createElement('div');
        rightMark.className = 'cut-mark';
        Object.assign(rightMark.style, {
            position: 'absolute', right: '0px', top: y + 'px',
            width: markLen + 'px', height: markThick + 'px', background: '#000'
        });
        sheet.appendChild(rightMark);
    });
}


// Render a sheet (front or back)
function renderSheet(sheetElement, isBackSheet) {
    const slots = sheetElement.querySelectorAll('.card-slot');

    slots.forEach((slot, index) => {
        let card, back;
        let srcIndex = index;

        if (isBackSheet) {
            // For back sheet, mirror the positions horizontally (hidden slots keep their index)
            const { cols, slots } = getLayout();
            if (index < slots) srcIndex = mirrorIndex(index, cols);
            card = cardSlots[srcIndex];
            back = cardBacks[srcIndex];
        } else {
            // Front sheet uses normal positions
            card = cardSlots[index];
            back = cardBacks[index];
        }

        const hasBack = back !== null;

        // Clear slot content except slot number
        const slotNumber = slot.querySelector('.slot-number');
        if (isBackSheet) slotNumber.textContent = srcIndex + 1;
        slot.innerHTML = '';
        slot.appendChild(slotNumber);

        if (card) {
            slot.classList.add('filled');

            // Bleed border: the card's mirrored edges extend 6px (0.0625") behind it
            const bleed = (isBackSheet ? cardBackBleeds : cardBleeds)[srcIndex];
            if (showCardBorders && bleed) {
                const bleedDiv = document.createElement('div');
                bleedDiv.className = 'card-bleed';
                bleedDiv.style.backgroundImage = `url(${shown(bleed)})`;
                slot.appendChild(bleedDiv);
            }

            // For back sheet, show the back image directly (no flip container needed)
            if (isBackSheet && hasBack) {
                const img = document.createElement('img');
                img.src = shown(back);
                img.alt = `${card.name} back`;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                slot.appendChild(img);
                slot.appendChild(createRotateButton(srcIndex, true));
            } else if (!isBackSheet) {
                // Front sheet: create flip container
                const flipContainer = document.createElement('div');
                flipContainer.className = 'card-flip-container';
                if (!hasBack) {
                    flipContainer.classList.add('no-back');
                    flippedSlots.delete(index);
                } else if (flippedSlots.has(index)) {
                    flipContainer.classList.add('flipped');
                }

                // Front face
                const frontFace = document.createElement('div');
                frontFace.className = 'card-face card-front-face';
                const frontImg = document.createElement('img');
                frontImg.src = shown(card.src);
                frontImg.alt = card.name;
                frontFace.appendChild(frontImg);
                flipContainer.appendChild(frontFace);

                // Back face (if exists)
                if (hasBack) {
                    const backFace = document.createElement('div');
                    backFace.className = 'card-face card-back-face';
                    const backImg = document.createElement('img');
                    backImg.src = shown(back);
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
                        const isFlipped = flipContainer.classList.toggle('flipped');
                        if (isFlipped) flippedSlots.add(index); else flippedSlots.delete(index);
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
                slot.appendChild(createRotateButton(index, null));

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
    cardSlots = cardSlots.map((slot, i) => {
        if (slot && slot.id === cardId) {
            cardBleeds[i] = null;
            return null;
        }
        return slot;
    });

    renderThumbnails();
    renderSlots();
    updateCardCount();
}

// Remove card from slot
function removeCardFromSlot(slotIndex) {
    cardSlots[slotIndex] = null;
    cardBacks[slotIndex] = null;
    cardBleeds[slotIndex] = null;
    cardBackBleeds[slotIndex] = null;
    flippedSlots.delete(slotIndex);
    renderSlots();
    updateCardCount();
}

// Clear all
function clearAll() {
    if (confirm('Are you sure you want to clear all cards?')) {
        uploadedCards = [];
        cardSlots = Array(9).fill(null);
        cardBacks = Array(9).fill(null);
        cardBleeds = Array(9).fill(null);
        cardBackBleeds = Array(9).fill(null);
        flippedSlots.clear();
        renderThumbnails();
        renderSlots();
        updateCardCount();
    }
}

// Update card count
function updateCardCount() {
    const maxCards = getLayout().slots;
    const placedCount = cardSlots.slice(0, maxCards).filter(slot => slot !== null).length;
    cardCount.textContent = `${placedCount} of ${maxCards} card${maxCards > 1 ? 's' : ''} placed`;

    // Enable/disable buttons
    generatePdfBtn.disabled = placedCount === 0;
    printPreviewBtn.disabled = placedCount === 0;
}

// Generate cut mark HTML for print preview pages (in inches)
function generatePreviewCutMarks() {
    const cardW = 2.5, cardH = 3.5;
    const { cols, rows, pageW, pageH, markLen, markLenTB, isLetter } = getLayout();
    const gap = isLetter ? 0.0625 : 0.125;
    const gridW = cardW * cols + gap * (cols - 1);
    const gridH = cardH * rows + gap * (rows - 1);
    const mx = (pageW - gridW) / 2;
    const my = isLetter ? 0.25 : (pageH - gridH) / 2;
    let marks = '';

    // X positions of vertical cuts
    for (let col = 0; col < cols; col++) {
        const left = mx + col * (cardW + gap);
        const right = left + cardW;
        [left, right].forEach(x => {
            marks += `<div class="cut-mark" style="left:${x}in;top:0;width:1px;height:${markLenTB}in;"></div>`;
            marks += `<div class="cut-mark" style="left:${x}in;bottom:0;width:1px;height:${markLenTB}in;"></div>`;
        });
    }

    // Y positions of horizontal cuts
    for (let row = 0; row < rows; row++) {
        const top = my + row * (cardH + gap);
        const bottom = top + cardH;
        [top, bottom].forEach(y => {
            marks += `<div class="cut-mark" style="top:${y}in;left:0;width:${markLen}in;height:1px;"></div>`;
            marks += `<div class="cut-mark" style="top:${y}in;right:0;width:${markLen}in;height:1px;"></div>`;
        });
    }

    return marks;
}

// Open Print Preview
async function openPrintPreview() {
    await ensureBrightened();
    const layout = getLayout();
    const is4x6 = !layout.isLetter;
    const placedCount = cardSlots.slice(0, layout.slots).filter(slot => slot !== null).length;

    if (placedCount === 0) {
        showAlert(is4x6
            ? 'Please place a card on the 4×6 sheet before previewing.'
            : 'Please place at least one card on the sheet before previewing.', 'warning');
        return;
    }

    const hasAnyBacks = cardBacks.slice(0, layout.slots).some(back => back !== null);

    const pageW = layout.pageW + 'in';
    const pageH = layout.pageH + 'in';
    const gridCols = layout.cols;
    const gridRows = layout.rows;
    const totalSlots = layout.slots;

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
            max-width: ${pageW};
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
            width: ${pageW};
            height: ${pageH};
            background: white;
            margin: 0 auto 2rem;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            position: relative;
            page-break-after: always;
            overflow: hidden;
        }

        .cut-mark {
            position: absolute;
            background: #000;
        }

        .page:last-child {
            margin-bottom: 0;
        }

        .card-grid {
            position: absolute;
            ${is4x6 ? `top: 50%; left: 50%; transform: translate(-50%, -50%);` : `top: 0.25in; left: 50%; transform: translateX(-50%);`}
            display: grid;
            grid-template-columns: repeat(${gridCols}, 2.5in);
            grid-template-rows: repeat(${gridRows}, 3.5in);
            gap: ${is4x6 ? '0.125in' : '0.0625in'};
        }

        .card {
            position: relative;
            z-index: 1;
            width: 2.5in;
            height: 3.5in;
            border: 1px solid #e2e8f0;
        }

        .card-with-border {
            position: relative;
            width: 2.5in;
            height: 3.5in;
        }

        .card-border-bg {
            position: absolute;
            inset: -0.0625in;
            z-index: 0;
            background-size: 100% 100%;
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

        @page {
            size: ${pageW} ${pageH};
            margin: 0;
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
        <h1>Print Preview - ${hasAnyBacks ? '2 Pages' : '1 Page'}${is4x6 ? ` (4×6 Photo${layout.slots > 1 ? ', 2 Cards' : ''})` : ''}</h1>

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
        <div class="page-label">Page 1 - Card Front${is4x6 ? ' (4×6)' : 's'}</div>
        <div class="card-grid">
`;

    // Add front cards
    for (let i = 0; i < totalSlots; i++) {
        const card = cardSlots[i];
        if (card) {
            const bleed = cardBleeds[i];
            const borderHtml = showCardBorders && bleed ? `<div class="card-border-bg" style="background-image:url(${shown(bleed)})"></div>` : '';
            html += `<div class="card-with-border">${borderHtml}<div class="card"><img src="${shown(card.src)}" alt="Card ${i + 1}"></div></div>`;
        } else {
            html += `<div class="card-with-border"><div class="card"></div></div>`;
        }
    }

    html += `
        </div>
        ${generatePreviewCutMarks()}
    </div>
`;

    // Add page 2 if there are backs
    if (hasAnyBacks) {
        html += `
    <!-- Page 2: Backs (Mirrored) -->
    <div class="page" id="backPage">
        <div class="page-label">Page 2 - Card Back${is4x6 ? ' (4×6)' : 's (Mirrored for Double-Sided)'}</div>
        <div class="card-grid">
`;

        // Add back cards (mirrored; a single 4x6 card mirrors onto itself)
        for (let i = 0; i < totalSlots; i++) {
            const mirroredIndex = mirrorIndex(i, gridCols);

            const back = cardBacks[mirroredIndex];
            if (back) {
                const bleed = cardBackBleeds[mirroredIndex];
                const borderHtml = showCardBorders && bleed ? `<div class="card-border-bg" style="background-image:url(${shown(bleed)})"></div>` : '';
                html += `<div class="card-with-border">${borderHtml}<div class="card"><img src="${shown(back)}" alt="Card ${mirroredIndex + 1} back"></div></div>`;
            } else {
                html += `<div class="card-with-border"><div class="card"></div></div>`;
            }
        }

        html += `
        </div>
        ${generatePreviewCutMarks()}
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

        const flipSteps = ${JSON.stringify(getFlipInstructions())};

        function startGuidedPrint() {
            if (confirm('Step 1 of 2: Ready to print the FRONT side?\\n\\n' +
                'In the print dialog use Actual Size / 100% scale and turn borderless off.\\n' +
                'Note which edge of the paper feeds in first.\\n\\nClick OK to open the print dialog for fronts.')) {
                printPage('front');

                setTimeout(() => {
                    const flipInstructions = 'Step 2 of 2: Print the BACK side\\n\\n' +
                        flipSteps.map((step, i) => (i + 1) + '. ' + step).join('\\n') +
                        '\\n\\nReady to print the backs?';

                    if (confirm(flipInstructions)) {
                        printPage('back');
                        setTimeout(() => {
                            alert('Double-sided printing complete!');
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
    await ensureBrightened();

    const layout = getLayout();
    const is4x6 = !layout.isLetter;
    const placedCount = cardSlots.slice(0, layout.slots).filter(slot => slot !== null).length;
    const hasAnyBacks = cardBacks.slice(0, layout.slots).some(back => back !== null);

    if (placedCount === 0) {
        showAlert(is4x6
            ? 'Please place a card on the 4×6 sheet before generating PDF.'
            : 'Please place at least one card on the sheet before generating PDF.', 'warning');
        return;
    }

    if (mode === 'back' && !hasAnyBacks) {
        showAlert('No card backs have been added yet.', 'warning');
        return;
    }

    // Show loading state
    const originalText = generatePdfBtn.textContent;
    generatePdfBtn.textContent = 'Generating...';
    generatePdfBtn.disabled = true;

    try {
        const { jsPDF } = window.jspdf;

        const { pageW, pageH, cols, rows } = layout;
        const orientation = pageW > pageH ? 'landscape' : 'portrait';
        const pageFormat = is4x6 ? [pageW, pageH] : 'letter';

        // Create PDF
        const pdf = new jsPDF({
            orientation,
            unit: 'in',
            format: pageFormat
        });

        // Card dimensions in inches
        const cardWidth = 2.5;
        const cardHeight = 3.5;

        // Spacing between cards in inches (0.125" = 1/8 inch for cutting buffer)
        const spacing = 0.125;

        // Calculate margins to center the grid
        const totalWidth = (cardWidth * cols) + (spacing * (cols - 1));
        const totalHeight = (cardHeight * rows) + (spacing * (rows - 1));
        const marginX = (pageW - totalWidth) / 2;
        const marginY = (pageH - totalHeight) / 2;

        let needsNewPage = false;

        // Helper: draw cut marks at page edges
        function drawPdfCutMarks() {
            const { markLen, markLenTB } = layout;
            pdf.setDrawColor(0, 0, 0);
            pdf.setLineWidth(0.01);

            // X positions (left/right edges of each card)
            for (let col = 0; col < cols; col++) {
                const left = marginX + col * (cardWidth + spacing);
                const right = left + cardWidth;
                [left, right].forEach(x => {
                    pdf.line(x, 0, x, markLenTB);               // top
                    pdf.line(x, pageH - markLenTB, x, pageH);   // bottom
                });
            }

            // Y positions (top/bottom edges of each card)
            for (let row = 0; row < rows; row++) {
                const top = marginY + row * (cardHeight + spacing);
                const bottom = top + cardHeight;
                [top, bottom].forEach(y => {
                    pdf.line(0, y, markLen, y);                  // left
                    pdf.line(pageW - markLen, y, pageW, y);      // right
                });
            }
        }

        // Card fronts
        if (mode === 'front' || mode === 'both') {
            for (let i = 0; i < layout.slots; i++) {
                const card = cardSlots[i];
                if (card) {
                    const row = Math.floor(i / cols);
                    const col = i % cols;
                    const x = marginX + (col * (cardWidth + spacing));
                    const y = marginY + (row * (cardHeight + spacing));

                    if (showCardBorders && cardBleeds[i]) {
                        pdf.addImage(shown(cardBleeds[i]), 'JPEG', x - BLEED_IN, y - BLEED_IN, cardWidth + BLEED_IN * 2, cardHeight + BLEED_IN * 2);
                    }

                    try {
                        pdf.addImage(shown(card.src), 'JPEG', x, y, cardWidth, cardHeight);
                    } catch (error) {
                        console.error(`Error adding card ${i}:`, error);
                    }
                }
            }
            drawPdfCutMarks();
            needsNewPage = true;
        }

        // Card backs (mirrored horizontally for double-sided printing)
        if ((mode === 'back' || mode === 'both') && hasAnyBacks) {
            if (needsNewPage) {
                pdf.addPage(pageFormat, orientation);
            }

            for (let i = 0; i < layout.slots; i++) {
                const back = cardBacks[i];
                if (back) {
                    const row = Math.floor(i / cols);
                    const col = i % cols;

                    // Mirror the column (letter: 0->2, 1->1, 2->0; 2-up: 0<->1; single: 0->0)
                    const mirroredCol = cols - 1 - col;

                    const x = marginX + (mirroredCol * (cardWidth + spacing));
                    const y = marginY + (row * (cardHeight + spacing));

                    if (showCardBorders && cardBackBleeds[i]) {
                        pdf.addImage(shown(cardBackBleeds[i]), 'JPEG', x - BLEED_IN, y - BLEED_IN, cardWidth + BLEED_IN * 2, cardHeight + BLEED_IN * 2);
                    }

                    try {
                        pdf.addImage(shown(back), 'JPEG', x, y, cardWidth, cardHeight);
                    } catch (error) {
                        console.error(`Error adding back for card ${i}:`, error);
                    }
                }
            }
            drawPdfCutMarks();
        }

        // Save PDF with descriptive filename
        const timestamp = new Date().toISOString().slice(0, 10);
        const sizeSuffix = layout.fileSuffix;
        const suffix = mode === 'front' ? '-fronts' : mode === 'back' ? '-backs' : '';
        pdf.save(`trading-cards${sizeSuffix}${suffix}-${timestamp}.pdf`);

        const modeLabel = mode === 'front' ? 'fronts' : mode === 'back' ? 'backs' : 'front + back';
        showAlert(`PDF generated (${modeLabel})! ${placedCount} card(s) included.`, 'success');
    } catch (error) {
        console.error('Error generating PDF:', error);
        showAlert('Error generating PDF. Please try again.', 'error');
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
    await ensureBrightened();

    const layout = getLayout();
    const is4x6 = !layout.isLetter;
    const placedCount = cardSlots.slice(0, layout.slots).filter(slot => slot !== null).length;
    const hasAnyBacks = cardBacks.slice(0, layout.slots).some(back => back !== null);

    if (placedCount === 0) {
        showAlert(is4x6
            ? 'Please place a card on the 4×6 sheet before exporting.'
            : 'Please place at least one card on the sheet before exporting.', 'warning');
        return;
    }

    if ((mode === 'back' || mode === 'both') && !hasAnyBacks) {
        showAlert('No card backs have been added yet.', 'warning');
        return;
    }

    // Show loading state
    const originalText = generatePdfBtn.textContent;
    generatePdfBtn.textContent = 'Exporting...';
    generatePdfBtn.disabled = true;

    try {
        const DPI = 300;
        const { pageW: pgW, pageH: pgH, cols, rows: rowCount } = layout;

        const pageW = pgW * DPI;
        const pageH = pgH * DPI;

        const cardW = 2.5 * DPI;  // 750
        const cardH = 3.5 * DPI;  // 1050
        const gap = 0.125 * DPI;  // 37.5

        const totalW = (cardW * cols) + (gap * (cols - 1));
        const totalH = (cardH * rowCount) + (gap * (rowCount - 1));
        const offsetX = (pageW - totalW) / 2;
        const offsetY = (pageH - totalH) / 2;

        const modes = mode === 'both' ? ['front', 'back'] : [mode];
        const timestamp = new Date().toISOString().slice(0, 10);
        const sizeSuffix = layout.fileSuffix;

        for (const currentMode of modes) {
            const canvas = document.createElement('canvas');
            canvas.width = pageW;
            canvas.height = pageH;
            const ctx = canvas.getContext('2d');

            // White background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, pageW, pageH);

            // Load and draw card images
            const loadImage = (src) => new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => resolve(null);
                img.src = src;
            });

            // Draws the bleed (if any) first so the card always sits on top of it
            const drawCard = async (src, col, row, bleedSrc) => {
                const [img, bleedImg] = await Promise.all([loadImage(shown(src)), bleedSrc ? loadImage(shown(bleedSrc)) : null]);
                const x = offsetX + (col * (cardW + gap));
                const y = offsetY + (row * (cardH + gap));
                const bp = BLEED_IN * DPI;
                if (bleedImg) ctx.drawImage(bleedImg, x - bp, y - bp, cardW + bp * 2, cardH + bp * 2);
                if (img) ctx.drawImage(img, x, y, cardW, cardH);
            };

            const promises = [];

            if (currentMode === 'front') {
                for (let i = 0; i < layout.slots; i++) {
                    const card = cardSlots[i];
                    if (card) {
                        const row = Math.floor(i / cols);
                        const col = i % cols;
                        promises.push(drawCard(card.src, col, row, showCardBorders ? cardBleeds[i] : null));
                    }
                }
            } else if (currentMode === 'back') {
                for (let i = 0; i < layout.slots; i++) {
                    const back = cardBacks[i];
                    if (back) {
                        const row = Math.floor(i / cols);
                        const col = i % cols;
                        const mirroredCol = cols - 1 - col;
                        promises.push(drawCard(back, mirroredCol, row, showCardBorders ? cardBackBleeds[i] : null));
                    }
                }
            }

            await Promise.all(promises);

            // Draw cut marks at page edges
            const markLen = layout.markLen * DPI;
            const markLenTB = layout.markLenTB * DPI;
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;

            for (let c = 0; c < cols; c++) {
                const left = offsetX + c * (cardW + gap);
                const right = left + cardW;
                [left, right].forEach(x => {
                    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, markLenTB); ctx.stroke();             // top
                    ctx.beginPath(); ctx.moveTo(x, pageH - markLenTB); ctx.lineTo(x, pageH); ctx.stroke();  // bottom
                });
            }

            for (let r = 0; r < rowCount; r++) {
                const top = offsetY + r * (cardH + gap);
                const bottom = top + cardH;
                [top, bottom].forEach(y => {
                    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(markLen, y); ctx.stroke();               // left
                    ctx.beginPath(); ctx.moveTo(pageW - markLen, y); ctx.lineTo(pageW, y); ctx.stroke();   // right
                });
            }

            // Download as PNG with 300 DPI metadata
            const suffix = currentMode === 'front' ? '-fronts' : '-backs';
            const pngDataUrl = canvas.toDataURL('image/png');
            const pngWithDpi = setPngDpi(pngDataUrl, 300);
            const link = document.createElement('a');
            link.download = `trading-cards${sizeSuffix}${suffix}-300dpi-${timestamp}.png`;
            link.href = pngWithDpi;
            link.click();
        }

        const pxW = Math.round(pageW);
        const pxH = Math.round(pageH);
        const modeLabel = mode === 'both' ? 'front + back' : `${mode}s`;
        const printTips = `\n\nIn Photoshop's Print dialog: ${pgW > pgH ? 'Landscape' : 'Portrait'} layout, Scale 100% (Scale to Fit Media off), borderless off, Emulsion Down off.`;
        const backTips = mode === 'front' ? '' : '\n\nFor the backs:\n' + getFlipInstructions().map((step, i) => `${i + 1}. ${step}`).join('\n');
        showAlert(`PNG exported (${modeLabel}) at 300 DPI — ${pxW}×${pxH}px.\nOpen in Photoshop for ${pgW}" × ${pgH}" print-ready layout.${printTips}${backTips}`, 'success');
    } catch (error) {
        console.error('Error exporting PNG:', error);
        showAlert('Error exporting PNG. Please try again.', 'error');
    } finally {
        generatePdfBtn.textContent = 'Export ▾';
        updateCardCount();
    }
}

// Inject pHYs chunk into PNG to set DPI metadata
// Without this, Photoshop defaults to 72 DPI
function setPngDpi(dataUrl, dpi) {
    // Convert data URL to binary
    const base64 = dataUrl.split(',')[1];
    const binaryStr = atob(base64);
    const original = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        original[i] = binaryStr.charCodeAt(i);
    }

    // DPI to pixels per meter: 300 DPI = 11811 pixels/meter
    const ppm = Math.round(dpi / 0.0254);

    // Build pHYs chunk: 4 bytes X ppm + 4 bytes Y ppm + 1 byte unit (1=meter)
    const phys = new Uint8Array(21);
    const view = new DataView(phys.buffer);

    // Length of data (9 bytes)
    view.setUint32(0, 9);
    // Chunk type: "pHYs"
    phys[4] = 0x70; // p
    phys[5] = 0x48; // H
    phys[6] = 0x59; // Y
    phys[7] = 0x73; // s
    // X pixels per unit
    view.setUint32(8, ppm);
    // Y pixels per unit
    view.setUint32(12, ppm);
    // Unit: meter
    phys[16] = 1;
    // CRC32 over chunk type + data
    const crc = crc32(phys.slice(4, 17));
    view.setUint32(17, crc);

    // Insert pHYs after IHDR chunk (8-byte signature + IHDR)
    // PNG signature is 8 bytes, IHDR chunk is 4(len) + 4(type) + 13(data) + 4(crc) = 25 bytes
    const insertPos = 8 + 25; // = 33

    // Build new PNG
    const result = new Uint8Array(original.length + phys.length);
    result.set(original.slice(0, insertPos));
    result.set(phys, insertPos);
    result.set(original.slice(insertPos), insertPos + phys.length);

    // Convert back to data URL
    let binaryResult = '';
    for (let i = 0; i < result.length; i++) {
        binaryResult += String.fromCharCode(result[i]);
    }
    return 'data:image/png;base64,' + btoa(binaryResult);
}

// CRC32 for PNG chunks
function crc32(data) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
        crc ^= data[i];
        for (let j = 0; j < 8; j++) {
            crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
        }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}
