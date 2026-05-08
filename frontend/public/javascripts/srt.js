
export const formatTime = (seconds) => {
  const date = new Date(0);
  date.setSeconds(seconds);
  return date.toISOString().substr(11, 12).replace('.', ',');
};

export const generateSrtCuesFromText = (
  text,
  wordsPerMinute = BASE_WPM,
  oneWordAtATime = false,
  speechRate = 1
) => {
  if (!text || !text.trim()) return [];

  const words = text.trim().split(/\s+/);
  const adjustedWpm = wordsPerMinute * speechRate;
  const wordsPerSecond = adjustedWpm / 60;
  const estimatedDurationPerWord = 1 / wordsPerSecond;

  const cues = [];
  let currentTime = 0;

  if (oneWordAtATime) {
    words.forEach((word) => {
      const wordDuration = Math.max(estimatedDurationPerWord, 0.25 / speechRate);
      cues.push({
        startTime: currentTime,
        endTime: currentTime + wordDuration,
        text: word,
      });
      currentTime += wordDuration + 0.02;
    });
  } else {
    const maxWordsPerChunk = 4;
    const maxDurationSeconds = 2;

    for (let i = 0; i < words.length; i += maxWordsPerChunk) {
      const chunkWords = words.slice(i, i + maxWordsPerChunk);
      const chunkText = chunkWords.join(' ');
      const chunkDuration = Math.max(
        chunkWords.length * estimatedDurationPerWord,
        (maxDurationSeconds * 0.7) / speechRate
      );
      cues.push({
        startTime: currentTime,
        endTime: currentTime + chunkDuration,
        text: chunkText,
      });
      currentTime += chunkDuration + 0.05;
    }
  }

  return cues;
};

export const generateSrtFromText = (
  text,
  wordsPerMinute = BASE_WPM,
  oneWordAtATime = false,
  speechRate = 1
) => {
  const cues = generateSrtCuesFromText(text, wordsPerMinute, oneWordAtATime, speechRate);
  return cues
    .map(
      (cue, index) =>
        `${index + 1}\n${formatTime(cue.startTime)} --> ${formatTime(cue.endTime)}\n${cue.text}`
    )
    .join('\n\n');
};

export const downloadSrtFile = (srtContent, filename = 'subtitles.srt') => {
  const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};