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
const dropZonePrimary = document.getElementById("drop-zone-primary");
const dropZoneSecondary = document.getElementById("drop-zone-secondary");
const pdfInput = document.getElementById("pdf-input");
const continueBtn = document.getElementById("continue-btn");
const uploadTabFile = document.getElementById("upload-tab-file");
const uploadTabText = document.getElementById("upload-tab-text");
const textInputWrap = document.getElementById("text-input-wrap");
const manualTextInput = document.getElementById("manual-text-input");
const statusEl = document.getElementById("status");
const uploadSection = document.getElementById("upload-section");
const resultsSection = document.getElementById("results-section");

/** Background Control */
const bgToggleBtn = document.getElementById("bg-toggle-btn");
const bgVideo = document.getElementById("bg-video");

let backgroundVisible = true;

console.log(dropZone, pdfInput, statusEl);

/** Set variables */
let selectedFile = null;
let uploadInputMode = "file";
let currentInputSource = "pdf";
let selectedOutputLength = "medium";
const setStatus = (text, kind = "") => {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.className = `status ${kind}`.trim();
};

const updateContinueButtonState = () => {
  if (!continueBtn) return;
  if (uploadInputMode === "file") {
    continueBtn.disabled = !selectedFile;
    return;
  }
  continueBtn.disabled = !manualTextInput?.value?.trim();
};

const setUploadMode = (mode) => {
  const nextMode = mode === "text" ? "text" : "file";
  uploadInputMode = nextMode;

  const isFileMode = nextMode === "file";
  if (uploadTabFile) {
    uploadTabFile.classList.toggle("active", isFileMode);
    uploadTabFile.setAttribute("aria-selected", isFileMode ? "true" : "false");
  }
  if (uploadTabText) {
    uploadTabText.classList.toggle("active", !isFileMode);
    uploadTabText.setAttribute("aria-selected", !isFileMode ? "true" : "false");
  }
  if (dropZone) dropZone.classList.toggle("hidden", !isFileMode);
  if (textInputWrap) textInputWrap.classList.toggle("hidden", isFileMode);
  setStatus("");
  updateContinueButtonState();
};

const renderDropZoneText = (file = null) => {
  if (!dropZonePrimary || !dropZoneSecondary) return;
  if (file) {
    dropZonePrimary.textContent = file.name;
    dropZoneSecondary.textContent = "";
    return;
  }

  dropZonePrimary.textContent = "Drag and drop a PDF here";
  dropZoneSecondary.textContent = "or click File to choose one";
};

const useFile = (file) => {
  if (!file || file.type !== "application/pdf") {
    setStatus("Please select a valid PDF file.", "error");
    selectedFile = null;
    renderDropZoneText();
    updateContinueButtonState();
    return;
  }

  selectedFile = file;
  renderDropZoneText(file);
  setStatus("");
  updateContinueButtonState();
};

/** Event handling functions for pdf entry */
["dragenter", "dragover"].forEach((evtName) => {
  dropZone.addEventListener(evtName, (event) => {
    if (uploadInputMode !== "file") return;
    event.preventDefault();
    dropZone.classList.add("drag-over");
  });
});

["dragleave", "drop"].forEach((evtName) => {
  dropZone.addEventListener(evtName, (event) => {
    if (uploadInputMode !== "file") return;
    event.preventDefault();
    dropZone.classList.remove("drag-over");
  });
});

dropZone.addEventListener("click", (event) => {
  if (uploadInputMode !== "file") return;
  if (event.target.closest("label") || event.target.closest("input")) {
    return;
  }
  pdfInput.click();
});

dropZone.addEventListener("keydown", (event) => {
  if (uploadInputMode !== "file") return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    pdfInput.click();
  }
});

pdfInput.addEventListener("change", (event) => {
  useFile(event.target.files?.[0]);
});

dropZone.addEventListener("drop", (event) => {
  if (uploadInputMode !== "file") return;
  const file = event.dataTransfer?.files?.[0];
  useFile(file);
});

if (uploadTabFile) {
  uploadTabFile.addEventListener("click", () => {
    setUploadMode("file");
    if (pdfInput) pdfInput.click();
  });
}

if (uploadTabText) {
  uploadTabText.addEventListener("click", () => {
    setUploadMode("text");
  });
}

if (manualTextInput) {
  manualTextInput.addEventListener("input", () => {
    setStatus("");
    updateContinueButtonState();
  });
}

/**
 * Function for getting simplified text from backend API
 */
const getSelectedOutputLength = () => {
  return selectedOutputLength;
};

export const simplifyText = async (rawText, outputLength = "medium", sourceType = "pdf") => {
  if (!rawText?.trim()) {
    return "";
  }

  let response;
  try {
    response = await fetch("http://localhost:3001/api/simplify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: rawText, length: outputLength, sourceType })
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

    if (continueBtn) continueBtn.disabled = true;
    setStatus("Extracting text. This may take a few seconds...");

    const extractionResult = await extractTextFromPdf(selectedFile);
    const extractedText = extractionResult.text;

    console.log(`Extracted approximately ${((extractedText.match(/\S+/g) || []).length)} words from PDF`);

    if (!extractedText.trim()) {
      setStatus("No readable text found in this PDF.", "error");
      if (continueBtn) continueBtn.disabled = false;
      return;
    }

    localStorage.setItem("tomodemo:raw_text", extractedText);
    localStorage.setItem("tomodemo:file_name", selectedFile.name);
    currentInputSource = "pdf";
    currentTitle = extractionResult.title;
    currentAuthor = extractionResult.author;
    currentRawText = extractedText;
    currentFileName = selectedFile.name;
    if (titleInput) {
      const fallbackTitle = selectedFile.name.replace(/\.pdf$/i, "").trim();
      titleInput.value = currentTitle || fallbackTitle;
      if (authorInput) authorInput.value = currentAuthor || fallbackTitle;
    }
    if (translateBtn) translateBtn.disabled = true;
    lengthOptionButtons.forEach((button) => {
      button.disabled = true;
    });
    setScreen("metadata");

  } catch (error) {
    console.error(error);
    setStatus("Failed to extract text. Please try a different PDF.", "error");
    if (continueBtn && selectedFile) continueBtn.disabled = false;
  }
};

const processManualText = () => {
  const text = (manualTextInput?.value || "").trim();
  if (!text) {
    setStatus("Please enter text before continuing.", "error");
    updateContinueButtonState();
    return;
  }

  const firstMeaningfulLine =
    text
      .split(/\n+/)
      .map((line) => line.trim())
      .find(Boolean) || "";
  const fallbackTitle = firstMeaningfulLine.slice(0, 60).trim() || "Manual Text Entry";

  localStorage.setItem("tomodemo:raw_text", text);
  localStorage.setItem("tomodemo:file_name", "Manual Text Entry");
  currentInputSource = "text";
  currentRawText = text;
  currentFileName = "Manual Text Entry";
  currentTitle = fallbackTitle;
  currentAuthor = "";

  if (titleInput) {
    titleInput.value = currentTitle;
  }
  if (authorInput) {
    authorInput.value = currentAuthor;
  }
  if (translateBtn) translateBtn.disabled = true;
  lengthOptionButtons.forEach((button) => {
    button.disabled = true;
  });
  setStatus("");
  setScreen("metadata");
};

/**
 * RENDERING SIMPLIFIED OUTPUT
 */

const output = document.getElementById("output");
const outputWrap = document.getElementById("output-wrap");
const outputActions = document.getElementById("output-actions");
const regenerateBtn = document.getElementById("regenerate-btn");
const sourceBox = document.getElementById("source-box");
const metadataPanel = document.getElementById("metadata-panel");
const titleInput = document.getElementById("title-input");
const authorInput = document.getElementById("author-input");
const metadataContinueBtn = document.getElementById("metadata-continue-btn");
const lengthPanel = document.getElementById("length-panel");
const statusPanel = document.getElementById("status-panel");
const translateBtn = document.getElementById("translate-btn");
const lengthOptionButtons = Array.from(document.querySelectorAll(".length-option"));
const complexityInfoBtn = document.getElementById("complexity-info-btn");
const complexityInfoPopup = document.getElementById("complexity-info-popup");
const uploadAgainBtn = document.getElementById("upload-again-btn");
const rewindBtn = document.getElementById("rewind-btn");
const playToggleBtn = document.getElementById("play-toggle-btn");
const forwardBtn = document.getElementById("forward-btn");
const speedSelect = document.getElementById("speed-select");
const playbackProgress = document.getElementById("playback-progress");
const quickModeButtons = Array.from(document.querySelectorAll(".quick-icon-btn[data-mode]"));
const settingsBtn = document.getElementById("settings-btn");
const customizePanel = document.getElementById("customize-panel");
const metaFooter = document.getElementById("meta-footer");
const metaFooterTitle = document.getElementById("meta-footer-title");
const metaFooterAuthor = document.getElementById("meta-footer-author");
const metaFooterAuthorWrap = document.getElementById("meta-footer-author-wrap");

let currentFileName = "";
let currentRawText = "";
let currentTitle = "";
let currentAuthor = "";
let synth = null;
let utterance = null;
let speechText = "";
let speechOffsets = [];
let speechStartChar = 0;
let speechCursorChar = 0;
let isSpeechPaused = false;
let isManualSpeechCancel = false;
const BASE_CHARS_PER_SECOND = 16;
const PLAY_ICON = `<svg class="transport-icon play-icon" xmlns="http://www.w3.org/2000/svg" width="22" height="27" viewBox="0 0 22 27" fill="none" aria-hidden="true"><path d="M1.5 1.5L20.1667 13.5L1.5 25.5V1.5Z" stroke="#1E1E1E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const PAUSE_ICON = `<svg class="transport-icon pause-icon" xmlns="http://www.w3.org/2000/svg" width="19" height="25" viewBox="0 0 19 25" fill="none" aria-hidden="true"><path d="M6.83333 1.5H1.5V22.8333H6.83333V1.5Z" stroke="#1E1E1E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M17.5 1.5H12.1667V22.8333H17.5V1.5Z" stroke="#1E1E1E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const setComplexityInfoOpen = (isOpen) => {
  if (!complexityInfoPopup || !complexityInfoBtn) return;
  complexityInfoPopup.classList.toggle("hidden", !isOpen);
  complexityInfoBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
};

const setCustomizePanelOpen = (isOpen) => {
  if (!resultsSection || !customizePanel || !settingsBtn) return;
  customizePanel.classList.toggle("hidden", !isOpen);
  resultsSection.classList.toggle("customize-open", isOpen);
  settingsBtn.setAttribute("aria-pressed", isOpen ? "true" : "false");
};

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
  message.textContent = "Sit tight while Tomo simplifies your reading!";
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

  if (showUpload) {
    setCustomizePanelOpen(false);
    return;
  }

  const isMetadata = screen === "metadata";
  const isConfigure = screen === "configure";
  const isLoading = screen === "loading";
  const isOutput = screen === "output";
  const isSetupScreen = isMetadata || isConfigure;

  resultsSection.classList.toggle("setup-mode", isSetupScreen);
  resultsSection.classList.toggle("output-mode", isOutput);

  if (metadataPanel) metadataPanel.classList.toggle("hidden", !isMetadata);
  if (lengthPanel) lengthPanel.classList.toggle("hidden", !isConfigure);
  sourceBox.classList.add("hidden");
  if (metaFooter) metaFooter.classList.toggle("hidden", !isOutput);
  statusPanel.classList.toggle("hidden", !isLoading);
  statusPanel.classList.toggle("status-panel-centered", isLoading);
  outputWrap.classList.toggle("hidden", !isOutput);

  if (isConfigure || isLoading) {
    if (outputActions) outputActions.classList.add("hidden");
    if (uploadAgainBtn) uploadAgainBtn.classList.add("hidden");
    if (regenerateBtn) regenerateBtn.classList.add("hidden");
  }

  if (!isOutput) {
    stopSpeech(true);
    setCustomizePanelOpen(false);
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

const splitIntoSentenceLines = (text = "") => {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!normalized) return [];

  const matches = normalized.match(/[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g) || [];
  return matches.map((line) => line.trim()).filter(Boolean);
};

const renderSource = () => {
  if (!sourceBox) return;
  sourceBox.innerHTML = "";
  sourceBox.classList.add("hidden");
};

const renderFooter = () => {
  if (!metaFooter || !metaFooterTitle || !metaFooterAuthor || !metaFooterAuthorWrap) return;

  const fallbackTitle = currentFileName ? currentFileName.replace(/\.pdf$/i, "").trim() : "";
  const resolvedTitle = currentTitle || fallbackTitle || "Untitled Reading";
  const resolvedAuthor = currentAuthor || fallbackTitle || "Unknown Author";

  metaFooterTitle.textContent = resolvedTitle;
  metaFooterAuthor.textContent = resolvedAuthor;
  metaFooterAuthorWrap.classList.remove("hidden");
  metaFooter.classList.remove("hidden");
};

const toggleBackground = () => {
  backgroundVisible = !backgroundVisible;
  
  if (backgroundVisible) {
    // Show video background
    outputWrap.classList.remove("bg-off");
    outputWrap.classList.add("bg-on");
    if (bgToggleBtn) bgToggleBtn.textContent = "Hide Video Background";
  } else {
    // Hide video background, show solid white
    outputWrap.classList.remove("bg-on");
    outputWrap.classList.add("bg-off");
    if (bgToggleBtn) bgToggleBtn.textContent = "Show Video Background";
  }
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
  const sentenceLines = splitIntoSentenceLines(cleanedText);

  const body = document.createElement("div");
  body.className = "output-body";

  if (sentenceLines.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = cleanedText;
    body.appendChild(empty);
  } else {
    sentenceLines.forEach((sentence) => {
      const p = document.createElement("p");
      p.textContent = sentence;
      body.appendChild(p);
    });
  }

  output.appendChild(body);
  syncSpeechText();

  if (outputActions) outputActions.classList.remove("hidden");
  if (uploadAgainBtn) uploadAgainBtn.classList.remove("hidden");
  if (regenerateBtn) regenerateBtn.classList.remove("hidden");
  if (ttsBtn && ttsControls) {
    ttsBtn.classList.remove("hidden");
    ttsControls.classList.add("hidden");
  }
  if (outputWrap) {
    outputWrap.classList.add("bg-on");
  }
};

const getReadableOutputText = () => {
  const lines = [];
  output.querySelectorAll(".output-body p").forEach((p) => {
    if (p.textContent.trim()) lines.push(p.textContent.trim());
  });
  return lines.join("\n\n");
};

const getSpeechRate = () => {
  return Number(speedSelect?.value || "1");
};

const updatePlaybackProgress = () => {
  if (!playbackProgress) return;
  const total = Math.max(1, speechText.length || 1);
  const current = Math.max(0, Math.min(total, speechCursorChar));
  playbackProgress.max = String(total);
  playbackProgress.value = String(current);
};

const updatePlayButtonLabel = () => {
  if (!playToggleBtn) return;
  const isActive =
    Boolean(window.speechSynthesis) &&
    (window.speechSynthesis.speaking || window.speechSynthesis.pending);
  playToggleBtn.innerHTML = isSpeechPaused || !isActive ? PLAY_ICON : PAUSE_ICON;
};

const resetPlaybackUi = () => {
  isSpeechPaused = false;
  updatePlayButtonLabel();
};

const buildSpeechOffsets = (text = "") => {
  const offsets = [];
  const matcher = /\S+/g;
  let match = matcher.exec(text);
  while (match) {
    offsets.push(match.index);
    match = matcher.exec(text);
  }
  return offsets;
};

const snapToWordOffset = (targetChar) => {
  if (!speechOffsets.length) return Math.max(0, targetChar);
  let snapped = speechOffsets[0];
  for (const offset of speechOffsets) {
    if (offset > targetChar) break;
    snapped = offset;
  }
  return snapped;
};

const syncSpeechText = () => {
  speechText = getReadableOutputText();
  speechOffsets = buildSpeechOffsets(speechText);
  speechStartChar = 0;
  speechCursorChar = 0;
  updatePlaybackProgress();
  stopSpeech(true);
};

const stopSpeech = (silent = false) => {
  if (window.speechSynthesis) {
    isManualSpeechCancel = true;
    window.speechSynthesis.cancel();
    isManualSpeechCancel = false;
  }
  utterance = null;
  isSpeechPaused = false;
  if (!silent) {
    speechCursorChar = 0;
  }
  updatePlaybackProgress();
  resetPlaybackUi();
  if (playToggleBtn) playToggleBtn.innerHTML = PLAY_ICON;
};

const startSpeechFrom = (startChar = 0) => {
  if (!("speechSynthesis" in window)) {
    alert("Text-to-speech is not supported in this browser.");
    return;
  }

  if (!speechText) return;

  const clampedStart = Math.max(0, Math.min(startChar, Math.max(0, speechText.length - 1)));
  const snappedStart = snapToWordOffset(clampedStart);
  const remainingText = speechText.slice(snappedStart);
  if (!remainingText.trim()) {
    speechCursorChar = speechText.length;
    updatePlaybackProgress();
    resetPlaybackUi();
    return;
  }

  synth = window.speechSynthesis;
  isManualSpeechCancel = true;
  synth.cancel();
  isManualSpeechCancel = false;

  speechStartChar = snappedStart;
  speechCursorChar = snappedStart;
  utterance = new SpeechSynthesisUtterance(remainingText);
  utterance.rate = getSpeechRate();

  utterance.onboundary = (event) => {
    if (typeof event.charIndex === "number") {
      speechCursorChar = Math.min(speechText.length, speechStartChar + event.charIndex);
      updatePlaybackProgress();
    }
  };

  utterance.onend = () => {
    if (isManualSpeechCancel) return;
    speechCursorChar = speechText.length;
    updatePlaybackProgress();
    resetPlaybackUi();
    if (playToggleBtn) playToggleBtn.innerHTML = PLAY_ICON;
  };

  utterance.onerror = () => {
    updatePlaybackProgress();
    resetPlaybackUi();
  };

  isSpeechPaused = false;
  updatePlayButtonLabel();
  synth.speak(utterance);
};

const togglePauseResume = () => {
  if (!("speechSynthesis" in window)) return;
  const engine = window.speechSynthesis;

  if (!speechText) {
    syncSpeechText();
  }

  if (!engine.speaking && !engine.pending && !isSpeechPaused) {
    startSpeechFrom(speechCursorChar);
    return;
  }

  if (isSpeechPaused) {
    engine.resume();
    isSpeechPaused = false;
    updatePlayButtonLabel();
    return;
  }

  if (engine.speaking) {
    engine.pause();
    isSpeechPaused = true;
    updatePlayButtonLabel();
  }
};

const jumpSpeechBySeconds = (seconds) => {
  if (!speechText) {
    syncSpeechText();
    if (!speechText) return;
  }

  const rate = getSpeechRate();
  const charsDelta = Math.round(seconds * BASE_CHARS_PER_SECOND * rate);
  const target = Math.max(0, Math.min(speechText.length, speechCursorChar + charsDelta));
  speechCursorChar = snapToWordOffset(target);

  if (!("speechSynthesis" in window)) return;
  const engine = window.speechSynthesis;
  const wasPaused = isSpeechPaused;
  const wasSpeaking = engine.speaking || engine.pending;

  if (wasSpeaking || wasPaused) {
    if (wasPaused) {
      isManualSpeechCancel = true;
      engine.cancel();
      isManualSpeechCancel = false;
      resetPlaybackUi();
      if (playToggleBtn) playToggleBtn.innerHTML = PLAY_ICON;
      return;
    }

    startSpeechFrom(speechCursorChar);
  }
};

const updateSpeed = () => {
  const selectedRate = getSpeechRate();
  if (!speedSelect) return;
  speedSelect.value = String(selectedRate);

  if (!("speechSynthesis" in window)) return;
  const engine = window.speechSynthesis;
  const isActive = engine.speaking || engine.pending;
  if (!isActive) return;

  if (isSpeechPaused) {
    isManualSpeechCancel = true;
    engine.cancel();
    isManualSpeechCancel = false;
    resetPlaybackUi();
    if (playToggleBtn) playToggleBtn.innerHTML = PLAY_ICON;
  } else {
    startSpeechFrom(speechCursorChar);
  }
};

if (playToggleBtn) playToggleBtn.addEventListener("click", togglePauseResume);
if (rewindBtn) rewindBtn.addEventListener("click", () => jumpSpeechBySeconds(-10));
if (forwardBtn) forwardBtn.addEventListener("click", () => jumpSpeechBySeconds(10));
if (playbackProgress) {
  playbackProgress.addEventListener("input", () => {
    if (!speechText) return;
    const nextPosition = Number(playbackProgress.value || "0");
    speechCursorChar = snapToWordOffset(nextPosition);
    updatePlaybackProgress();
  });
}
if (speedSelect) {
  speedSelect.value = "1";
  speedSelect.addEventListener("change", updateSpeed);
}

quickModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    quickModeButtons.forEach((item) => {
      const isActive = item === button;
      item.classList.toggle("mode-active", isActive);
      item.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  });
});

if (settingsBtn && customizePanel) {
  settingsBtn.addEventListener("click", () => {
    const shouldOpen = customizePanel.classList.contains("hidden");
    setCustomizePanelOpen(shouldOpen);
  });
}

if (complexityInfoBtn && complexityInfoPopup) {
  complexityInfoBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const shouldOpen = complexityInfoPopup.classList.contains("hidden");
    setComplexityInfoOpen(shouldOpen);
  });

  complexityInfoPopup.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.addEventListener("click", (event) => {
    if (
      !complexityInfoPopup.classList.contains("hidden") &&
      !complexityInfoPopup.contains(event.target) &&
      !complexityInfoBtn.contains(event.target)
    ) {
      setComplexityInfoOpen(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setComplexityInfoOpen(false);
    }
  });
}

const runSimplificationFlow = async (textToSimplify) => {
  currentRawText = textToSimplify || "";
  if (!currentRawText.trim()) {
    setScreen("upload");
    return;
  }

  if (translateBtn) translateBtn.disabled = true;
  lengthOptionButtons.forEach((button) => {
    button.disabled = true;
  });
  setScreen("loading");
  renderSource();
  await startStatusMonitor();

  try {
    const simplifiedText = await simplifyText(
      currentRawText,
      getSelectedOutputLength(),
      currentInputSource
    );
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
  } finally {
    if (translateBtn) translateBtn.disabled = false;
    lengthOptionButtons.forEach((button) => {
      button.disabled = false;
    });
  }
};

const render = async () => {
  if (translateBtn) translateBtn.disabled = true;
  lengthOptionButtons.forEach((button) => {
    button.disabled = true;
  });
  setUploadMode("file");
  updateContinueButtonState();
  setScreen("upload");
};

if (continueBtn) {
  continueBtn.addEventListener("click", async () => {
    if (uploadInputMode === "text") {
      processManualText();
      return;
    }
    await processSelectedPdf();
  });
}

if (metadataContinueBtn) {
  metadataContinueBtn.addEventListener("click", () => {
    const fallbackTitle = currentFileName ? currentFileName.replace(/\.pdf$/i, "").trim() : "";
    currentTitle = (titleInput?.value || "").trim() || fallbackTitle;
    currentAuthor = (authorInput?.value || "").trim() || fallbackTitle;
    renderFooter();
    if (translateBtn) translateBtn.disabled = false;
    lengthOptionButtons.forEach((button) => {
      button.disabled = false;
    });
    setScreen("configure");
  });
}

lengthOptionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const value = String(button.dataset.length || "").toLowerCase();
    if (!["short", "medium", "long"].includes(value)) return;
    selectedOutputLength = value;

    lengthOptionButtons.forEach((item) => {
      const isActive = item === button;
      item.classList.toggle("active", isActive);
      item.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  });
});

if (translateBtn) {
  translateBtn.addEventListener("click", async () => {
    await runSimplificationFlow(currentRawText);
  });
}

if (regenerateBtn) {
  regenerateBtn.addEventListener("click", () => {
    if (!currentRawText.trim()) {
      setScreen("upload");
      return;
    }

    if (translateBtn) translateBtn.disabled = false;
    lengthOptionButtons.forEach((button) => {
      button.disabled = false;
    });
    setScreen("configure");
  });
}

if (bgToggleBtn) {
  bgToggleBtn.addEventListener("click", toggleBackground);
}

render();
