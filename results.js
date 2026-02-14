import { simplifyText } from "./api.js";

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
    const response = await fetch("http://localhost:3001/api/status");
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
