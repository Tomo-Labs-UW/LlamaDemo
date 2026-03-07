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
    window.location.href = "results.html";
  } catch (error) {
    console.error(error);
    setStatus("Failed to extract text. Please try a different PDF.", "error");
  }
};