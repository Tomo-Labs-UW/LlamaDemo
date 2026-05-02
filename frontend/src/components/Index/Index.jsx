import { useState, useCallback, useEffect } from 'react';
import UploadSection from './UploadSection';
import MetadataPanel from './MetadataPanel';
import LengthPanel from './LengthPanel';
import OutputDisplay from './OutputDisplay';
import { usePdfExtractor, useSimplifyText, useSpeechSynthesis, useBackgroundVideo } from '../../hooks';

export default function Index() {
  // Upload state
  const [uploadMode, setUploadMode] = useState('file');
  const [selectedFile, setSelectedFile] = useState(null);
  const [textValue, setTextValue] = useState('');
  const [status, setStatus] = useState('');
  const [statusKind, setStatusKind] = useState('');

  // Content state
  const [rawText, setRawText] = useState('');
  const [inputSource, setInputSource] = useState('pdf');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [fileName, setFileName] = useState('');

  // UI state
  const [screen, setScreen] = useState('upload');
  const [selectedLength, setSelectedLength] = useState('medium');
  const [outputText, setOutputText] = useState('');
  const [currentMode, setCurrentMode] = useState('book');

  // Hooks
  const { extractPdf, isExtracting, error: pdfError } = usePdfExtractor();
  const { simplify, isSimplifying, error: simplifyError } = useSimplifyText();
  const {
    isSpeechPaused,
    speechCursorChar,
    currentSpeechRate,
    stopSpeech,
    startSpeechFrom,
    togglePauseResume,
    jumpSpeechBySeconds,
    stepSpeed,
    setSpeechCursorChar
  } = useSpeechSynthesis(outputText);
  const {
    backgroundVisible,
    activeBackgroundIndex,
    videoRef,
    applyBackgroundVideo,
    toggleBackground,
    handleCustomFile
  } = useBackgroundVideo();

  // Handle file selection
  const handleFileSelect = useCallback((file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setStatus('Please select a valid PDF file.');
      setStatusKind('error');
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
    setStatus('');
    setStatusKind('');
  }, []);

  // Handle continue from upload
  const handleUploadContinue = useCallback(async () => {
    if (uploadMode === 'text') {
      if (!textValue.trim()) {
        setStatus('Please enter text before continuing.');
        setStatusKind('error');
        return;
      }
      const firstLine = textValue.split('\n').find(l => l.trim());
      setRawText(textValue);
      setInputSource('text');
      setFileName('Manual Text Entry');
      setTitle(firstLine?.slice(0, 60) || 'Manual Text Entry');
      setAuthor('');
      setScreen('metadata');
    } else {
      if (!selectedFile) {
        setStatus('Please select a PDF file.');
        setStatusKind('error');
        return;
      }
      setStatus('Extracting text. This may take a few seconds...');
      const result = await extractPdf(selectedFile);
      if (result) {
        setRawText(result.text);
        setInputSource('pdf');
        setFileName(selectedFile.name);
        setTitle(result.title || selectedFile.name.replace(/\.pdf$/i, ''));
        setAuthor(result.author || '');
        setScreen('metadata');
      } else if (pdfError) {
        setStatus(`${pdfError}`, 'error');
      }
    }
  }, [uploadMode, textValue, selectedFile, extractPdf, pdfError]);

  // Handle metadata continue
  const handleMetadataContinue = useCallback(() => {
    setScreen('configure');
  }, []);

  // Handle translate/simplify
  const handleTranslate = useCallback(async () => {
    if (!rawText.trim()) {
      setScreen('upload');
      return;
    }

    setScreen('loading');
    setStatus('Sit tight while Tomo simplifies your reading!');

    try {
      const simplified = await simplify(rawText, selectedLength, inputSource);
      console.log(simplified);
      console.log(screen);
      console.log(status);

      if (simplified) {
        setOutputText(simplified);
        setScreen('output');
        console.log(screen);
      } else if (simplifyError) {
        setStatus(`Error: ${simplifyError}`, 'error');
        setScreen('output');
        setOutputText(rawText);
      }
    } catch (err) {
      setStatus(`Simplification failed: ${err.message}`, 'error');
      setScreen('output');
      setOutputText(rawText);
    }
  }, [rawText, selectedLength, inputSource, simplify, simplifyError]);

  // Consumption mode effects
  useEffect(() => {
    const isPlayMode = currentMode === 'play';
    const isListenMode = currentMode === 'listen';
    const showPlayback = !isPlayMode ? false : true;

    if (currentMode === 'book') {
      stopSpeech(true);
    }

    if (isPlayMode) {
      applyBackgroundVideo(activeBackgroundIndex);
    }
  }, [currentMode, stopSpeech, applyBackgroundVideo, activeBackgroundIndex]);

  useEffect(() => {
    console.log('Current screen', screen);
  }, );

  const isContinueDisabled = uploadMode === 'file' ? !selectedFile : !textValue.trim();
  const isTranslateDisabled = isSimplifying || isExtracting;

  return (
    <>
      <header className="site-header">
        <a className="brand" href="/" aria-label="Tomo Tube home">
          <span className="brand-name">TomoTube</span>
        </a>
        <section id="profile-button"></section>
      </header>

      <main className="container">
        {screen === 'upload' && (
          <UploadSection
            uploadMode={uploadMode}
            onModeChange={setUploadMode}
            onFileSelect={handleFileSelect}
            onTextChange={setTextValue}
            status={status || pdfError}
            statusKind={statusKind}
            selectedFile={selectedFile}
            textValue={textValue}
            onContinue={handleUploadContinue}
            isContinueDisabled={isContinueDisabled || isExtracting}
          />
        )}

        {screen === 'metadata' && (
          <>
            <MetadataPanel
              title={title}
              author={author}
              onTitleChange={setTitle}
              onAuthorChange={setAuthor}
              onContinue={handleMetadataContinue}
            />
          </>
        )}

        {screen === 'configure' && (
          <LengthPanel
            selectedLength={selectedLength}
            onLengthChange={setSelectedLength}
            onTranslate={handleTranslate}
            isTranslateDisabled={isTranslateDisabled}
          />
        )}

        {(screen === 'loading' || screen === 'output') && (
          <OutputDisplay
            outputText={outputText}
            title={title}
            author={author}
            fileName={fileName}
            onPlayToggle={togglePauseResume}
            onRewind={() => jumpSpeechBySeconds(-10)}
            onForward={() => jumpSpeechBySeconds(10)}
            onSpeedUp={() => stepSpeed(1)}
            onSpeedDown={() => stepSpeed(-1)}
            onProgressChange={setSpeechCursorChar}
            isSpeaking={isSpeechPaused}
            speechCursorChar={speechCursorChar}
            currentSpeechRate={currentSpeechRate}
            isPlaybackVisible={currentMode !== 'book'}
            currentMode={currentMode}
            onModeChange={setCurrentMode}
            onSettingsClick={() => {}}
            onRegenerate={() => setScreen('configure')}
          />
        )}
      </main>
    </>
  );
}
