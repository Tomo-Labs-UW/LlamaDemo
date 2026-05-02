const PDFJS_MODULE_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs";
const PDFJS_WORKER_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs";
const PDF_PAGE_CONCURRENCY = 6;

let pdfjsLibPromise = null;

export const getPdfJsLib = async () => {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs").then((pdfjsLib) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return pdfjsLib;
    });
  }
  return pdfjsLibPromise;
};

const normalizeMetadataText = (value) => {
  if (typeof value !== "string") return "";
  const cleanedValue = value.trim();
  if (!cleanedValue || cleanedValue.toLowerCase() === "untitled") return "";
  return cleanedValue;
};

export const extractTextFromPdf = async (file) => {
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

  return { text: pageTexts.join("\n\n"), title, author };
};
