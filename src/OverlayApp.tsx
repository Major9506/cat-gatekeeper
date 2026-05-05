import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TimerStatus,
  getTimerStatus,
  getSettings,
  getResourcePath,
  dismissBreak,
  snoozeBreak,
  onTimerTick,
  convertFileSrc,
} from './tauri';

export const OverlayApp: React.FC = () => {
  const { t } = useTranslation();
  const videoActiveRef = useRef<HTMLVideoElement>(null);
  const videoSleepRef = useRef<HTMLVideoElement>(null);
  const chromaCanvasRef = useRef<HTMLCanvasElement>(null);

  const [timerStatus, setTimerStatus] = useState<TimerStatus>({
    work_seconds_remaining: 0,
    break_seconds_remaining: 300,
    break_seconds_total: 300,
    is_break_active: true,
    is_paused: false,
  });

  const [chromaSettings, setChromaSettings] = useState<{
    enabled: boolean;
    keyR: number;
    keyG: number;
    keyB: number;
  } | null>(null);

  const [showControls, setShowControls] = useState(true);
  const chromaAnimIdRef = useRef<number | null>(null);
  const hideControlsTimerRef = useRef<number | null>(null);

  const CHROMA_TOLERANCE = 100;

  // Format time
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Load videos
  const loadVideos = useCallback(async () => {
    try {
      const activePath = await getResourcePath('catVideoActive');
      const sleepPath = await getResourcePath('catVideoSleep');

      console.log('Active video path:', activePath);
      console.log('Sleep video path:', sleepPath);

      if (activePath && videoActiveRef.current) {
        const src = convertFileSrc(activePath);
        console.log('Active video src:', src);
        videoActiveRef.current.src = src;
        videoActiveRef.current.onerror = (e) => {
          console.error('Active video failed to load:', e);
          showFallback();
        };
      } else {
        console.warn('No active video path, using fallback');
        showFallback();
        return;
      }

      if (sleepPath && videoSleepRef.current) {
        const src = convertFileSrc(sleepPath);
        console.log('Sleep video src:', src);
        videoSleepRef.current.src = src;
        videoSleepRef.current.onerror = (e) => {
          console.error('Sleep video failed to load:', e);
        };
      }

      // Get settings for chroma key configuration
      const settings = await getSettings();
      if (settings.chroma_key_enabled) {
        const color = settings.chroma_key_color;
        // Parse hex color to RGB
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        setChromaSettings({
          enabled: true,
          keyR: r,
          keyG: g,
          keyB: b,
        });
      }
    } catch (error) {
      console.error('Failed to load videos:', error);
      showFallback();
    }
  }, []);

  // Show fallback image
  const showFallback = async () => {
    try {
      const fallbackPath = await getResourcePath('fallback');
      if (fallbackPath) {
        const img = new Image();
        img.src = convertFileSrc(fallbackPath);
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.style.cssText =
            'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:1;';
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          }
          document.body.prepend(canvas);
        };
      }
    } catch (error) {
      console.warn('Failed to load fallback image');
    }
  };

  // Chroma key rendering
  const startChromaRender = useCallback((videoEl: HTMLVideoElement) => {
    if (!chromaSettings?.enabled || !chromaCanvasRef.current) return;

    const chromaCanvas = chromaCanvasRef.current;
    const chromaCtx = chromaCanvas.getContext('2d');
    if (!chromaCtx) return;

    // Stop previous animation
    if (chromaAnimIdRef.current) {
      cancelAnimationFrame(chromaAnimIdRef.current);
    }

    // Hide video, show canvas
    videoEl.style.opacity = '0';
    chromaCanvas.classList.add('active');

    const { keyR, keyG, keyB } = chromaSettings;
    const tolSq = CHROMA_TOLERANCE * CHROMA_TOLERANCE;

    const render = () => {
      if (videoEl.readyState < 2) {
        chromaAnimIdRef.current = requestAnimationFrame(render);
        return;
      }

      const cw = chromaCanvas.clientWidth;
      const ch = chromaCanvas.clientHeight;
      if (chromaCanvas.width !== cw) chromaCanvas.width = cw;
      if (chromaCanvas.height !== ch) chromaCanvas.height = ch;

      // Draw video frame
      const vw = videoEl.videoWidth;
      const vh = videoEl.videoHeight;
      if (vw && vh) {
        const scale = Math.max(cw / vw, ch / vh);
        chromaCtx.drawImage(
          videoEl,
          (cw - vw * scale) / 2,
          (ch - vh * scale) / 2,
          vw * scale,
          vh * scale
        );
      } else {
        chromaCtx.drawImage(videoEl, 0, 0, cw, ch);
      }

      // Process pixels for chroma key
      const imageData = chromaCtx.getImageData(0, 0, cw, ch);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const dr = data[i] - keyR;
        const dg = data[i + 1] - keyG;
        const db = data[i + 2] - keyB;
        if (dr * dr + dg * dg + db * db < tolSq) {
          data[i + 3] = 0;
        }
      }
      chromaCtx.putImageData(imageData, 0, 0);

      chromaAnimIdRef.current = requestAnimationFrame(render);
    };

    render();
  }, [chromaSettings]);

  const stopChromaRender = useCallback(() => {
    if (chromaAnimIdRef.current) {
      cancelAnimationFrame(chromaAnimIdRef.current);
      chromaAnimIdRef.current = null;
    }
    if (chromaCanvasRef.current) {
      chromaCanvasRef.current.classList.remove('active');
    }
  }, []);

  // Play sound
  const playSound = useCallback(async () => {
    try {
      const settings = await getSettings();
      if (settings.sound_enabled) {
        const soundPath = await getResourcePath('sound');
        if (soundPath) {
          const audio = new Audio(convertFileSrc(soundPath));
          audio.play().catch(() => {});
        }
      }
    } catch (error) {
      console.warn('Failed to play sound:', error);
    }
  }, []);

  // Initialize
  useEffect(() => {
    loadVideos();
    playSound();

    // Get initial timer status
    getTimerStatus().then((status) => {
      if (status.is_break_active) {
        setTimerStatus(status);
      }
    });

    // Setup timer tick listener
    let unlisten: (() => void) | null = null;
    onTimerTick((data) => {
      if (data.is_break_active) {
        setTimerStatus(data);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    // Prevent scrolling
    const preventScroll = (e: Event) => e.preventDefault();
    document.addEventListener('wheel', preventScroll, { passive: false });
    document.addEventListener('touchmove', preventScroll, { passive: false });

    return () => {
      if (unlisten) unlisten();
      document.removeEventListener('wheel', preventScroll);
      document.removeEventListener('touchmove', preventScroll);
    };
  }, [loadVideos, playSound]);

  // Video ended - switch to sleeping
  useEffect(() => {
    const videoActive = videoActiveRef.current;
    if (!videoActive) return;

    const handleEnded = () => {
      if (chromaSettings?.enabled) {
        stopChromaRender();
        if (videoSleepRef.current) {
          startChromaRender(videoSleepRef.current);
        }
      } else {
        videoActive.style.display = 'none';
      }
      if (videoSleepRef.current) {
        videoSleepRef.current.classList.add('sleeping');
        videoSleepRef.current.play().catch(() => showFallback());
      }
    };

    videoActive.addEventListener('ended', handleEnded);
    return () => videoActive.removeEventListener('ended', handleEnded);
  }, [chromaSettings, startChromaRender, stopChromaRender]);

  // Auto-hide controls
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
      hideControlsTimerRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 3000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
    };
  }, []);

  // Handle keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismissBreak();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle dismiss
  const handleDismiss = () => {
    dismissBreak();
  };

  // Handle snooze
  const handleSnooze = () => {
    snoozeBreak();
  };

  return (
    <div className="overlay-container">
      {/* Primary cat video (active) */}
      <video
        ref={videoActiveRef}
        id="catVideoActive"
        muted
        playsInline
        autoPlay
        preload="auto"
        onError={(e) => {
          console.error('Active video element error:', e);
          showFallback();
        }}
      />

      {/* Secondary cat video (sleeping) */}
      <video
        ref={videoSleepRef}
        id="catVideoSleep"
        muted
        playsInline
        loop
        preload="auto"
        onError={(e) => {
          console.error('Sleep video element error:', e);
        }}
      />

      {/* Chroma key canvas */}
      <canvas ref={chromaCanvasRef} id="chromaCanvas" />

      {/* Timer Display */}
      <div className="timer-display">
        {formatTime(timerStatus.break_seconds_remaining)}
      </div>

      {/* UI Controls */}
      <div className={`ui-overlay ${showControls ? '' : 'hidden'}`}>
        <div className="reminder-text">{t('overlay.reminder')}</div>
        <div className="actions">
          <button onClick={handleSnooze} className="btn btn-secondary">
            {t('overlay.snooze')}
          </button>
          <button onClick={handleDismiss} className="btn btn-primary">
            {t('overlay.done')}
          </button>
        </div>
      </div>
    </div>
  );
};
