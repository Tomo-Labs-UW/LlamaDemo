const PLAY_ICON = `<svg class="transport-icon play-icon" xmlns="http://www.w3.org/2000/svg" width="22" height="27" viewBox="0 0 22 27" fill="none" aria-hidden="true"><path d="M1.5 1.5L20.1667 13.5L1.5 25.5V1.5Z" stroke="#1E1E1E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const PAUSE_ICON = `<svg class="transport-icon pause-icon" xmlns="http://www.w3.org/2000/svg" width="19" height="25" viewBox="0 0 19 25" fill="none" aria-hidden="true"><path d="M6.83333 1.5H1.5V22.8333H6.83333V1.5Z" stroke="#1E1E1E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M17.5 1.5H12.1667V22.8333H17.5V1.5Z" stroke="#1E1E1E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const SPEED_STEPS = [0.5, 1, 1.5, 2];
const BASE_CHARS_PER_SECOND = 16;

export const buildSpeechOffsets = (text = "") => {
  const offsets = [];
  const matcher = /\S+/g;
  let match = matcher.exec(text);
  while (match) {
    offsets.push(match.index);
    match = matcher.exec(text);
  }
  return offsets;
};

export const snapToWordOffset = (targetChar, speechOffsets) => {
  if (!speechOffsets.length) return Math.max(0, targetChar);
  let snapped = speechOffsets[0];
  for (const offset of speechOffsets) {
    if (offset > targetChar) break;
    snapped = offset;
  }
  return snapped;
};

export const cleanIntroBoilerplate = (text) => {
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

export { PLAY_ICON, PAUSE_ICON, SPEED_STEPS, BASE_CHARS_PER_SECOND };
