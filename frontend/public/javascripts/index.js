/**
 * FILE FOR FRONT END MANAGEMENT
 */

import { backgroundVideos } from "./backgroundVideos.js";
import { generateSrtFromText, generateSrtCuesFromText, downloadSrtFile } from "./srt.js";

/** PDF.js is lazy-loaded so initial page load is not blocked by a large module fetch */
const PDFJS_MODULE_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs";
const PDFJS_WORKER_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs";
const PDF_PAGE_CONCURRENCY = 6;
const UI_TEST_OUTPUT_ONLY = false;
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
const landingPage = document.getElementById("landing-page");
const landingStartBtn = document.getElementById("landing-start-btn");
const uploadSection = document.getElementById("upload-section");
const resultsSection = document.getElementById("results-section");

/** Background Control */
const bgToggleBtn = document.getElementById("bg-toggle-btn");
const bgVideo = document.getElementById("bg-video");
const bgThumbButtons = Array.from(document.querySelectorAll(".background-thumb[data-bg-index]"));
const bgVideoSource = bgVideo?.querySelector("source");
const customBgBtn = document.getElementById("custom-bg-btn");
const customBgInput = document.getElementById("custom-bg-input");

let backgroundVisible = true;
let activeBackgroundVideoIndex = 0;
let customBackgroundUrl = "";

console.log(dropZone, pdfInput, statusEl);

/** Set variables */
let selectedFile = null;
let uploadInputMode = "file";
let currentInputSource = "pdf";
let selectedOutputLength = "medium";
let selectedTone = "educational";
let latestSimplifyWarning = "";
let landingActive = Boolean(landingPage);
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
 * TESTING: commented
 */
// if (landingStartBtn) {
//   landingStartBtn.addEventListener("click", () => {
//     landingActive = false;
//     if (landingPage) landingPage.classList.add("hidden");
//     if (uploadSection) uploadSection.classList.remove("hidden");
//     setScreen("upload");
//   });
// }

/**
 * Function for getting simplified text from backend API
 */
const getSelectedOutputLength = () => {
  return selectedOutputLength;
};

export const simplifyText = async (rawText, outputLength = "medium", sourceType = "pdf") => {
  if (!rawText?.trim()) {
    latestSimplifyWarning = "";
    return "";
  }

  const runtimeApiUrl = typeof window.API_URL === "string" ? window.API_URL.trim() : "";
  const API_URL = runtimeApiUrl.replace(/\/+$/, "");
  const endpoint = API_URL ? `${API_URL}/api/simplify` : "/api/simplify";
  const localhostFallbackEndpoint = "http://localhost:3001/api/simplify";
  const canUseLocalFallback =
    !API_URL &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: rawText, length: outputLength, sourceType, tone: selectedTone })
    });
  } catch (error) {
    if (canUseLocalFallback) {
      try {
        response = await fetch(localhostFallbackEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: rawText, length: outputLength, sourceType, tone: selectedTone })
        });
      } catch (fallbackError) {
        console.log(fallbackError);
        throw new Error(`Could not reach backend /api/simplify. ${fallbackError.message}`);
      }
    } else {
      console.log(error);
      throw new Error(`Could not reach backend /api/simplify. ${error.message}`);
    }
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const messageParts = [data.error || `Simplify request failed (${response.status}).`];
    if (data.details) {
      messageParts.push(String(data.details));
    }
    throw new Error(messageParts.join(" "));
  }

  // latestSimplifyWarning = "";
  // if (data?.likelyTruncated) {
  //   latestSimplifyWarning = "Output may have been cut off near the end. Try Regenerate for a fully completed ending.";
  // } else if (data?.warning) {
  //   const warningText = String(data.warning);
  //   const suppressLengthWarning =
  //     /rewrite\s+succe(?:ss|ed)\w*/i.test(warningText) &&
  //     /did not fully meet target length/i.test(warningText);
  //   latestSimplifyWarning = suppressLengthWarning ? "" : warningText;
  // }

  document.getElementById("output").textContent = data.simplified;

  return (data.simplified || rawText).trim();
};

/**
 * SRT Generation Functions
 */
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
  toneOptionButtons.forEach((button) => {
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
  toneOptionButtons.forEach((button) => {
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
const outputBackBtn = document.getElementById("output-back-btn");
const outputActions = document.getElementById("output-actions");
const regenerateBtn = document.getElementById("regenerate-btn");
const downloadSrtBtn = document.getElementById("download-srt-btn");
const wordByWordCheckbox = document.getElementById("word-by-word-checkbox");
const subtitleOverlay = document.getElementById("subtitle-overlay");
const sourceBox = document.getElementById("source-box");
const metadataPanel = document.getElementById("metadata-panel");
const titleInput = document.getElementById("title-input");
const authorInput = document.getElementById("author-input");
const metadataContinueBtn = document.getElementById("metadata-continue-btn");
const lengthPanel = document.getElementById("length-panel");
const statusPanel = document.getElementById("status-panel");
const translateBtn = document.getElementById("translate-btn");
const lengthOptionButtons = Array.from(document.querySelectorAll(".length-option"));
const toneOptionButtons = Array.from(document.querySelectorAll(".tone-option"));
const complexityInfoBtn = document.getElementById("complexity-info-btn");
const complexityInfoPopup = document.getElementById("complexity-info-popup");
const uploadAgainBtn = document.getElementById("upload-again-btn");
const rewindBtn = document.getElementById("rewind-btn");
const playToggleBtn = document.getElementById("play-toggle-btn");
const forwardBtn = document.getElementById("forward-btn");
const speedValue = document.getElementById("speed-value");
const speedUpBtn = document.getElementById("speed-up-btn");
const speedDownBtn = document.getElementById("speed-down-btn");
const playbackProgress = document.getElementById("playback-progress");
const voiceButtons = Array.from(document.querySelectorAll(".voice-btn"));
const highlightSwatches = Array.from(document.querySelectorAll(".customize-highlight-swatch"));
const footerPlayerCenter = document.querySelector(".footer-player-center");
const quickModeButtons = Array.from(document.querySelectorAll(".quick-icon-btn[data-mode]"));
const settingsBtn = document.getElementById("settings-btn");
const quickBookmarkBtn = document.querySelector(".quick-bookmark-btn");
const customizePanel = document.getElementById("customize-panel");
const customizeCloseBtn = document.getElementById("customize-close-btn");
const customizeOpenBtn = document.getElementById("customize-open-btn");
const metaFooter = document.getElementById("meta-footer");
const metaFooterTitle = document.getElementById("meta-footer-title");
const metaFooterAuthor = document.getElementById("meta-footer-author");
const metaFooterAuthorWrap = document.getElementById("meta-footer-author-wrap");

let currentFileName = "";
let currentRawText = "";
let currentTitle = "";
let currentAuthor = "";
let currentRenderedOutputText = "";
let subtitleCues = [];
let currentSubtitleIndex = -1;
let lyricSentenceEls = [];
let activeLyricCueIndex = -1;
let synth = null;
let utterance = null;
let speechText = "";
let speechOffsets = [];
let speechStartChar = 0;
let speechCursorChar = 0;
let isSpeechPaused = false;
let isManualSpeechCancel = false;
let lemonfoxVoices = [];
let selectedLemonfoxVoice = "sarah";
let lemonfoxAudio = new Audio();
lemonfoxAudio.preload = "auto";
let lemonfoxAudioObjectUrl = "";
let lemonfoxAudioCacheKey = "";
let lemonfoxCachedText = "";
const lemonfoxAudioBlobCache = new Map();
const lemonfoxAudioPendingRequests = new Map();
const BASE_CHARS_PER_SECOND = 16;
const PLAY_ICON = `<svg class="transport-icon play-icon" xmlns="http://www.w3.org/2000/svg" width="22" height="27" viewBox="0 0 22 27" fill="none" aria-hidden="true"><path d="M1.5 1.5L20.1667 13.5L1.5 25.5V1.5Z" stroke="#1E1E1E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const PAUSE_ICON = `<svg class="transport-icon pause-icon" xmlns="http://www.w3.org/2000/svg" width="19" height="25" viewBox="0 0 19 25" fill="none" aria-hidden="true"><path d="M6.83333 1.5H1.5V22.8333H6.83333V1.5Z" stroke="#1E1E1E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M17.5 1.5H12.1667V22.8333H17.5V1.5Z" stroke="#1E1E1E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const SPEED_STEPS = [0.5, 1, 1.5, 2];
const SENTENCE_BOOKMARK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19 21L12 16L5 21V5C5 4.46957 5.21071 3.96086 5.58579 3.58579C5.96086 3.21071 6.46957 3 7 3H17C17.5304 3 18.0391 3.21071 18.4142 3.58579C18.7893 3.96086 19 4.46957 19 5V21Z" fill="#17A592" stroke="#17A592" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
let currentSpeechRate = 1;
const CONSUMPTION_MODES = {
  BOOK: "book",
  PLAY: "play",
  LISTEN: "listen"
};
let currentConsumptionMode = CONSUMPTION_MODES.BOOK;
const LEMONFOX_STATIC_VOICES = [
  { id: "sarah", label: "Voice 1 - Sarah" },
  { id: "emma", label: "Voice 2 - Emma" },
  { id: "michael", label: "Voice 3 - Michael" },
  { id: "bella", label: "Voice 4 - Bella" },
  { id: "nova", label: "Voice 5 - Nova" },
  { id: "alloy", label: "Voice 6 - Alloy" }
];

const buildLemonfoxCacheKey = (voiceId, text) => `${voiceId}::${text}`;

const formatVoiceName = (voice) => {
  if (!voice) return "";
  const rawLabel = String(voice.label || voice.id || "").trim();
  if (!rawLabel) return "";
  const withoutPrefix = rawLabel.replace(/^voice\s*\d+\s*-\s*/i, "").trim();
  return withoutPrefix || rawLabel;
};

const getApiBaseUrl = () => {
  const runtimeApiUrl = typeof window.API_URL === "string" ? window.API_URL.trim() : "";
  return runtimeApiUrl.replace(/\/+$/, "");
};

const getApiEndpoint = (path) => {
  const baseUrl = getApiBaseUrl();
  return baseUrl ? `${baseUrl}${path}` : path;
};

const isLemonfoxMode = () =>
  currentConsumptionMode === CONSUMPTION_MODES.PLAY ||
  currentConsumptionMode === CONSUMPTION_MODES.LISTEN;

const stopLemonfoxAudio = () => {
  lemonfoxAudio.pause();
  lemonfoxAudio.currentTime = 0;
  updatePlaybackProgress();
  resetPlaybackUi();
  if (playToggleBtn) playToggleBtn.innerHTML = PLAY_ICON;
};

const setActiveVoiceButton = () => {
  voiceButtons.forEach((button, index) => {
    const voice = lemonfoxVoices[index];
    const isActive = Boolean(voice && voice.id === selectedLemonfoxVoice);
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
};

const renderVoiceButtons = (voices) => {
  voiceButtons.forEach((button, index) => {
    const voice = voices[index];
    button.classList.toggle("hidden", !voice);
    button.disabled = !voice;
    if (!voice) return;
    button.dataset.voiceId = voice.id;
    button.textContent = formatVoiceName(voice);
  });
  setActiveVoiceButton();
};

const applySelectedHighlightColor = (swatch) => {
  const selectedColor = swatch?.dataset?.highlightColor;
  const selectedBookmarkColor = swatch?.dataset?.bookmarkColor;
  if (selectedColor) {
    document.documentElement.style.setProperty("--selected-highlight-color", selectedColor);
  }
  if (selectedBookmarkColor) {
    document.documentElement.style.setProperty("--selected-bookmark-color", selectedBookmarkColor);
  }
};

const initializeLemonfoxVoices = async () => {
  try {
    const response = await fetch(getApiEndpoint("/api/tts-voices"));
    if (!response.ok) throw new Error(`Voice list request failed (${response.status})`);
    const data = await response.json().catch(() => null);
    if (Array.isArray(data) && data.length) {
      lemonfoxVoices = data.slice(0, 6);
    } else {
      lemonfoxVoices = [...LEMONFOX_STATIC_VOICES];
    }
  } catch (_error) {
    lemonfoxVoices = [...LEMONFOX_STATIC_VOICES];
  }

  if (!lemonfoxVoices.some((voice) => voice.id === selectedLemonfoxVoice)) {
    selectedLemonfoxVoice = lemonfoxVoices[0].id;
  }
  renderVoiceButtons(lemonfoxVoices);
};

const ensureLemonfoxAudio = async () => {
  const text = getReadableOutputText().trim();
  if (!text) return false;

  const cacheKey = buildLemonfoxCacheKey(selectedLemonfoxVoice, text);
  if (lemonfoxAudioCacheKey === cacheKey && lemonfoxAudio.src) return true;

  const cachedBlob = lemonfoxAudioBlobCache.get(cacheKey);
  if (cachedBlob) {
    if (lemonfoxAudioObjectUrl) URL.revokeObjectURL(lemonfoxAudioObjectUrl);
    lemonfoxAudioObjectUrl = URL.createObjectURL(cachedBlob);
    lemonfoxAudio.src = lemonfoxAudioObjectUrl;
    lemonfoxAudioCacheKey = cacheKey;
    return true;
  }

  let pendingRequest = lemonfoxAudioPendingRequests.get(cacheKey);
  if (!pendingRequest) {
    pendingRequest = fetch(getApiEndpoint("/api/tts"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: selectedLemonfoxVoice, language: "en-us" })
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(errorBody.error || `TTS request failed (${response.status}).`);
        }
        return response.blob();
      })
      .finally(() => {
        lemonfoxAudioPendingRequests.delete(cacheKey);
      });

    lemonfoxAudioPendingRequests.set(cacheKey, pendingRequest);
  }

  const audioBlob = await pendingRequest;
  lemonfoxAudioBlobCache.set(cacheKey, audioBlob);
  if (lemonfoxAudioObjectUrl) {
    URL.revokeObjectURL(lemonfoxAudioObjectUrl);
  }
  lemonfoxAudioObjectUrl = URL.createObjectURL(audioBlob);
  lemonfoxAudio.src = lemonfoxAudioObjectUrl;
  lemonfoxAudioCacheKey = cacheKey;
  return true;
};

const prefetchLemonfoxVoiceAudio = (text) => {
  const normalizedText = (text || "").trim();
  if (!normalizedText || !lemonfoxVoices.length) return;
  if (lemonfoxCachedText !== normalizedText) {
    lemonfoxCachedText = normalizedText;
    lemonfoxAudioBlobCache.clear();
  }

  const voicesToPrefetch = lemonfoxVoices
    .slice(0, 6)
    .sort((a, b) => (a.id === selectedLemonfoxVoice ? -1 : b.id === selectedLemonfoxVoice ? 1 : 0));
  voicesToPrefetch.forEach((voice, index) => {
    const delayMs = index === 0 ? 0 : index * 160;
    window.setTimeout(() => {
      const cacheKey = buildLemonfoxCacheKey(voice.id, normalizedText);
      if (lemonfoxAudioBlobCache.has(cacheKey) || lemonfoxAudioPendingRequests.has(cacheKey)) return;

      const pendingRequest = fetch(getApiEndpoint("/api/tts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: normalizedText, voice: voice.id, language: "en-us" })
      })
        .then(async (response) => {
          if (!response.ok) return null;
          const blob = await response.blob();
          lemonfoxAudioBlobCache.set(cacheKey, blob);
          return blob;
        })
        .catch(() => null)
        .finally(() => {
          lemonfoxAudioPendingRequests.delete(cacheKey);
        });

      lemonfoxAudioPendingRequests.set(cacheKey, pendingRequest);
    }, delayMs);
  });
};

const setComplexityInfoOpen = (isOpen) => {
  if (!complexityInfoPopup || !complexityInfoBtn) return;
  complexityInfoPopup.classList.toggle("hidden", !isOpen);
  complexityInfoBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
};

const setCustomizePanelOpen = (isOpen) => {
  if (!resultsSection || !customizePanel || !settingsBtn) return;
  customizePanel.classList.toggle("minimized", !isOpen);
  resultsSection.classList.toggle("customize-open", isOpen);
  settingsBtn.setAttribute("aria-pressed", isOpen ? "true" : "false");
  settingsBtn.classList.toggle("mode-active", isOpen);
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
  if (showUpload && landingActive) {
    uploadSection.classList.add("hidden");
    resultsSection.classList.add("hidden");
    if (customizePanel) customizePanel.classList.add("hidden");
    return;
  }
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
  document.body.classList.toggle("hide-app-header", isOutput);
  if (customizePanel) customizePanel.classList.toggle("hidden", !isOutput);

  resultsSection.classList.toggle("setup-mode", isSetupScreen);

  if (metadataPanel) metadataPanel.classList.toggle("hidden", !isMetadata);
  if (lengthPanel) lengthPanel.classList.toggle("hidden", !isConfigure);
  sourceBox.classList.add("hidden");
  if (metaFooter) metaFooter.classList.toggle("hidden", !isOutput);
  statusPanel.classList.toggle("hidden", !isLoading);
  statusPanel.classList.toggle("status-panel-centered", isLoading);
  outputWrap.classList.toggle("hidden", !isOutput);
  if (outputBackBtn) outputBackBtn.classList.toggle("hidden", !isOutput);

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

  const withoutStockLeadIns = text
    .trim()
    .replace(
      /^(okay|alright|so)\s*,?\s*(let(?:'|’)s|lets)\s+(?:break\s+down|go\s+through|walk\s+through)\s+(?:this|it)\s*[:,.-]?\s*/i,
      ""
    );

  const lines = withoutStockLeadIns
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
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/^#{1,6}\s+/g, "")
        .replace(/^[-*]\s+/g, "")
        .replace(/^\d+\.\s+/g, "")
    )
    .filter(Boolean);

  return cleaned.join("\n\n").trim() || text.trim();
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

const applyBackgroundVisibility = (isVisible) => {
  if (!outputWrap) return;
  backgroundVisible = Boolean(isVisible);

  if (backgroundVisible) {
    // Show video background
    outputWrap.classList.remove("bg-off");
    outputWrap.classList.add("bg-on");
    if (bgVideo) {
      const playPromise = bgVideo.play();
      if (playPromise?.catch) {
        playPromise.catch(() => {});
      }
    }
    if (bgToggleBtn) bgToggleBtn.textContent = "Hide Video Background";
    return;
  }

  // Hide video background, show solid white
  outputWrap.classList.remove("bg-on");
  outputWrap.classList.add("bg-off");
  if (bgVideo) bgVideo.pause();
  if (bgToggleBtn) bgToggleBtn.textContent = "Show Video Background";
};

const setActiveBackgroundThumb = (index) => {
  bgThumbButtons.forEach((button) => {
    const buttonIndex = Number(button.dataset.bgIndex);
    button.classList.toggle("is-active", buttonIndex === index);
  });
  if (customBgBtn) customBgBtn.classList.toggle("is-active", false);
};

const applyBackgroundVideo = (index) => {
  if (!bgVideo || !bgVideoSource || !backgroundVideos.length) return;
  const nextIndex = Number.isFinite(index) ? index : 0;
  const boundedIndex = Math.max(0, Math.min(backgroundVideos.length - 1, nextIndex));
  const selectedVideo = backgroundVideos[boundedIndex];

  activeBackgroundVideoIndex = boundedIndex;
  bgVideoSource.src = selectedVideo.src;
  bgVideo.style.objectFit = selectedVideo.fit === "contain" ? "contain" : "cover";
  bgVideo.load();
  setActiveBackgroundThumb(boundedIndex);

  if (backgroundVisible) {
    const playPromise = bgVideo.play();
    if (playPromise?.catch) {
      playPromise.catch(() => {});
    }
  }
};

const applyCustomBackgroundVideo = (url) => {
  if (!bgVideo || !bgVideoSource || !url) return;
  bgVideoSource.src = url;
  bgVideo.style.objectFit = "cover";
  bgVideo.load();
  bgThumbButtons.forEach((button) => button.classList.toggle("is-active", false));
  if (customBgBtn) {
    customBgBtn.classList.add("is-active");
    customBgBtn.dataset.label = "Custom Video";
  }

  if (backgroundVisible) {
    const playPromise = bgVideo.play();
    if (playPromise?.catch) {
      playPromise.catch(() => {});
    }
  }
};

const initializeBackgroundSelector = () => {
  if (!bgThumbButtons.length || !backgroundVideos.length) return;

  bgThumbButtons.forEach((button) => {
    const idx = Number(button.dataset.bgIndex);
    const fallbackIndex = Number.isFinite(idx)
      ? ((idx % backgroundVideos.length) + backgroundVideos.length) % backgroundVideos.length
      : 0;
    const selectedVideo = backgroundVideos[idx] || backgroundVideos[fallbackIndex];
    if (!selectedVideo) return;

    button.dataset.label = selectedVideo.label;
    button.setAttribute("aria-label", `Use background video: ${selectedVideo.label}`);
    button.addEventListener("click", () => {
      applyBackgroundVideo(backgroundVideos[idx] ? idx : fallbackIndex);
    });
  });

  if (customBgBtn) {
    customBgBtn.dataset.label = "Add Your Own";
    customBgBtn.addEventListener("click", () => {
      customBgInput?.click();
    });
  }

  if (customBgInput) {
    customBgInput.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (customBackgroundUrl) {
        URL.revokeObjectURL(customBackgroundUrl);
      }
      customBackgroundUrl = URL.createObjectURL(file);
      applyCustomBackgroundVideo(customBackgroundUrl);
      customBgInput.value = "";
    });
  }

  applyBackgroundVideo(activeBackgroundVideoIndex);
};

const toggleBackground = () => {
  if (!outputWrap) return;
  const isOn = outputWrap.classList.contains("bg-on") && !outputWrap.classList.contains("bg-off");
  applyBackgroundVisibility(!isOn);
};

const setFooterPlaybackVisible = (isVisible) => {
  if (footerPlayerCenter) {
    footerPlayerCenter.classList.toggle("footer-player-center-inactive", !isVisible);
    footerPlayerCenter.setAttribute("aria-hidden", !isVisible ? "true" : "false");
  }

  [rewindBtn, playToggleBtn, forwardBtn, speedUpBtn, speedDownBtn, playbackProgress].forEach((control) => {
    if (!control) return;
    control.disabled = !isVisible;
    if (!isVisible) {
      control.setAttribute("tabindex", "-1");
    } else {
      control.removeAttribute("tabindex");
    }
  });
  updateSpeedControlsUi();
};

/**
 * Function that applies the selected consumption mode (play, book, listen) to the UI and functionality 
 */
const applyConsumptionMode = (mode) => {
  const resolvedMode =
    mode === CONSUMPTION_MODES.BOOK || mode === CONSUMPTION_MODES.LISTEN
      ? mode
      : CONSUMPTION_MODES.PLAY;
  currentConsumptionMode = resolvedMode;

  quickModeButtons.forEach((item) => {
    const isActive = item.dataset.mode === resolvedMode;
    item.classList.toggle("mode-active", isActive);
    item.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  const isBookMode = resolvedMode === CONSUMPTION_MODES.BOOK;
  const isPlayMode = resolvedMode === CONSUMPTION_MODES.PLAY;
  const isListenMode = resolvedMode === CONSUMPTION_MODES.LISTEN;
  const canUseTomomize = true;
  const showPlayback = !isBookMode;

  setFooterPlaybackVisible(showPlayback);
  if (isBookMode) {
    stopSpeech();
  }
  if (!isListenMode) {
    stopLemonfoxAudio();
  }

  // Background is mode-driven; no manual toggle option.
  if (bgToggleBtn) bgToggleBtn.classList.add("hidden");
  applyBackgroundVisibility(isPlayMode);

  if (resultsSection) {
    resultsSection.classList.toggle("tomomize-enabled", canUseTomomize);
    resultsSection.classList.toggle("tomomize-disabled", !canUseTomomize);
    resultsSection.classList.toggle("mode-book", isBookMode);
    resultsSection.classList.toggle("mode-play", isPlayMode);
    resultsSection.classList.toggle("mode-listen", isListenMode);
  }
  if (settingsBtn) {
    settingsBtn.disabled = !canUseTomomize;
    settingsBtn.setAttribute("aria-disabled", !canUseTomomize ? "true" : "false");
    settingsBtn.classList.toggle("is-disabled", !canUseTomomize);
  }
  if (!canUseTomomize) {
    setCustomizePanelOpen(false);
  }

  if (currentRenderedOutputText.trim()) {
    renderOutputBodyForMode(currentRenderedOutputText, resolvedMode);
  }

  if (isListenMode && getReadableOutputText().trim()) {
    prefetchLemonfoxVoiceAudio(getReadableOutputText());
    ensureLemonfoxAudio().catch(() => {});
  }

  lyricSentenceEls.forEach((sentence) => {
    sentence.style.cursor = isListenMode ? "pointer" : "text";
  });

  // Refresh subtitle cues when mode changes so play-mode captions update correctly.
  setVideoSubtitleCues(getReadableOutputText(), isWordByWordMode());
};

const splitOutputTextForMode = (text, mode) => {
  const normalized = (text || "").trim();
  if (!normalized) return [];

  if (mode === CONSUMPTION_MODES.LISTEN) {
    return normalized
      .replace(/\s+/g, " ")
      .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);
  }

  if (mode === CONSUMPTION_MODES.BOOK) {
    const byBlankLines = normalized
      .split(/\n\s*\n+/)
      .map((chunk) => chunk.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (byBlankLines.length > 1) return byBlankLines;

    const bySingleLines = normalized
      .split(/\n+/)
      .map((chunk) => chunk.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (bySingleLines.length > 1) return bySingleLines;

    const sentences = normalized
      .replace(/\s+/g, " ")
      .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);
    if (sentences.length <= 1) return [normalized];

    const paragraphTargetLength = 220;
    const autoParagraphs = [];
    let currentParagraph = "";
    sentences.forEach((sentence) => {
      const candidate = currentParagraph ? `${currentParagraph} ${sentence}` : sentence;
      if (candidate.length > paragraphTargetLength && currentParagraph) {
        autoParagraphs.push(currentParagraph);
        currentParagraph = sentence;
      } else {
        currentParagraph = candidate;
      }
    });
    if (currentParagraph) autoParagraphs.push(currentParagraph);
    return autoParagraphs;
  }

  return normalized
    .split(/\n\s*\n+/)
    .map((chunk) => chunk.replace(/\s+/g, " ").trim())
    .filter(Boolean);
};

const renderOutputBodyForMode = (text, mode) => {
  const chunks = splitOutputTextForMode(text, mode);
  const existingBody = output.querySelector(".output-body");
  if (existingBody) existingBody.remove();

  const body = document.createElement("div");
  body.className = "output-body";

  if (!chunks.length) {
    const empty = document.createElement("p");
    empty.textContent = text;
    body.appendChild(empty);
  } else {
    chunks.forEach((chunk) => {
      const p = document.createElement("p");
      p.textContent = chunk;
      body.appendChild(p);
    });
  }

  output.appendChild(body);
  indexOutputWordsForLyrics();
  syncSpeechText();
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
  currentRenderedOutputText = cleanedText;
  renderOutputBodyForMode(cleanedText, currentConsumptionMode);
  setVideoSubtitleCues(getReadableOutputText(), isWordByWordMode());

  if (outputActions) outputActions.classList.remove("hidden");
  if (uploadAgainBtn) uploadAgainBtn.classList.remove("hidden");
  if (regenerateBtn) regenerateBtn.classList.remove("hidden");
  applyConsumptionMode(currentConsumptionMode);
  prefetchLemonfoxVoiceAudio(getReadableOutputText());
};

const getReadableOutputText = () => {
  const lines = [];
  output.querySelectorAll(".output-body p").forEach((p) => {
    if (p.textContent.trim()) lines.push(p.textContent.trim());
  });
  return lines.join("\n\n");
};

const getSpeechRate = () => {
  return currentSpeechRate;
};

const updateSpeedControlsUi = () => {
  if (speedValue) speedValue.textContent = `${currentSpeechRate}x`;
  const speedIndex = SPEED_STEPS.indexOf(currentSpeechRate);
  const playbackHidden = footerPlayerCenter?.classList.contains("footer-player-center-inactive");
  if (speedDownBtn) speedDownBtn.disabled = Boolean(playbackHidden || speedIndex <= 0);
  if (speedUpBtn) speedUpBtn.disabled = Boolean(playbackHidden || speedIndex >= SPEED_STEPS.length - 1);
};

const updatePlaybackProgress = () => {
  if (!playbackProgress) return;
  if (isLemonfoxMode() && lemonfoxAudio.duration) {
    playbackProgress.max = String(Math.max(1, Math.floor(lemonfoxAudio.duration)));
    playbackProgress.value = String(Math.max(0, Math.floor(lemonfoxAudio.currentTime || 0)));
    return;
  }
  const total = Math.max(1, speechText.length || 1);
  const current = Math.max(0, Math.min(total, speechCursorChar));
  playbackProgress.max = String(total);
  playbackProgress.value = String(current);
};

const updatePlayButtonLabel = () => {
  if (!playToggleBtn) return;
  if (isLemonfoxMode()) {
    playToggleBtn.innerHTML = lemonfoxAudio.paused ? PLAY_ICON : PAUSE_ICON;
    return;
  }
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

const isWordByWordMode = () => {
  return Boolean(wordByWordCheckbox?.checked);
};

const getSpeechWordIndex = () => {
  if (!speechOffsets.length) return 0;
  let index = 0;
  while (index + 1 < speechOffsets.length && speechCursorChar >= speechOffsets[index + 1]) {
    index += 1;
  }
  return index;
};

const indexOutputWordsForLyrics = () => {
  const isListenMode = currentConsumptionMode === CONSUMPTION_MODES.LISTEN;
  lyricSentenceEls = [];
  const paragraphs = Array.from(output.querySelectorAll(".output-body p"));
  paragraphs.forEach((paragraph, index) => {
    const sentenceText = (paragraph.querySelector(".sentence-text")?.textContent || paragraph.textContent || "").trim();
    let textEl = paragraph.querySelector(".sentence-text");
    if (!textEl) {
      textEl = document.createElement("span");
      textEl.className = "sentence-text";
      textEl.textContent = sentenceText;
      paragraph.textContent = "";
      paragraph.appendChild(textEl);
    }

    paragraph.classList.add("lyric-sentence");
    paragraph.classList.remove("is-active");
    paragraph.classList.remove("is-past");
    paragraph.dataset.lyricSentenceIndex = String(index);
    paragraph.style.cursor = "text";

    const existingBookmarkBtn = paragraph.querySelector(".sentence-bookmark-btn");
    if (isListenMode) {
      let bookmarkBtn = existingBookmarkBtn;
      if (!bookmarkBtn) {
        bookmarkBtn = document.createElement("button");
        bookmarkBtn.type = "button";
        bookmarkBtn.className = "sentence-bookmark-btn";
        bookmarkBtn.setAttribute("aria-label", "Bookmark sentence");
        bookmarkBtn.setAttribute("aria-pressed", "false");
        bookmarkBtn.innerHTML = SENTENCE_BOOKMARK_ICON;
        paragraph.appendChild(bookmarkBtn);
      }
    } else if (existingBookmarkBtn) {
      existingBookmarkBtn.remove();
      paragraph.classList.remove("is-bookmarked");
    }

    lyricSentenceEls.push(paragraph);
  });
};

const jumpToLyricSentence = async (sentenceIndex) => {
  if (currentConsumptionMode !== CONSUMPTION_MODES.LISTEN) return;
  const cue = subtitleCues[sentenceIndex];
  if (!cue || !Number.isFinite(cue.startTime)) return;

  try {
    await ensureLemonfoxAudio();
  } catch (_error) {
    return;
  }
  const cueDuration = Math.max(0, (cue.endTime || cue.startTime) - cue.startTime);
  const preroll = Math.min(1.25, Math.max(0.18, cueDuration * 0.45));
  const previousCueEnd =
    sentenceIndex > 0 && subtitleCues[sentenceIndex - 1]
      ? subtitleCues[sentenceIndex - 1].endTime
      : 0;
  const seekTime = Math.max(previousCueEnd + 0.01, cue.startTime - preroll);

  lemonfoxAudio.currentTime = seekTime;
  lemonfoxAudio.play().catch(() => {});
  updatePlaybackProgress();
  updatePlayButtonLabel();
  syncListenLyrics();
};

const buildSentenceSyncedCues = (totalDurationSeconds) => {
  const totalDuration = Number(totalDurationSeconds);
  if (!Number.isFinite(totalDuration) || totalDuration <= 0 || !lyricSentenceEls.length) return [];

  const estimateSentenceSpeechUnits = (text) => {
    const normalized = (text || "").trim();
    if (!normalized) return 1;

    const words = normalized.split(/\s+/).filter(Boolean);
    const cleanedWordChars = normalized.replace(/[^a-zA-Z]/g, "");
    const commaPauses = (normalized.match(/[,:;]/g) || []).length;
    const terminalPauses = (normalized.match(/[.!?]["')\]]*$/g) || []).length;

    // Rough syllable proxy: vowel clusters map closer to spoken duration than raw char count.
    const syllableEstimate = words.reduce((sum, word) => {
      const clusters = (word.toLowerCase().match(/[aeiouy]+/g) || []).length;
      return sum + Math.max(1, clusters);
    }, 0);

    const wordCadence = words.length * 1.9;
    const charCadence = cleanedWordChars.length * 0.22;
    const punctuationCadence = commaPauses * 2.4 + terminalPauses * 4.6;

    return Math.max(1, syllableEstimate * 1.7 + wordCadence + charCadence + punctuationCadence);
  };

  const units = lyricSentenceEls
    .map((el) => (el.textContent || "").trim())
    .filter(Boolean)
    .map((text) => ({ text, weight: estimateSentenceSpeechUnits(text) }));
  if (!units.length) return [];

  const gap = 0.09;
  const totalGap = gap * Math.max(0, units.length - 1);
  const usableDuration = Math.max(0.1, totalDuration - totalGap);
  const totalWeight = units.reduce((sum, unit) => sum + unit.weight, 0) || 1;

  const cues = [];
  let currentTime = 0;
  units.forEach((unit, index) => {
    const isLast = index === units.length - 1;
    const proportionalDuration = (usableDuration * unit.weight) / totalWeight;
    const duration = isLast ? Math.max(0.08, totalDuration - currentTime) : Math.max(0.4, proportionalDuration);
    const endTime = isLast ? totalDuration : Math.min(totalDuration, currentTime + duration);
    cues.push({ startTime: currentTime, endTime, text: unit.text });
    currentTime = endTime + (isLast ? 0 : gap);
  });
  return cues;
};

const findCueIndexAtTime = (cues, time, previousIndex = -1) => {
  if (!cues.length || !Number.isFinite(time)) return -1;

  // Fast-path around the previous cue to avoid frequent full scans.
  if (
    previousIndex >= 0 &&
    previousIndex < cues.length &&
    time >= cues[previousIndex].startTime &&
    time <= cues[previousIndex].endTime
  ) {
    return previousIndex;
  }
  if (
    previousIndex + 1 < cues.length &&
    previousIndex + 1 >= 0 &&
    time >= cues[previousIndex + 1].startTime &&
    time <= cues[previousIndex + 1].endTime
  ) {
    return previousIndex + 1;
  }

  let low = 0;
  let high = cues.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const cue = cues[mid];
    if (time < cue.startTime) {
      high = mid - 1;
    } else if (time > cue.endTime) {
      low = mid + 1;
    } else {
      return mid;
    }
  }

  // If in a tiny timing gap, snap to nearest cue boundary.
  const before = Math.max(0, high);
  const after = Math.min(cues.length - 1, low);
  const beforeGap = Math.abs(time - cues[before].endTime);
  const afterGap = Math.abs(cues[after].startTime - time);
  return beforeGap <= afterGap ? before : after;
};

const clearLyricHighlight = () => {
  lyricSentenceEls.forEach((sentence) => {
    sentence.classList.remove("is-active");
    sentence.classList.remove("is-past");
  });
  activeLyricCueIndex = -1;
};

const syncListenLyrics = () => {
  if (currentConsumptionMode !== CONSUMPTION_MODES.LISTEN || !subtitleCues.length || !lyricSentenceEls.length) {
    clearLyricHighlight();
    return;
  }

  const t = lemonfoxAudio.currentTime;
  if (!Number.isFinite(t)) return;

  const cueIndex = findCueIndexAtTime(subtitleCues, t, activeLyricCueIndex);
  if (cueIndex === activeLyricCueIndex) return;

  clearLyricHighlight();
  if (cueIndex < 0) return;

  lyricSentenceEls.forEach((sentence, idx) => {
    if (idx < cueIndex) sentence.classList.add("is-past");
    if (idx === cueIndex) sentence.classList.add("is-active");
  });
  const activeSentence = lyricSentenceEls[cueIndex];
  if (activeSentence) {
    activeSentence.scrollIntoView({
      behavior: lemonfoxAudio.paused ? "auto" : "smooth",
      block: "center",
      inline: "nearest",
    });
  }
  activeLyricCueIndex = cueIndex;
};

const generateDurationSyncedCues = (text, totalDurationSeconds, oneWordAtATime = false) => {
  const normalizedText = (text || "").trim();
  const totalDuration = Number(totalDurationSeconds);
  if (!normalizedText || !Number.isFinite(totalDuration) || totalDuration <= 0) return [];

  const words = normalizedText.split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const units = [];
  if (oneWordAtATime) {
    words.forEach((word) => units.push({ text: word, weight: Math.max(1, word.length) }));
  } else {
    const chunkSize = 4;
    for (let i = 0; i < words.length; i += chunkSize) {
      const chunkWords = words.slice(i, i + chunkSize);
      const chunkText = chunkWords.join(" ");
      units.push({
        text: chunkText,
        weight: Math.max(1, chunkText.replace(/\s+/g, "").length),
      });
    }
  }

  const gap = oneWordAtATime ? 0.01 : 0.03;
  const totalGap = gap * Math.max(0, units.length - 1);
  const usableDuration = Math.max(0.1, totalDuration - totalGap);
  const totalWeight = units.reduce((sum, unit) => sum + unit.weight, 0) || 1;

  const cues = [];
  let currentTime = 0;

  units.forEach((unit, index) => {
    const isLast = index === units.length - 1;
    const proportionalDuration = (usableDuration * unit.weight) / totalWeight;
    const duration = isLast
      ? Math.max(0.05, totalDuration - currentTime)
      : Math.max(oneWordAtATime ? 0.08 : 0.25, proportionalDuration);
    const endTime = isLast ? totalDuration : Math.min(totalDuration, currentTime + duration);
    cues.push({ startTime: currentTime, endTime, text: unit.text });
    currentTime = endTime + (isLast ? 0 : gap);
  });

  return cues;
};

/**
 * SUBTITLE FUNCTIONS
 */

const updateSubtitleOverlayFromSpeech = () => {
  if (!subtitleOverlay || !isWordByWordMode()) return;
  if (!speechText.trim() || !speechOffsets.length) {
    subtitleOverlay.textContent = "";
    subtitleOverlay.classList.add("hidden");
    return;
  }

  const words = speechText.trim().split(/\s+/);
  const wordIndex = getSpeechWordIndex();
  const currentText = words[wordIndex] || "";

  subtitleOverlay.textContent = currentText;
  subtitleOverlay.classList.toggle("hidden", !currentText);
};

const setVideoSubtitleCues = (text, oneWordAtATime = false) => {
  const hasLemonfoxTimeline =
    isLemonfoxMode() && Number.isFinite(lemonfoxAudio.duration) && lemonfoxAudio.duration > 0;
  subtitleCues =
    currentConsumptionMode === CONSUMPTION_MODES.LISTEN && hasLemonfoxTimeline
      ? buildSentenceSyncedCues(lemonfoxAudio.duration)
      : hasLemonfoxTimeline
        ? generateDurationSyncedCues(text, lemonfoxAudio.duration, oneWordAtATime)
        : generateSrtCuesFromText(text, 150, oneWordAtATime);
  currentSubtitleIndex = -1;

  if (!subtitleOverlay) return;
  if (!subtitleCues.length) {
    subtitleOverlay.textContent = "";
    subtitleOverlay.classList.add("hidden");
    clearLyricHighlight();
    return;
  }
  syncListenLyrics();

  subtitleOverlay.textContent = "";
  subtitleOverlay.classList.remove("hidden");
  syncSubtitleOverlay();
};


const syncSubtitleOverlay = () => {
  if (!subtitleOverlay || !subtitleCues.length) {
    if (subtitleOverlay) subtitleOverlay.classList.add("hidden");
    return;
  }

  if (
    currentConsumptionMode === CONSUMPTION_MODES.BOOK ||
    currentConsumptionMode === CONSUMPTION_MODES.LISTEN
  ) {
    subtitleOverlay.classList.add("hidden");
    syncListenLyrics();
    return;
  }

  if (isWordByWordMode() && !isLemonfoxMode()) {
    updateSubtitleOverlayFromSpeech();
    return;
  }

  const currentTime = isLemonfoxMode() ? lemonfoxAudio.currentTime : bgVideo?.currentTime;
  if (!Number.isFinite(currentTime)) {
    subtitleOverlay.classList.add("hidden");
    return;
  }
  let nextIndex = currentSubtitleIndex;

  if (
    nextIndex < 0 ||
    currentTime < subtitleCues[nextIndex].startTime ||
    currentTime > subtitleCues[nextIndex].endTime
  ) {
    nextIndex = subtitleCues.findIndex(
      (cue) => currentTime >= cue.startTime && currentTime <= cue.endTime
    );
  }

  if (nextIndex === currentSubtitleIndex) return;

  currentSubtitleIndex = nextIndex;
  const nextText = nextIndex >= 0 ? subtitleCues[nextIndex].text : "";
  subtitleOverlay.textContent = nextText;
  subtitleOverlay.classList.toggle("hidden", !nextText);
};

/**
 * TEXT-TO-SPEECH CONTROLS 
 */

const stopSpeech = (silent = false) => {
  if (isLemonfoxMode()) {
    stopLemonfoxAudio();
    return;
  }
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

  updateSubtitleOverlayFromSpeech();



  // Sync subtitle overlay on video timeupdate when speaking, 
  // to ensure alignment even if speech events are inconsistent.

  utterance.onboundary = (event) => {
  if (typeof event.charIndex === "number") {
    speechCursorChar = Math.min(speechText.length, speechStartChar + event.charIndex);
    updatePlaybackProgress();
    updateSubtitleOverlayFromSpeech();
    syncSubtitleOverlay();
  }
};

  utterance.onend = () => {
    if (isManualSpeechCancel) return;
    speechCursorChar = speechText.length;
    updatePlaybackProgress();
    updateSubtitleOverlayFromSpeech();
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

/**
 * PLAYBACK CONTROL HANDLERS
 */

const togglePauseResume = async () => {
  if (isLemonfoxMode()) {
    if (lemonfoxAudio.paused) {
      try {
        const ok = await ensureLemonfoxAudio();
        if (!ok) return;
        lemonfoxAudio.playbackRate = currentSpeechRate;
        try {
          await lemonfoxAudio.play();
        } catch (_playError) {
          const retryAfterMetadata = async () => {
            lemonfoxAudio.removeEventListener("loadedmetadata", retryAfterMetadata);
            try {
              await lemonfoxAudio.play();
              updatePlayButtonLabel();
            } catch (_retryError) {
              // keep silent; user can tap play again
            }
          };
          lemonfoxAudio.addEventListener("loadedmetadata", retryAfterMetadata, { once: true });
          return;
        }
        updatePlayButtonLabel();
      } catch (error) {
        alert(`Could not generate voice audio: ${error.message}`);
      }
      return;
    }
    lemonfoxAudio.pause();
    updatePlayButtonLabel();
    return;
  }

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
  if (isLemonfoxMode()) {
    if (!lemonfoxAudio.duration) return;
    const next = Math.max(0, Math.min(lemonfoxAudio.duration, (lemonfoxAudio.currentTime || 0) + seconds));
    lemonfoxAudio.currentTime = next;
    updatePlaybackProgress();
    return;
  }

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
  updateSpeedControlsUi();

  if (isLemonfoxMode()) {
    lemonfoxAudio.playbackRate = currentSpeechRate;
    return;
  }

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

const stepSpeed = (direction) => {
  const currentIndex = SPEED_STEPS.indexOf(currentSpeechRate);
  if (currentIndex < 0) return;
  const nextIndex = Math.max(0, Math.min(SPEED_STEPS.length - 1, currentIndex + direction));
  if (nextIndex === currentIndex) return;
  currentSpeechRate = SPEED_STEPS[nextIndex];
  updateSpeed();
};

if (playToggleBtn) playToggleBtn.addEventListener("click", togglePauseResume);
if (rewindBtn) rewindBtn.addEventListener("click", () => jumpSpeechBySeconds(-10));
if (forwardBtn) forwardBtn.addEventListener("click", () => jumpSpeechBySeconds(10));
if (playbackProgress) {
  playbackProgress.addEventListener("input", () => {
    if (isLemonfoxMode() && lemonfoxAudio.duration) {
      lemonfoxAudio.currentTime = Number(playbackProgress.value || "0");
      updatePlaybackProgress();
      return;
    }
    if (!speechText) return;
    const nextPosition = Number(playbackProgress.value || "0");
    speechCursorChar = snapToWordOffset(nextPosition);
    updatePlaybackProgress();
  });
}
if (speedUpBtn) speedUpBtn.addEventListener("click", () => stepSpeed(1));
if (speedDownBtn) speedDownBtn.addEventListener("click", () => stepSpeed(-1));

voiceButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const nextVoice = button.dataset.voiceId;
    if (!nextVoice) return;
    if (nextVoice === selectedLemonfoxVoice) return;
    const resumeFrom = lemonfoxAudio.currentTime || 0;
    const wasPlaying = isLemonfoxMode() && !lemonfoxAudio.paused;

    selectedLemonfoxVoice = nextVoice;
    lemonfoxAudioCacheKey = "";
    setActiveVoiceButton();

    try {
      const ok = await ensureLemonfoxAudio();
      if (!ok) return;
      if (resumeFrom > 0) {
        lemonfoxAudio.currentTime = Math.min(resumeFrom, lemonfoxAudio.duration || resumeFrom);
      }
      if (wasPlaying) {
        await lemonfoxAudio.play();
      }
      updatePlayButtonLabel();
      updatePlaybackProgress();
    } catch (_error) {
      // Keep UI responsive; fallback happens on next play attempt.
    }
  });
});

highlightSwatches.forEach((swatch) => {
  swatch.addEventListener("click", () => {
    highlightSwatches.forEach((item) => {
      const isActive = item === swatch;
      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
    applySelectedHighlightColor(swatch);
  });
});

applySelectedHighlightColor(
  highlightSwatches.find((swatch) => swatch.classList.contains("is-active")) || highlightSwatches[0]
);

/**
 * Switching Modes
 */

quickModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyConsumptionMode(button.dataset.mode);
  });
});

if (settingsBtn && customizePanel) {
  settingsBtn.addEventListener("click", () => {
    const shouldOpen = !resultsSection?.classList.contains("customize-open");
    setCustomizePanelOpen(shouldOpen);
  });
}

if (quickBookmarkBtn) {
  quickBookmarkBtn.addEventListener("click", () => {
    const shouldActivate = quickBookmarkBtn.getAttribute("aria-pressed") !== "true";
    quickBookmarkBtn.setAttribute("aria-pressed", shouldActivate ? "true" : "false");
    quickBookmarkBtn.classList.toggle("mode-active", shouldActivate);
  });
}

if (customizeCloseBtn) {
  customizeCloseBtn.addEventListener("click", () => {
    setCustomizePanelOpen(false);
  });
}

if (customizeOpenBtn) {
  customizeOpenBtn.addEventListener("click", () => {
    setCustomizePanelOpen(true);
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

/**
 * Simplication Flow
 */

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
  toneOptionButtons.forEach((button) => {
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
    renderOutput(simplifiedText, latestSimplifyWarning, false);
    setScreen("output");
    stopStatusMonitor();
  } catch (error) {
    console.error(error);
    renderOutput(currentRawText);
    setScreen("output");
    stopStatusMonitor();
  } finally {
    if (translateBtn) translateBtn.disabled = false;
    lengthOptionButtons.forEach((button) => {
      button.disabled = false;
    });
    toneOptionButtons.forEach((button) => {
      button.disabled = false;
    });
  }
};

const render = async () => {
  if (output) {
    output.addEventListener("click", async (event) => {
      const bookmarkBtn = event.target?.closest?.(".sentence-bookmark-btn");
      if (bookmarkBtn) {
        event.preventDefault();
        event.stopPropagation();
        const nextState = !bookmarkBtn.classList.contains("is-bookmarked");
        bookmarkBtn.classList.toggle("is-bookmarked", nextState);
        bookmarkBtn.setAttribute("aria-pressed", nextState ? "true" : "false");
        const sentence = bookmarkBtn.closest(".lyric-sentence");
        if (sentence) sentence.classList.toggle("is-bookmarked", nextState);
        return;
      }

      const sentence = event.target?.closest?.(".lyric-sentence");
      if (!sentence) return;
      const index = Number(sentence.dataset.lyricSentenceIndex);
      if (!Number.isFinite(index)) return;
      await jumpToLyricSentence(index);
    });
  }
  lemonfoxAudio.addEventListener("timeupdate", updatePlaybackProgress);
  lemonfoxAudio.addEventListener("timeupdate", syncSubtitleOverlay);
  lemonfoxAudio.addEventListener("timeupdate", syncListenLyrics);
  lemonfoxAudio.addEventListener("loadedmetadata", () => {
    lemonfoxAudio.playbackRate = currentSpeechRate;
    setVideoSubtitleCues(getReadableOutputText(), isWordByWordMode());
    syncSubtitleOverlay();
    syncListenLyrics();
  });
  lemonfoxAudio.addEventListener("ended", () => {
    updatePlaybackProgress();
    resetPlaybackUi();
    syncListenLyrics();
    if (playToggleBtn) playToggleBtn.innerHTML = PLAY_ICON;
  });
  await initializeLemonfoxVoices();

  if (UI_TEST_OUTPUT_ONLY) {
    currentInputSource = "text";
    currentFileName = "UI Test";
    currentTitle = "UI Test";
    currentAuthor = "Manual Text Entry";
    currentRawText = "This is a UI-only output preview for customize panel testing.";
    renderOutput(currentRawText);
    applyConsumptionMode(CONSUMPTION_MODES.LISTEN);
    setScreen("output");
    setCustomizePanelOpen(true);
    return;
  }

  if (translateBtn) translateBtn.disabled = true;
  lengthOptionButtons.forEach((button) => {
    button.disabled = true;
  });
  toneOptionButtons.forEach((button) => {
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
    toneOptionButtons.forEach((button) => {
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

toneOptionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const value = String(button.dataset.tone || "").toLowerCase();
    if (!["educational", "conversational", "comedic", "simplistic", "original"].includes(value)) return;
    selectedTone = value;

    toneOptionButtons.forEach((item) => {
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
    toneOptionButtons.forEach((button) => {
      button.disabled = false;
    });
    setScreen("configure");
  });
}

if (outputBackBtn) {
  outputBackBtn.addEventListener("click", () => {
    setScreen("upload");
    setCustomizePanelOpen(false);
  });
}

if (downloadSrtBtn) {
  downloadSrtBtn.addEventListener("click", () => {
    const outputText = output?.textContent || '';
    if (!outputText.trim()) {
      alert('No text available to generate SRT subtitles.');
      return;
    }
    
    const oneWordAtATime = wordByWordCheckbox?.checked || false;
    const srtContent = generateSrtFromText(outputText, 150, oneWordAtATime);
    const filename = `${currentTitle || 'subtitles'}.srt`;
    downloadSrtFile(srtContent, filename);
  });
}

if (wordByWordCheckbox) {
  wordByWordCheckbox.addEventListener("change", () => {
    setVideoSubtitleCues(getReadableOutputText(), isWordByWordMode());
  });
}

if (bgVideo) {
  bgVideo.addEventListener("timeupdate", syncSubtitleOverlay);
  bgVideo.addEventListener("seeked", syncSubtitleOverlay);
}

if (bgToggleBtn) {
  bgToggleBtn.addEventListener("click", toggleBackground);
}

render();
applyConsumptionMode(CONSUMPTION_MODES.BOOK);
initializeBackgroundSelector();
updateSpeedControlsUi();
