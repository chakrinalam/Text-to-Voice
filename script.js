// === PDF.js setup ===
const pdfjsLib = window.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.9.179/pdf.worker.min.js';

const fileInput = document.getElementById('file-input');
const preview = document.getElementById('preview');
const extracted = document.getElementById('extracted');

let pdfDoc = null;
let currentPage = 1;
let totalPages = 0;
let pageCanvases = []; // store canvases per page

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { alert('Please choose a PDF file.'); return; }

    const arrayBuffer = await file.arrayBuffer();
    loadPdf(arrayBuffer);
});

async function loadPdf(data) {
    try {
        preview.innerHTML = '';
        extracted.value = 'Loading PDF — rendering pages and extracting text...';
        pdfDoc = await pdfjsLib.getDocument({ data }).promise;
        totalPages = pdfDoc.numPages;
        pageCanvases = [];

        let fullText = [];
        for (let p = 1; p <= totalPages; p++) {
            const page = await pdfDoc.getPage(p);

            // render to canvas for preview
            const viewport = page.getViewport({ scale: 1.2 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;

            const wrap = document.createElement('div');
            wrap.style.marginBottom = '12px';
            const title = document.createElement('div');
            title.className = 'small';
            title.textContent = `Page ${p}/${totalPages}`;
            wrap.appendChild(title);
            wrap.appendChild(canvas);
            preview.appendChild(wrap);

            pageCanvases.push(canvas);

            // extract text from page
            const textContent = await page.getTextContent();
            const strs = textContent.items.map(i => i.str);
            const pageText = strs.join(' ');
            fullText.push(`--- Page ${p} ---\n` + pageText + '\n\n');
        }

        extracted.value = fullText.join('\n');
        currentPage = 1;
        // scroll to first canvas
        if (pageCanvases[0]) pageCanvases[0].scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
        console.error(err);
        extracted.value = 'Failed to load PDF: ' + (err.message || err);
    }
}

// === Speech synthesis controls ===
const voiceSelect = document.getElementById('voiceSelect');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const stopBtn = document.getElementById('stopBtn');
const readSelBtn = document.getElementById('readSelBtn');
const readPageBtn = document.getElementById('readPageBtn');
const rate = document.getElementById('rate');
const pitch = document.getElementById('pitch');
const rateVal = document.getElementById('rateVal');
const pitchVal = document.getElementById('pitchVal');

function populateVoices() {
    const voices = speechSynthesis.getVoices();
    voiceSelect.innerHTML = '';
    voices.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.name;
        opt.textContent = `${v.name} ${v.lang ? '[' + v.lang + ']' : ''}${v.default ? ' — default' : ''}`;
        opt.dataset.lang = v.lang;
        voiceSelect.appendChild(opt);
    });
}

populateVoices();
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = populateVoices;
}

rate.addEventListener('input', () => rateVal.textContent = rate.value);
pitch.addEventListener('input', () => pitchVal.textContent = pitch.value);

function speakText(text) {
    if (!('speechSynthesis' in window)) { alert('SpeechSynthesis not supported in this browser.'); return; }
    speechSynthesis.cancel(); // stop previous
    const utter = new SpeechSynthesisUtterance(text);
    const sel = voiceSelect.value;
    const voices = speechSynthesis.getVoices();
    const chosen = voices.find(v => v.name === sel) || voices[0];
    if (chosen) utter.voice = chosen;
    utter.rate = parseFloat(rate.value);
    utter.pitch = parseFloat(pitch.value);

    speechSynthesis.speak(utter);
    // optional: scroll preview to current page if text includes page marker
    utter.onboundary = (e) => {
        // you could sync highlighting here using e.charIndex
    }
}

playBtn.addEventListener('click', () => {
    const txt = extracted.value.trim();
    if (!txt) { alert('No text to read. Load a PDF first.'); return; }
    speakText(txt);
});

pauseBtn.addEventListener('click', () => {
    if (speechSynthesis.speaking) speechSynthesis.pause();
});
resumeBtn.addEventListener('click', () => {
    if (speechSynthesis.paused) speechSynthesis.resume();
});
stopBtn.addEventListener('click', () => {
    speechSynthesis.cancel();
});

readSelBtn.addEventListener('click', () => {
    const sel = window.getSelection().toString();
    const ta = extracted;
    // if user selected inside textarea we prefer that
    let selectedText = '';
    try { selectedText = ta.value.substring(ta.selectionStart, ta.selectionEnd); } catch (e) { }
    if (!selectedText) selectedText = sel;
    if (!selectedText) { alert('Select some text (in the editor or on the page) first.'); return; }
    speakText(selectedText);
});

readPageBtn.addEventListener('click', () => {
    if (!pdfDoc) return alert('Load a PDF first.');
    // read the current page's extracted text by finding the marker
    const pageMarker = `--- Page ${currentPage} ---`;
    const txt = extracted.value;
    const idx = txt.indexOf(pageMarker);
    if (idx === -1) { alert('This PDF does not contain page markers in extracted text.'); return; }
    // find until next page marker or end
    const nextMarker = `--- Page ${currentPage + 1} ---`;
    let end = txt.indexOf(nextMarker, idx);
    if (end === -1) end = txt.length;
    const pageText = txt.slice(idx + pageMarker.length, end).trim();
    if (!pageText) { alert('No text found on this page to read.'); return; }
    speakText(pageText);
});

// track scroll to set currentPage (simple heuristic)
preview.addEventListener('scroll', () => {
    const boxes = preview.querySelectorAll('div > canvas');
    let visible = 1;
    boxes.forEach((c, i) => {
        const r = c.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.6) visible = i + 1;
    });
    currentPage = Math.min(visible, totalPages || 1);
});

// Accessibility note: SpeechSynthesis cannot produce downloadable audio in-browser without server-side work. To create audio files you'll need to use a TTS API or WebAudio-based recorder that captures speech output.