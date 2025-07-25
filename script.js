
let voices = [];
let paragraphs = [];
let speech;
let currentUtteranceIndex = 0;
const textContainer = document.getElementById("textContainer");

function toggleTheme() {
    const html = document.documentElement;
    html.dataset.theme = html.dataset.theme === "dark" ? "light" : "dark";
}

function loadVoices() {
    voices = speechSynthesis.getVoices();
    const voiceSelect = document.getElementById("voiceSelect");
    voiceSelect.innerHTML = '';
    voices.forEach(voice => {
        const opt = document.createElement("option");
        opt.value = voice.name;
        opt.textContent = `${voice.name} (${voice.lang})`;
        voiceSelect.appendChild(opt);
    });
}

speechSynthesis.onvoiceschanged = loadVoices;

document.getElementById("speedRange").addEventListener("input", e => {
    document.getElementById("speedValue").textContent = e.target.value;
});

document.getElementById("pdfInput").addEventListener("change", async function () {
    const file = this.files[0];
    if (!file || file.type !== "application/pdf") return;
    const reader = new FileReader();
    reader.onload = async function () {
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(this.result) }).promise;
        const viewer = document.getElementById("pdfViewer");
        viewer.innerHTML = '';
        textContainer.innerHTML = '';
        paragraphs = [];
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            const viewport = page.getViewport({ scale: 1.5 });
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport }).promise;
            viewer.appendChild(canvas);

            const content = await page.getTextContent();
            const text = content.items.map(i => i.str).join(" ").trim();
            const paras = text.split(/(?<=[.!?])\s+/g);
            paragraphs.push(...paras);
        }
        paragraphs.forEach((para, index) => {
            const p = document.createElement("p");
            p.textContent = para;
            p.setAttribute("data-index", index);
            textContainer.appendChild(p);
        });
        document.getElementById("status").textContent = `PDF loaded with ${paragraphs.length} paragraphs.`;
    };
    reader.readAsArrayBuffer(file);
});

function highlightAndScroll(index) {
    document.querySelectorAll("#textContainer p").forEach(p => p.classList.remove("highlight"));
    const target = document.querySelector(`#textContainer p[data-index='${index}']`);
    if (target) {
        target.classList.add("highlight");
    }
}

function readSelectedTextOrAll() {
    stopSpeech();
    let selection = window.getSelection().toString().trim();
    const voiceName = document.getElementById("voiceSelect").value;
    const rate = parseFloat(document.getElementById("speedRange").value);
    const voice = voices.find(v => v.name === voiceName);

    if (!paragraphs.length) return alert("No text available to read.");

    if (selection) {
        speech = new SpeechSynthesisUtterance(selection);
        if (voice) speech.voice = voice;
        speech.rate = rate;
        speech.lang = voice?.lang || 'en-US';
        speech.onend = () => document.getElementById("status").textContent = "Finished reading.";
        document.getElementById("status").textContent = `Reading selected text...`;
        speechSynthesis.speak(speech);
        return;
    }

    currentUtteranceIndex = 0;
    speakNextParagraph(rate, voice);
}

function speakNextParagraph(rate, voice) {
    if (currentUtteranceIndex >= paragraphs.length) {
        document.getElementById("status").textContent = "Finished reading all paragraphs.";
        return;
    }
    const para = paragraphs[currentUtteranceIndex];
    speech = new SpeechSynthesisUtterance(para);
    if (voice) speech.voice = voice;
    speech.rate = rate;
    speech.lang = voice?.lang || 'en-US';
    highlightAndScroll(currentUtteranceIndex);
    speech.onend = () => {
        currentUtteranceIndex++;
        speakNextParagraph(rate, voice);
    };
    speechSynthesis.speak(speech);
    document.getElementById("status").textContent = `Reading paragraph ${currentUtteranceIndex + 1}`;
}

function pauseSpeech() {
    if (speechSynthesis.speaking) speechSynthesis.pause();
}

function resumeSpeech() {
    if (speechSynthesis.paused) speechSynthesis.resume();
}

function stopSpeech() {
    speechSynthesis.cancel();
    document.querySelectorAll("#textContainer p").forEach(p => p.classList.remove("highlight"));
}

document.getElementById("searchInput").addEventListener("input", function () {
    const keyword = this.value.toLowerCase();
    const paragraphsDOM = document.querySelectorAll("#textContainer p");
    paragraphsDOM.forEach(p => {
        if (p.textContent.toLowerCase().includes(keyword)) {
            p.style.backgroundColor = "#ffffcc";
        } else {
            p.style.backgroundColor = "";
        }
    });
    document.getElementById("status").textContent = keyword ? `Searching: '${keyword}'` : "Search cleared.";
});