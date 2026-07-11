import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Play, Pause, Maximize, Minimize, Volume2, VolumeX, SkipBack, SkipForward, MonitorPlay } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import Hls from "hls.js";
import type { MediaItem } from "../types";

function formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return "0:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Returns true for URLs whose file extension is not natively playable by HTML5 <video>. */
function isNonBrowserFormat(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return /\.(mkv|avi|flv|wmv|mov|ts|rmvb|divx)$/.test(pathname);
  } catch {
    return false;
  }
}

export default function Player() {
  const { id, episodeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const [item, setItem] = useState<MediaItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [mpvError, setMpvError] = useState<string | null>(null);
  const [isDownloadingMpv, setIsDownloadingMpv] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  // Prevents duplicate progress pushes (e.g. double-firing on ended + pause).
  const progressPushedRef = useRef(false);

  const state = location.state as { streamUrl?: string; streamTitle?: string } | null;
  const streamUrl = state?.streamUrl;

  // Fetch media item metadata
  useEffect(() => {
    if (!id) return;
    invoke<MediaItem | null>("get_media_item_by_id", { id })
      .then((data) => { if (data) setItem(data); })
      .catch(console.error);
  }, [id]);

  // ─── Progress Sync Helper ──────────────────────────────────────────────────
  // Pushes current playback state to the local DB and AniList cloud.
  // Fire-and-forget: errors are logged but never block the UI.
  const pushProgress = useCallback(() => {
    const video = videoRef.current;
    if (!id || !video) return;
    if (progressPushedRef.current) return; // Deduplicate
    progressPushedRef.current = true;

    const episodeNum = episodeId ? parseInt(episodeId, 10) : null;
    const completed = video.duration > 0 && video.currentTime >= video.duration * 0.9;

    const progressJson = JSON.stringify({
      episode: episodeNum,
      currentTime: video.currentTime,
      duration: video.duration,
      completed,
      updatedAt: new Date().toISOString(),
    });

    // 1. Persist locally.
    invoke("update_media_progress", { id, progressJson }).catch(console.error);

    // 2. Push to AniList if we have an episode number and it's completed.
    if (item && completed && episodeNum !== null) {
      const externalIds = item.external_ids ? JSON.parse(item.external_ids) : {};
      const anilistId: number | null = externalIds?.anilist ?? null;
      if (anilistId) {
        invoke("push_progress_to_anilist", {
          anilistId,
          progress: episodeNum,
        }).catch(console.error);
      }
    }
  }, [id, episodeId, item]);

  // ─── MPV Launcher ───────────────────────────────────────────────────────────
  const launchMpv = useCallback(async () => {
    if (!streamUrl) return;
    try {
      await invoke("launch_external_player", {
        url: streamUrl,
        title: item?.title
          ? `${item.title}${episodeId ? ` - Episode ${episodeId}` : ""}`
          : undefined,
      });
      // MPV spawned — navigate back so the user isn't staring at a blank player.
      navigate(-1);
    } catch (e: any) {
      const errMsg = typeof e === "string" ? e : e?.message ?? "Failed to launch mpv";
      if (errMsg === "MPV_NOT_FOUND") {
         downloadMpv();
      } else {
         setMpvError(errMsg);
      }
    }
  }, [streamUrl, item, episodeId, navigate]);

  const downloadMpv = async () => {
      setIsDownloadingMpv(true);
      setMpvError(null);
      try {
          await invoke("download_mpv");
          // After successful download, try launching again
          await launchMpv();
      } catch (e: any) {
          setMpvError(`Failed to download MPV: ${e.toString()}`);
      } finally {
          setIsDownloadingMpv(false);
      }
  };

  // Auto-launch MPV for clearly non-browser formats instead of attempting HTML5 playback.
  useEffect(() => {
    if (streamUrl && isNonBrowserFormat(streamUrl)) {
      launchMpv();
    }
  }, [streamUrl, launchMpv]);

  // HLS Setup
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;
    // Reset dedup flag for each new stream load.
    progressPushedRef.current = false;
    
    let hls: Hls | null = null;
    const video = videoRef.current;

    if (Hls.isSupported() && (streamUrl.includes(".m3u8") || !video.canPlayType("application/vnd.apple.mpegurl"))) {
        hls = new Hls({
            debug: false,
            enableWorker: true,
        });
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(console.error);
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        setError("Network error encountered while loading the stream.");
                        hls?.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        setError("Media error encountered. Trying to recover...");
                        hls?.recoverMediaError();
                        break;
                    default:
                        hls?.destroy();
                        setError(`Fatal HLS error: ${data.details}`);
                        break;
                }
            }
        });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari native HLS
        video.src = streamUrl;
        video.addEventListener("loadedmetadata", () => {
            video.play().catch(console.error);
        });
    } else {
        // Fallback to native (mp4, webm)
        video.src = streamUrl;
    }

    return () => {
        if (hls) {
            hls.destroy();
        }
    };
  }, [streamUrl]);

  // Redirect if no stream URL
  useEffect(() => {
    if (!streamUrl) navigate(-1);
  }, [streamUrl, navigate]);

  // Auto-hide controls
  const resetHideTimeout = useCallback(() => {
    setShowControls(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  useEffect(() => {
    return () => { if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current); };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          video.paused ? video.play() : video.pause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          resetHideTimeout();
          break;
        case "ArrowRight":
          e.preventDefault();
          video.currentTime = Math.min(video.duration, video.currentTime + 10);
          resetHideTimeout();
          break;
        case "ArrowUp":
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          setVolume(video.volume);
          resetHideTimeout();
          break;
        case "ArrowDown":
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          setVolume(video.volume);
          resetHideTimeout();
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "m":
          e.preventDefault();
          video.muted = !video.muted;
          setIsMuted(video.muted);
          break;
        case "Escape":
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            navigate(-1);
          }
          break;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [navigate, resetHideTimeout]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFSChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFSChange);
    return () => document.removeEventListener("fullscreenchange", handleFSChange);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    video.paused ? video.play() : video.pause();
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    const bar = progressBarRef.current;
    if (!video || !bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = ratio * video.duration;
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  if (!streamUrl) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-[100vw] h-[100vh] bg-black z-50 flex flex-col overflow-hidden cursor-none select-none"
      onMouseMove={resetHideTimeout}
      style={{ cursor: showControls ? "default" : "none" }}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-contain bg-black"
        autoPlay
        onClick={togglePlay}
        onPlay={() => { setIsPlaying(true); resetHideTimeout(); }}
        onPause={() => {
            setIsPlaying(false);
            setShowControls(true);
            pushProgress();
          }}
        onEnded={() => {
            // Ensure progress is recorded on natural completion.
            pushProgress();
          }}
        onTimeUpdate={() => {
          const v = videoRef.current;
          if (v) setCurrentTime(v.currentTime);
        }}
        onDurationChange={() => {
          const v = videoRef.current;
          if (v && isFinite(v.duration)) setDuration(v.duration);
        }}
        onProgress={() => {
          const v = videoRef.current;
          if (v && v.buffered.length > 0) {
            setBuffered(v.buffered.end(v.buffered.length - 1));
          }
        }}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onCanPlay={() => setIsBuffering(false)}
        onError={(_e) => {
          const v = videoRef.current;
          const code = v?.error?.code;
          const msg = v?.error?.message || "";
          if (code === 4) {
            setError(`This stream format is not supported by the built-in HTML5 player. If this is an MKV or Torrent, you may need an external player.`);
          } else if (code) {
            setError(`Video playback error (Code ${code}): ${msg || "Unknown error"}`);
          }
        }}
      />

      {/* Buffering or downloading spinner */}
      {(isBuffering || isDownloadingMpv) && !error && !mpvError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20 bg-black/60 backdrop-blur-sm">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          {isDownloadingMpv && (
              <div className="text-white font-medium text-lg drop-shadow-md flex flex-col items-center">
                  <p>Setting up high-performance player...</p>
                  <p className="text-sm text-white/70 mt-1">(First-time setup, downloading MPV...)</p>
              </div>
          )}
        </div>
      )}

      {/* Error overlay */}
      {(error || mpvError) && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/80">
          <div className="bg-card border border-destructive/50 text-card-foreground p-8 rounded-xl max-w-lg text-center shadow-2xl">
            <h2 className="font-bold text-xl mb-3 text-destructive">Playback Error</h2>
            <p className="text-sm opacity-90 mb-4">{error}</p>
            {mpvError && (
              <p className="text-xs text-destructive/80 mb-4">{mpvError}</p>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={launchMpv}
                className="flex items-center gap-2 px-6 py-2.5 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/80 transition-colors"
              >
                <MonitorPlay className="w-4 h-4" />
                Open in MPV
              </button>
              <button
                onClick={() => navigate(-1)}
                className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div
        className={`absolute top-0 left-0 right-0 z-20 p-6 flex items-center gap-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        <button
          onClick={() => { pushProgress(); navigate(-1); }}
          className="p-2 rounded-full hover:bg-white/20 text-white transition-colors"
        >
          <ArrowLeft className="w-7 h-7" />
        </button>
        <div className="min-w-0">
          <h1 className="text-white font-bold text-xl truncate drop-shadow-md">
            {item ? item.title : "Loading..."}
          </h1>
          <p className="text-white/60 text-sm font-medium drop-shadow-md">
            {item?.type === "movie" ? "Movie" : `Episode ${episodeId}`}
            {state?.streamTitle && ` · ${state.streamTitle}`}
          </p>
        </div>
      </div>

      {/* Bottom Controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 px-6 pb-6 pt-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        {/* Progress Bar */}
        <div
          ref={progressBarRef}
          className="w-full h-1.5 bg-white/20 rounded-full mb-5 relative cursor-pointer group"
          onClick={handleProgressClick}
        >
          {/* Buffered */}
          <div
            className="absolute top-0 left-0 h-full bg-white/30 rounded-full transition-[width] duration-200"
            style={{ width: duration > 0 ? `${(buffered / duration) * 100}%` : "0%" }}
          />
          {/* Progress */}
          <div
            className="absolute top-0 left-0 h-full bg-primary rounded-full transition-[width] duration-100"
            style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%" }}
          />
          {/* Scrubber knob */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
            style={{
              left: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%",
              marginLeft: "-8px",
            }}
          />
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            {/* Skip Back */}
            <button
              onClick={() => { if (videoRef.current) videoRef.current.currentTime -= 10; }}
              className="text-white hover:text-primary transition-colors"
              title="Rewind 10s"
            >
              <SkipBack className="w-6 h-6" />
            </button>

            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform"
            >
              {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
            </button>

            {/* Skip Forward */}
            <button
              onClick={() => { if (videoRef.current) videoRef.current.currentTime += 10; }}
              className="text-white hover:text-primary transition-colors"
              title="Forward 10s"
            >
              <SkipForward className="w-6 h-6" />
            </button>

            {/* Volume */}
            <button onClick={toggleMute} className="text-white hover:text-primary transition-colors" title="Toggle Mute">
              {isMuted || volume === 0 ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
            </button>

            {/* Time */}
            <span className="text-white text-sm font-medium tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Fullscreen */}
            <button onClick={toggleFullscreen} className="text-white hover:text-primary transition-colors" title="Fullscreen">
              {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
