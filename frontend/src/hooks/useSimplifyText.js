import { useState, useCallback } from 'react';
import { simplifyText } from '../utils/simplifyApi';

export const useSimplifyText = () => {
  const [isSimplifying, setIsSimplifying] = useState(false);
  const [error, setError] = useState(null);

  const simplify = useCallback(async (rawText, outputLength = "medium", sourceType = "pdf") => {
    if (!rawText?.trim()) {
      setError("No text provided");
      return null;
    }

    try {
      setIsSimplifying(true);
      setError(null);
      const result = await simplifyText(rawText, outputLength, sourceType);
      return result;
    } catch (err) {
      const errorMessage = err.message || "Failed to simplify text";
      setError(errorMessage);
      console.error(err);
      return null;
    } finally {
      setIsSimplifying(false);
    }
  }, []);

  return { simplify, isSimplifying, error, setError };
};
