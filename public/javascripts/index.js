/**
 * FILE FOR FRONT END MANAGEMENT
 */

/** PDF.js is lazy-loaded so initial page load is not blocked by a large module fetch */
const PDFJS_MODULE_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs";
const PDFJS_WORKER_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs";
const PDF_PAGE_CONCURRENCY = 6;
let pdfjsLibPromise = null;

const getPdfJsLib = async () => {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import(PDFJS_MODULE_URL).then((pdfjsLib) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return pdfjsLib;
    });
  }
  return pdfjsLibPromise;
};

/** Define page elements */
const dropZone = document.getElementById("drop-zone");
const pdfInput = document.getElementById("pdf-input");
const statusEl = document.getElementById("status");
const uploadSection = document.getElementById("upload-section");
const resultsSection = document.getElementById("results-section");

console.log(dropZone, pdfInput, statusEl);

/** Set variables */
let selectedFile = null;
const setStatus = (text, kind = "") => {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.className = `status ${kind}`.trim();
};

const useFile = (file) => {
  if (!file || file.type !== "application/pdf") {
    setStatus("Please select a valid PDF file.", "error");
    selectedFile = null;
    return;
  }

  selectedFile = file;
  setStatus(`Selected: ${file.name}`, "success");
};

/** Event handling functions for pdf entry */
["dragenter", "dragover"].forEach((evtName) => {
  dropZone.addEventListener(evtName, (event) => {
    event.preventDefault();
    dropZone.classList.add("drag-over");
  });
});

["dragleave", "drop"].forEach((evtName) => {
  dropZone.addEventListener(evtName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("drag-over");
  });
});

dropZone.addEventListener("click", (event) => {
  if (event.target.closest("label") || event.target.closest("input")) {
    return;
  }
  pdfInput.click();
});

dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    pdfInput.click();
  }
});

pdfInput.addEventListener("change", (event) => {
  useFile(event.target.files?.[0]);
  processSelectedPdf();
});

dropZone.addEventListener("drop", (event) => {
  const file = event.dataTransfer?.files?.[0];
  useFile(file);
  processSelectedPdf();
});

/**
 * Function for getting simplified text from backend API
 */
export const simplifyText = async (rawText) => {
  if (!rawText?.trim()) {
    return "";
  }

  let response;
  try {
    response = await fetch("http://localhost:3001/api/simplify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: rawText })
    });
  } catch (error) {
    console.log(error);
    throw new Error(`Could not reach backend /api/simplify. ${error.message}`);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const messageParts = [data.error || `Simplify request failed (${response.status}).`];
    if (data.details) {
      messageParts.push(String(data.details));
    }
    throw new Error(messageParts.join(" "));
  }

  document.getElementById("output").textContent = data.simplified;

  return (data.simplified || rawText).trim();
};

const normalizeMetadataText = (value) => {
  if (typeof value !== "string") return "";
  const cleanedValue = value.trim();
  if (!cleanedValue || cleanedValue.toLowerCase() === "untitled") return "";
  return cleanedValue;
};

/**
 * Extracts text and metadata from the given PDF file.
 * Inputs: a PDF format file.
 * Outputs: an object with text, title, and author fields.
*/
const extractTextFromPdf = async (file) => {
  console.log("Beginning to extract text from given PDF");

  const pdfjsLib = await getPdfJsLib();
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let title = "";
  let author = "";

  try {
    const metadata = await pdf.getMetadata();
    title = normalizeMetadataText(metadata?.info?.Title || metadata?.metadata?.get("dc:title"));
    author = normalizeMetadataText(metadata?.info?.Author || metadata?.metadata?.get("dc:creator"));
  } catch (metadataError) {
    console.warn("Could not read PDF metadata.", metadataError);
  }

  const pageTexts = Array(pdf.numPages).fill("");
  const pageNumbers = Array.from({ length: pdf.numPages }, (_, i) => i + 1);

  let cursor = 0;
  const readNextPage = async () => {
    while (cursor < pageNumbers.length) {
      const pageNum = pageNumbers[cursor];
      cursor += 1;
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      pageTexts[pageNum - 1] = textContent.items.map((item) => item.str).join(" ");
    }
  };

  const workers = Array.from(
    { length: Math.min(PDF_PAGE_CONCURRENCY, pageNumbers.length) },
    () => readNextPage()
  );
  await Promise.all(workers);

  console.log("End of PDF text extraction process");
  return { text: pageTexts.join("\n\n"), title, author };
};

/**
 * Extracts text from the given pdf, and sets the status of the process
 */
const processSelectedPdf = async () => {
  if (!selectedFile) return;

  try {
    console.log("Starting extraction process");

    setStatus("Extracting text. This may take a few seconds...");

    const extractionResult = await extractTextFromPdf(selectedFile);
    const extractedText = extractionResult.text;

    console.log("Your extracted text is: ", extractedText);

    if (!extractedText.trim()) {
      setStatus("No readable text found in this PDF.", "error");
      return;
    }

    localStorage.setItem("tomodemo:raw_text", extractedText);
    localStorage.setItem("tomodemo:file_name", selectedFile.name);
    currentTitle = extractionResult.title;
    currentAuthor = extractionResult.author;
    currentRawText = extractedText;
    currentFileName = selectedFile.name;
    await runSimplificationFlow(extractedText);

  } catch (error) {
    console.error(error);
    setStatus("Failed to extract text. Please try a different PDF.", "error");
  }
};

/**
 * RENDERING SIMPLIFIED OUTPUT
 */

const output = document.getElementById("output");
const outputWrap = document.getElementById("output-wrap");
const sourceBox = document.getElementById("source-box");
const statusPanel = document.getElementById("status-panel");
const uploadAgainBtn = document.getElementById("upload-again-btn");
const ttsBtn = document.getElementById("tts-btn");
const ttsControls = document.getElementById("tts-controls");
const playPauseBtn = document.getElementById("play-pause-btn");
const stopBtn = document.getElementById("stop-btn");
const speedSlider = document.getElementById("speed-slider");
const speedValue = document.getElementById("speed-value");
const metaFooter = document.getElementById("meta-footer");
const metaFooterTitle = document.getElementById("meta-footer-title");
const metaFooterAuthor = document.getElementById("meta-footer-author");
const metaFooterAuthorWrap = document.getElementById("meta-footer-author-wrap");

let currentFileName = "";
let currentRawText = "";
let currentTitle = "";
let currentAuthor = "";

const renderStatusPanel = () => {
  statusPanel.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.className = "status-loading";

  const spinner = document.createElement("div");
  spinner.className = "loading-circle";
  spinner.setAttribute("aria-hidden", "true");
  wrapper.appendChild(spinner);

  const message = document.createElement("p");
  message.className = "status-line";
  message.textContent = "Tomo is simplifying your reading, give us a minute!";
  wrapper.appendChild(message);

  statusPanel.appendChild(wrapper);
};

const startStatusMonitor = async () => {
  statusPanel.classList.remove("hidden");
  renderStatusPanel();
};

const stopStatusMonitor = () => {
  statusPanel.classList.add("hidden");
};

const setScreen = (screen) => {
  const showUpload = screen === "upload";
  uploadSection.classList.toggle("hidden", !showUpload);
  resultsSection.classList.toggle("hidden", showUpload);

  if (showUpload) return;

  const isLoading = screen === "loading";
  statusPanel.classList.toggle("hidden", !isLoading);
  outputWrap.classList.toggle("hidden", isLoading);

  if (isLoading) {
    if (uploadAgainBtn) uploadAgainBtn.classList.add("hidden");
    if (ttsBtn && ttsControls) {
      ttsBtn.classList.add("hidden");
      ttsBtn.disabled = false;
      ttsControls.classList.add("hidden");
    }
  }
};

const cleanIntroBoilerplate = (text) => {
  if (!text) return "";

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const filtered = lines.filter(
    (line) =>
      !/^(here('| i)?s|this is)\s+a?\s*(rewritten|simplified)\s+version/i.test(line) &&
      !/^here(?:'| i)?s\s+(?:the\s+)?(?:rewritten|simplified)\s+(?:passage|text|version)\b.*:?$/i.test(line) &&
      !/^i\s+cannot\s+provide\s+(?:a|the)\s+(?:rewritten|simplified)\s+version\b.*$/i.test(line) &&
      !/academic\s+text/i.test(line) &&
      !/^let me know if you have/i.test(line) &&
      !/^what is [a-z0-9\s-]+\?$/i.test(line) &&
      !/^[A-Z][A-Za-z0-9\s'-]{1,70}:$/.test(line)
  );

  const cleaned = filtered
    .map((line) =>
      line
        .replace(/^\*\*(.+?)\*\*:?$/g, "$1")
        .replace(/^#{1,6}\s+/g, "")
        .replace(/^[-*]\s+/g, "")
        .replace(/^\d+\.\s+/g, "")
    )
    .filter(Boolean);

  return cleaned.join("\n\n").trim() || text.trim();
};

const renderSource = () => {
  sourceBox.innerHTML = "";
  if (!currentFileName) {
    sourceBox.classList.add("hidden");
    return;
  }

  const source = document.createElement("div");
  source.className = "source-badge";
  const displayName = currentFileName.replace(/\.pdf$/i, "");
  source.textContent = `${displayName}`;
  sourceBox.appendChild(source);
  sourceBox.classList.remove("hidden");
};

const renderFooter = () => {
  if (!metaFooter || !metaFooterTitle || !metaFooterAuthor || !metaFooterAuthorWrap) return;

  const fallbackTitle = currentFileName ? currentFileName.replace(/\.pdf$/i, "").trim() : "";
  const resolvedTitle = currentTitle || fallbackTitle;
  const hasTitle = Boolean(resolvedTitle);
  const hasAuthor = Boolean(currentAuthor);

  if (!hasTitle && !hasAuthor) {
    metaFooter.classList.add("hidden");
    return;
  }

  metaFooterTitle.textContent = resolvedTitle;
  metaFooterAuthor.textContent = hasAuthor ? currentAuthor : "";
  metaFooterAuthorWrap.classList.toggle("hidden", !hasAuthor);
  metaFooter.classList.remove("hidden");
};

const renderOutput = (text, note = "", isError = false) => {
  output.innerHTML = "";
  renderSource();
  renderFooter();

  if (note) {
    const noteEl = document.createElement("p");
    noteEl.className = `output-note${isError ? " output-note-error" : ""}`;
    noteEl.textContent = note;
    output.appendChild(noteEl);
  }

  const cleanedText = cleanIntroBoilerplate(text);
  const paragraphs = cleanedText
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const body = document.createElement("div");
  body.className = "output-body";

  if (paragraphs.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = cleanedText;
    body.appendChild(empty);
  } else {
    paragraphs.forEach((paragraph) => {
      const p = document.createElement("p");
      p.textContent = paragraph;
      body.appendChild(p);
    });
  }

  output.appendChild(body);
  if (uploadAgainBtn) uploadAgainBtn.classList.remove("hidden");
  if (ttsBtn && ttsControls) {
    ttsBtn.classList.remove("hidden");
    ttsControls.classList.add("hidden");
  }
};

let synth = null;
let utterance = null;
let isPaused = false;

const getReadableOutputText = () => {
  const lines = [];
  output.querySelectorAll(".output-body p").forEach((p) => {
    if (p.textContent.trim()) lines.push(p.textContent.trim());
  });
  return lines.join("\n\n");
};

const resetPlaybackUi = () => {
  if (playPauseBtn) playPauseBtn.textContent = "Pause";
  if (ttsBtn) ttsBtn.disabled = false;
  isPaused = false;
};

const stopSpeech = () => {
  if (synth) synth.cancel();
  resetPlaybackUi();
};

const speakOutput = () => {
  if (!("speechSynthesis" in window)) {
    alert("Text-to-speech is not supported in this browser.");
    return;
  }

  const text = getReadableOutputText();
  if (!text) return;

  synth = window.speechSynthesis;
  synth.cancel();

  utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = speedSlider ? parseFloat(speedSlider.value) : 1;

  utterance.onend = () => {
    resetPlaybackUi();
  };

  utterance.onerror = () => {
    resetPlaybackUi();
  };

  synth.speak(utterance);
  if (ttsBtn) ttsBtn.disabled = true;
  isPaused = false;
  if (playPauseBtn) playPauseBtn.textContent = "Pause";
};

const togglePauseResume = () => {
  if (!synth) return;
  if (!synth.speaking && !synth.pending) {
    speakOutput();
    return;
  }

  if (isPaused) {
    synth.resume();
    isPaused = false;
    if (playPauseBtn) playPauseBtn.textContent = "Pause";
  } else {
    synth.pause();
    isPaused = true;
    if (playPauseBtn) playPauseBtn.textContent = "Resume";
  }
};

const updateSpeed = () => {
  if (!speedSlider || !speedValue) return;
  speedValue.textContent = `${Number(speedSlider.value).toFixed(1)}x`;
  if (utterance) {
    utterance.rate = parseFloat(speedSlider.value);
  }
};

if (ttsBtn && ttsControls && playPauseBtn && stopBtn) {
  ttsBtn.addEventListener("click", () => {
    ttsControls.classList.remove("hidden");
    ttsBtn.classList.add("hidden");
    speakOutput();
  });

  playPauseBtn.addEventListener("click", togglePauseResume);
  stopBtn.addEventListener("click", stopSpeech);
  if (speedSlider) speedSlider.addEventListener("input", updateSpeed);
}

const runSimplificationFlow = async (textToSimplify) => {
  currentRawText = textToSimplify || "";
  if (!currentRawText.trim()) {
    setScreen("upload");
    return;
  }

  setScreen("loading");
  renderSource();
  await startStatusMonitor();

  try {
    const simplifiedText = await simplifyText(currentRawText);
    renderOutput(simplifiedText);
    setScreen("output");
    stopStatusMonitor();
  } catch (error) {
    console.error(error);
    renderOutput(
      currentRawText,
      `Could not generate simplified output yet. Reason: ${error.message} Showing extracted text instead.`,
      true
    );
    setScreen("output");
    stopStatusMonitor();
  }
};

const render = async () => {
  setScreen("upload");
};

render();
