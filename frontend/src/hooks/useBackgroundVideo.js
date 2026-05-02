import { useState, useCallback, useRef } from 'react';
import { backgroundVideos } from '../backgroundVideos';

export const useBackgroundVideo = () => {
  const [backgroundVisible, setBackgroundVisible] = useState(true);
  const [activeBackgroundIndex, setActiveBackgroundIndex] = useState(0);
  const [customBackgroundUrl, setCustomBackgroundUrl] = useState("");

  const videoRef = useRef(null);
  const customBgUrlRef = useRef("");

  const applyBackgroundVideo = useCallback((index = 0) => {
    if (!videoRef.current || !backgroundVideos.length) return;

    const boundedIndex = Math.max(0, Math.min(backgroundVideos.length - 1, index));
    const selectedVideo = backgroundVideos[boundedIndex];

    const source = videoRef.current.querySelector('source');
    if (source) {
      source.src = selectedVideo.src;
      videoRef.current.style.objectFit = selectedVideo.fit === "contain" ? "contain" : "cover";
      videoRef.current.load();
    }

    setActiveBackgroundIndex(boundedIndex);

    if (backgroundVisible) {
      const playPromise = videoRef.current.play();
      if (playPromise?.catch) {
        playPromise.catch(() => {});
      }
    }
  }, [backgroundVisible]);

  const applyCustomBackground = useCallback((url) => {
    if (!videoRef.current || !url) return;

    const source = videoRef.current.querySelector('source');
    if (source) {
      source.src = url;
      videoRef.current.style.objectFit = "cover";
      videoRef.current.load();
    }

    customBgUrlRef.current = url;
    setCustomBackgroundUrl(url);

    if (backgroundVisible) {
      const playPromise = videoRef.current.play();
      if (playPromise?.catch) {
        playPromise.catch(() => {});
      }
    }
  }, [backgroundVisible]);

  const toggleBackground = useCallback(() => {
    if (!videoRef.current) return;
    const newVisibility = !backgroundVisible;
    setBackgroundVisible(newVisibility);

    if (newVisibility) {
      const playPromise = videoRef.current.play();
      if (playPromise?.catch) {
        playPromise.catch(() => {});
      }
    } else {
      videoRef.current.pause();
    }
  }, [backgroundVisible]);

  const handleCustomFile = useCallback((file) => {
    if (!file) return;

    if (customBgUrlRef.current) {
      URL.revokeObjectURL(customBgUrlRef.current);
    }

    const url = URL.createObjectURL(file);
    applyCustomBackground(url);
  }, [applyCustomBackground]);

  return {
    backgroundVisible,
    activeBackgroundIndex,
    customBackgroundUrl,
    videoRef,
    applyBackgroundVideo,
    applyCustomBackground,
    toggleBackground,
    handleCustomFile,
    setBackgroundVisible,
  };
};
