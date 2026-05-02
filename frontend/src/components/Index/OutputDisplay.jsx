import { useEffect, useState } from 'react';
import { cleanIntroBoilerplate, PLAY_ICON, PAUSE_ICON, SPEED_STEPS } from '../../utils/speechUtils';

export default function OutputDisplay({
  outputText,
  title,
  author,
  fileName,
  onPlayToggle,
  onRewind,
  onForward,
  onSpeedUp,
  onSpeedDown,
  onProgressChange,
  isSpeaking,
  speechCursorChar,
  currentSpeechRate,
  isPlaybackVisible,
  currentMode,
  onModeChange,
  onSettingsClick,
  onRegenerate
}) {
  const [sentences, setSentences] = useState([]);

  useEffect(() => {
    if (!outputText) return;
    const cleanedText = cleanIntroBoilerplate(outputText);
    const parsed = cleanedText
      .replace(/\s+/g, " ")
      .trim()
      .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);
    setSentences(parsed.length ? parsed : [cleanedText]);
  }, [outputText]);

  const resolvedTitle = title || fileName?.replace(/\.pdf$/i, "").trim() || "Untitled Reading";
  const resolvedAuthor = author || fileName?.replace(/\.pdf$/i, "").trim() || "Unknown Author";

  const modes = [
    { key: 'book', label: 'View mode', icon: 'book' },
    { key: 'play', label: 'Preview', icon: 'play' },
    { key: 'listen', label: 'Audio', icon: 'audio' }
  ];

  return (
    <section className="card" id="results-section">
      <h1>TomoTube</h1>

      <div id="results-content-area" className="results-content-area">
        <div id="results-content-left" className="results-content-left">
          <div id="output" className="output">
            {sentences.length > 0 && (
              <div className="output-body">
                {sentences.map((sentence, idx) => (
                  <p key={idx}>{sentence}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <footer id="meta-footer" className="meta-footer" aria-live="polite">
        <div className="meta-context-row">
          <p className="meta-context-text">
            <span id="meta-footer-title" className="meta-title">{resolvedTitle}</span>
            <span id="meta-footer-author-wrap" className="meta-author-wrap">
              <span className="meta-by">by</span>
              <span id="meta-footer-author" className="meta-author">{resolvedAuthor}</span>
            </span>
          </p>
          {isPlaybackVisible && (
            <div className="footer-player-center">
              <div className="footer-player-controls" role="group" aria-label="Audio playback controls">
                <button
                  id="rewind-btn"
                  className="footer-control-btn"
                  type="button"
                  aria-label="Rewind 10 seconds"
                  onClick={onRewind}
                  disabled={!isPlaybackVisible}
                >
                  ⏮
                </button>
                <button
                  id="play-toggle-btn"
                  className="footer-control-btn footer-play-btn"
                  type="button"
                  aria-label="Play or pause audio"
                  onClick={onPlayToggle}
                  disabled={!isPlaybackVisible}
                >
                  {isSpeaking ? '⏸' : '▶'}
                </button>
                <button
                  id="forward-btn"
                  className="footer-control-btn"
                  type="button"
                  aria-label="Fast forward 10 seconds"
                  onClick={onForward}
                  disabled={!isPlaybackVisible}
                >
                  ⏭
                </button>
              </div>
              <div className="footer-progress-wrap">
                <input
                  id="playback-progress"
                  className="footer-progress"
                  type="range"
                  min="0"
                  max="100"
                  value={speechCursorChar}
                  onChange={(e) => onProgressChange(Number(e.target.value))}
                />
              </div>
            </div>
          )}
          <div className="footer-quick-actions" aria-label="Footer quick actions">
            <div className="quick-row">
              {modes.map((mode) => (
                <button
                  key={mode.key}
                  className={`quick-icon-btn ${currentMode === mode.key ? 'mode-active' : ''}`}
                  type="button"
                  aria-label={mode.label}
                  aria-pressed={currentMode === mode.key}
                  data-mode={mode.key}
                  onClick={() => onModeChange(mode.key)}
                >
                  {mode.label}
                </button>
              ))}
              <button
                id="settings-btn"
                className="quick-icon-btn"
                type="button"
                aria-label="Settings"
                onClick={onSettingsClick}
              >
                ⚙️
              </button>
            </div>
          </div>
        </div>
      </footer>

      <div className="output-actions">
        <button id="regenerate-btn" className="btn" type="button" onClick={onRegenerate}>
          Re-Translate
        </button>
        <a id="upload-again-btn" className="btn upload-again-btn" href="/">
          Upload Another Reading
        </a>
      </div>
    </section>
  );
}
