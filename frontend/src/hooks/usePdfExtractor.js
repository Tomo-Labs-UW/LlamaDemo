import { useState, useCallback } from 'react';
import { extractTextFromPdf } from '../utils/pdfExtractor';

export const usePdfExtractor = () => {
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState(null);

  const extractPdf = useCallback(async (file) => {
    if (!file || file.type !== "application/pdf") {
      setError("Please select a valid PDF file.");
      return null;
    }

    try {
      setIsExtracting(true);
      setError(null);
      const result = await extractTextFromPdf(file);
      return result;
    } catch (err) {
      const errorMessage = err.message || "Failed to extract text from PDF";
      setError(errorMessage);
      console.error(err);
      return null;
    } finally {
      setIsExtracting(false);
    }
  }, []);

  return { extractPdf, isExtracting, error, setError };
};
