import { useState, useCallback, useRef } from 'react';
import { buildSpeechOffsets, snapToWordOffset, SPEED_STEPS, BASE_CHARS_PER_SECOND, PLAY_ICON, PAUSE_ICON } from '../utils/speechUtils';

export const useSpeechSynthesis = (speechText) => {
  const [isSpeechPaused, setIsSpeechPaused] = useState(false);
  const [speechCursorChar, setSpeechCursorChar] = useState(0);
  const [currentSpeechRate, setCurrentSpeechRate] = useState(1);

  const synth = useRef(null);
  const utterance = useRef(null);
  const speechOffsets = useRef([]);
  const speechStartChar = useRef(0);
  const isManualSpeechCancel = useRef(false);

  const updateOffsets = useCallback(() => {
    speechOffsets.current = buildSpeechOffsets(speechText);
    setSpeechCursorChar(0);
    speechStartChar.current = 0;
  }, [speechText]);

  const stopSpeech = useCallback((silent = false) => {
    if (window.speechSynthesis) {
      isManualSpeechCancel.current = true;
      window.speechSynthesis.cancel();
      isManualSpeechCancel.current = false;
    }
    utterance.current = null;
    setIsSpeechPaused(false);
    if (!silent) {
      setSpeechCursorChar(0);
    }
  }, []);

  const startSpeechFrom = useCallback((startChar = 0) => {
    if (!("speechSynthesis" in window)) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }

    if (!speechText) return;

    const clampedStart = Math.max(0, Math.min(startChar, Math.max(0, speechText.length - 1)));
    const snappedStart = snapToWordOffset(clampedStart, speechOffsets.current);
    const remainingText = speechText.slice(snappedStart);

    if (!remainingText.trim()) {
      setSpeechCursorChar(speechText.length);
      return;
    }

    synth.current = window.speechSynthesis;
    isManualSpeechCancel.current = true;
    synth.current.cancel();
    isManualSpeechCancel.current = false;

    speechStartChar.current = snappedStart;
    setSpeechCursorChar(snappedStart);

    utterance.current = new SpeechSynthesisUtterance(remainingText);
    utterance.current.rate = currentSpeechRate;

    utterance.current.onboundary = (event) => {
      if (typeof event.charIndex === "number") {
        setSpeechCursorChar(Math.min(speechText.length, speechStartChar.current + event.charIndex));
      }
    };

    utterance.current.onend = () => {
      if (isManualSpeechCancel.current) return;
      setSpeechCursorChar(speechText.length);
      setIsSpeechPaused(false);
    };

    utterance.current.onerror = () => {
      setIsSpeechPaused(false);
    };

    setIsSpeechPaused(false);
    synth.current.speak(utterance.current);
  }, [speechText, currentSpeechRate]);

  const togglePauseResume = useCallback(() => {
    if (!("speechSynthesis" in window)) return;
    const engine = window.speechSynthesis;

    if (!speechText) {
      updateOffsets();
    }

    if (!engine.speaking && !engine.pending && !isSpeechPaused) {
      startSpeechFrom(speechCursorChar);
      return;
    }

    if (isSpeechPaused) {
      engine.resume();
      setIsSpeechPaused(false);
      return;
    }

    if (engine.speaking) {
      engine.pause();
      setIsSpeechPaused(true);
    }
  }, [speechText, speechCursorChar, isSpeechPaused, startSpeechFrom, updateOffsets]);

  const jumpSpeechBySeconds = useCallback((seconds) => {
    if (!speechText) {
      updateOffsets();
      if (!speechText) return;
    }

    const rate = currentSpeechRate;
    const charsDelta = Math.round(seconds * BASE_CHARS_PER_SECOND * rate);
    const target = Math.max(0, Math.min(speechText.length, speechCursorChar + charsDelta));
    setSpeechCursorChar(snapToWordOffset(target, speechOffsets.current));

    if (!("speechSynthesis" in window)) return;
    const engine = window.speechSynthesis;
    const wasPaused = isSpeechPaused;
    const wasSpeaking = engine.speaking || engine.pending;

    if (wasSpeaking || wasPaused) {
      if (wasPaused) {
        isManualSpeechCancel.current = true;
        engine.cancel();
        isManualSpeechCancel.current = false;
        setIsSpeechPaused(false);
        return;
      }

      startSpeechFrom(speechCursorChar);
    }
  }, [speechText, speechCursorChar, currentSpeechRate, isSpeechPaused, startSpeechFrom, updateOffsets]);

  const stepSpeed = useCallback((direction) => {
    const currentIndex = SPEED_STEPS.indexOf(currentSpeechRate);
    if (currentIndex < 0) return;
    const nextIndex = Math.max(0, Math.min(SPEED_STEPS.length - 1, currentIndex + direction));
    if (nextIndex === currentIndex) return;

    setCurrentSpeechRate(SPEED_STEPS[nextIndex]);

    if (!("speechSynthesis" in window)) return;
    const engine = window.speechSynthesis;
    const isActive = engine.speaking || engine.pending;
    if (!isActive) return;

    if (isSpeechPaused) {
      isManualSpeechCancel.current = true;
      engine.cancel();
      isManualSpeechCancel.current = false;
      setIsSpeechPaused(false);
    } else {
      startSpeechFrom(speechCursorChar);
    }
  }, [currentSpeechRate, isSpeechPaused, speechCursorChar, startSpeechFrom]);

  return {
    isSpeechPaused,
    speechCursorChar,
    currentSpeechRate,
    stopSpeech,
    startSpeechFrom,
    togglePauseResume,
    jumpSpeechBySeconds,
    stepSpeed,
    updateOffsets,
    setSpeechCursorChar,
  };
};
