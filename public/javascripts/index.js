/**
 * FILE FOR FRONT END MANAGEMENT
 */

/** Import pdf parsing packages */
import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs";

/** Define page elements */
const dropZone = document.getElementById("drop-zone");
const pdfInput = document.getElementById("pdf-input");
const statusEl = document.getElementById("status");

console.log(dropZone, pdfInput, statusEl);

/** Set variables */
let selectedFile = null;
const setStatus = (text, kind = "") => {
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

/**
 * Extracts text from the given PDF file.
 * Inputs: a PDF format file.
 * Outputs: an map where keys are page numbers (int) and values are the page text (string).
*/
const extractTextFromPdf = async (file) => {
  console.log("Beginning to extract text from given PDF");

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const pages = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(" ");
    pages.push(pageText);
  }

  console.log("End of PDF text extraction process");
  return pages.join("\n\n");
};

/**
 * Extracts text from the given pdf, and sets the status of the process
 */
const processSelectedPdf = async () => {
  if (!selectedFile) return;

  try {
    console.log("Starting extraction process");

    setStatus("Extracting text. This may take a few seconds...");

    const extractedText = await extractTextFromPdf(selectedFile);

    console.log("Your extracted text is: ", extractedText);

    if (!extractedText.trim()) {
      setStatus("No readable text found in this PDF.", "error");
      return;
    }

    localStorage.setItem("tomodemo:raw_text", extractedText);
    localStorage.setItem("tomodemo:file_name", selectedFile.name);

    // Show results section and hide upload section
    document.querySelector("#results-section").classList.remove("hidden");
    document.querySelector("#upload-section").classList.add("hidden");

  } catch (error) {
    console.error(error);
    setStatus("Failed to extract text. Please try a different PDF.", "error");
  }
};

/**
 * RENDERING SIMPLIFIED OUTPUT
 */

const output = document.getElementById("output");
const sourceBox = document.getElementById("source-box");
const statusPanel = document.getElementById("status-panel");

const fileName = localStorage.getItem("tomodemo:file_name");
const rawText = localStorage.getItem("tomodemo:raw_text");

let monitorIntervalId = null;
let monitorStartTime = 0;
let latestStatus = {
  backend: "unknown",
  ollamaReachable: false,
  model: "unknown",
  modelAvailable: false,
  details: "Waiting for status..."
};

const renderStatusPanel = (phase = "Working...") => {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - monitorStartTime) / 1000));
  const backendText = latestStatus.backend === "ok" ? "Backend: online" : "Backend: checking...";
  const ollamaText = latestStatus.ollamaReachable ? "AI server (Ollama): reachable" : "AI server (Ollama): not reachable";
  const modelText = latestStatus.modelAvailable
    ? `Model: ${latestStatus.model} available`
    : `Model: ${latestStatus.model} not available`;

  statusPanel.innerHTML = "";

  const phaseEl = document.createElement("p");
  phaseEl.className = "status-line";
  phaseEl.textContent = `${phase} (${elapsedSeconds}s)`;
  statusPanel.appendChild(phaseEl);

  const backendEl = document.createElement("p");
  backendEl.className = "status-line";
  backendEl.textContent = backendText;
  statusPanel.appendChild(backendEl);

  const ollamaEl = document.createElement("p");
  ollamaEl.className = "status-line";
  ollamaEl.textContent = ollamaText;
  statusPanel.appendChild(ollamaEl);

  const modelEl = document.createElement("p");
  modelEl.className = "status-line";
  modelEl.textContent = modelText;
  statusPanel.appendChild(modelEl);

  const detailsEl = document.createElement("p");
  detailsEl.className = "status-line status-detail";
  detailsEl.textContent = latestStatus.details || "";
  statusPanel.appendChild(detailsEl);
};

const fetchStatus = async () => {
  try {
    const response = await fetch(`http://localhost:3001/api/status?ts=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache"
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      latestStatus = {
        ...latestStatus,
        details: data.error || `Status check failed (${response.status})`
      };
      return;
    }
    latestStatus = { ...latestStatus, ...data };
  } catch (error) {
    latestStatus = {
      ...latestStatus,
      details: `Could not reach status endpoint: ${error.message}`
    };
  }
};

const startStatusMonitor = async () => {
  monitorStartTime = Date.now();
  await fetchStatus();
  renderStatusPanel("Simplifying text...");

  monitorIntervalId = setInterval(async () => {
    await fetchStatus();
    renderStatusPanel("Simplifying text...");
  }, 2500);
};

const stopStatusMonitor = (finalMessage) => {
  if (monitorIntervalId) {
    clearInterval(monitorIntervalId);
    monitorIntervalId = null;
  }
  renderStatusPanel(finalMessage);
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

const renderOutput = (text, note = "", isError = false) => {
  output.innerHTML = "";
  sourceBox.innerHTML = "";

  if (fileName) {
    const source = document.createElement("div");
    source.className = "source-badge";
    source.textContent = `Source: ${fileName}`;
    sourceBox.appendChild(source);
  }

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
};

const render = async () => {
  if (!rawText) {
    output.textContent = "No extracted text found. Go back and upload a PDF first.";
    statusPanel.textContent = "No upload data found.";
    return;
  }

  output.textContent = "Preparing simplified output...";
  await startStatusMonitor();

  try {
    const simplifiedText = await simplifyText(rawText);
    renderOutput(simplifiedText);
    stopStatusMonitor("Simplification complete");
  } catch (error) {
    console.error(error);
    renderOutput(
      rawText,
      `Could not generate simplified output yet. Reason: ${error.message} Showing extracted text instead.`,
      true
    );
    stopStatusMonitor("Simplification failed");
  }
};

render();