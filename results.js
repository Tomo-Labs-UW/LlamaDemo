import { simplifyText } from "./api.js";

const output = document.getElementById("output");
const sourceBox = document.getElementById("source-box");
const statusPanel = document.getElementById("status-panel");
const ttsBtn = document.getElementById("tts-btn");
const ttsControls = document.getElementById("tts-controls");
const playPauseBtn = document.getElementById("play-pause-btn");
const stopBtn = document.getElementById("stop-btn");
const speedSlider = document.getElementById("speed-slider");
const speedValue = document.getElementById("speed-value");

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

    // Add continue button for errors
    if (isError) {
      const continueBtn = document.createElement("button");
      continueBtn.className = "btn";
      continueBtn.textContent = "Continue with Original Text";
      continueBtn.style.marginTop = "10px";
      continueBtn.onclick = () => {
        // Remove the error note and continue button, show TTS button
        noteEl.remove();
        continueBtn.remove();
        ttsBtn.style.display = "inline-block";
      };
      output.appendChild(continueBtn);
    }
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
  if (!isError) {
    ttsBtn.style.display = "inline-block";
  }
};

let speechSynthesis = null;
let currentUtterance = null;
let isPlaying = false;
let currentWordIndex = 0;
let words = [];

const getSimplifiedText = () => {
  const paragraphs = [];
  output.querySelectorAll(".output-body p").forEach((p) => {
    if (p.textContent.trim()) {
      paragraphs.push(p.textContent.trim());
    }
  });
  return paragraphs.join("\n\n");
};

const splitTextIntoWords = (text) => {
  // Split text into words, keeping punctuation attached
  return text.split(/(\s+)/).filter(word => word.trim().length > 0);
};

const highlightWord = (wordIndex) => {
  // Remove previous highlights
  document.querySelectorAll('.highlight').forEach(el => {
    el.classList.remove('highlight');
  });

  if (wordIndex >= 0 && wordIndex < words.length) {
    const word = words[wordIndex];
    const paragraphs = output.querySelectorAll('.output-body p');

    let currentIndex = 0;
    for (const p of paragraphs) {
      const text = p.textContent;
      const wordStart = text.indexOf(word);

      if (wordStart !== -1) {
        // Create a span for highlighting
        const before = text.substring(0, wordStart);
        const highlighted = text.substring(wordStart, wordStart + word.length);
        const after = text.substring(wordStart + word.length);

        p.innerHTML = `${before}<span class="highlight">${highlighted}</span>${after}`;
        break;
      }
      currentIndex += text.length + 1; // +1 for newline
    }
  }
};

const speakText = () => {
  if (!('speechSynthesis' in window)) {
    alert('Your browser does not support speech synthesis. Please use a modern browser like Chrome or Edge.');
    return;
  }

  const text = getSimplifiedText();
  if (!text) {
    alert("No text available to convert to speech.");
    return;
  }

  // Stop any current speech
  if (speechSynthesis) {
    speechSynthesis.cancel();
  }

  speechSynthesis = window.speechSynthesis;
  words = splitTextIntoWords(text);
  currentWordIndex = 0;

  currentUtterance = new SpeechSynthesisUtterance(text);
  currentUtterance.rate = parseFloat(speedSlider.value);
  currentUtterance.pitch = 1;
  currentUtterance.volume = 1;

  // Try to use a female voice if available
  const voices = speechSynthesis.getVoices();
  const femaleVoice = voices.find(voice => voice.name.toLowerCase().includes('female') || voice.name.toLowerCase().includes('sarah') || voice.name.toLowerCase().includes('zira'));
  if (femaleVoice) {
    currentUtterance.voice = femaleVoice;
  }

  currentUtterance.onstart = () => {
    isPlaying = true;
    playPauseBtn.textContent = "⏸️ Pause";
    ttsBtn.disabled = true;
  };

  currentUtterance.onend = () => {
    isPlaying = false;
    playPauseBtn.textContent = "▶️ Play";
    ttsBtn.disabled = false;
    highlightWord(-1); // Remove highlights
    currentWordIndex = 0;
  };

  currentUtterance.onerror = (event) => {
    console.error('Speech synthesis error:', event);
    isPlaying = false;
    playPauseBtn.textContent = "▶️ Play";
    ttsBtn.disabled = false;
    highlightWord(-1);
  };

  // Word boundary detection for highlighting (approximate)
  let charIndex = 0;
  currentUtterance.onboundary = (event) => {
    if (event.name === 'word') {
      // Find which word we're at based on character position
      let cumulativeLength = 0;
      for (let i = 0; i < words.length; i++) {
        if (cumulativeLength + words[i].length >= event.charIndex) {
          currentWordIndex = i;
          highlightWord(currentWordIndex);
          break;
        }
        cumulativeLength += words[i].length + 1; // +1 for space
      }
    }
  };

  speechSynthesis.speak(currentUtterance);
};

const togglePlayPause = () => {
  if (!speechSynthesis) {
    speakText();
    return;
  }

  if (isPlaying) {
    speechSynthesis.pause();
    playPauseBtn.textContent = "▶️ Resume";
    isPlaying = false;
  } else {
    speechSynthesis.resume();
    playPauseBtn.textContent = "⏸️ Pause";
    isPlaying = true;
  }
};

const stopSpeech = () => {
  if (speechSynthesis) {
    speechSynthesis.cancel();
  }
  isPlaying = false;
  playPauseBtn.textContent = "▶️ Play";
  ttsBtn.disabled = false;
  highlightWord(-1);
  currentWordIndex = 0;
};

const updateSpeed = () => {
  speedValue.textContent = speedSlider.value + 'x';
  if (currentUtterance) {
    currentUtterance.rate = parseFloat(speedSlider.value);
  }
};

// Event listeners
ttsBtn.addEventListener("click", () => {
  ttsControls.style.display = "block";
  ttsBtn.style.display = "none";
  speakText();
});

playPauseBtn.addEventListener("click", togglePlayPause);
stopBtn.addEventListener("click", stopSpeech);
speedSlider.addEventListener("input", updateSpeed);

// Load voices when available
if ('speechSynthesis' in window) {
  speechSynthesis = window.speechSynthesis;
  if (speechSynthesis.getVoices().length === 0) {
    speechSynthesis.onvoiceschanged = () => {
      // Voices loaded
    };
  }
}

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
