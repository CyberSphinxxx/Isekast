import { Play, Loader2, Plus, Check, MonitorPlay } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import type { MediaItem } from "../types";

interface StremioStream {
    name?: string;
    title?: string;
    url?: string;
    info_hash?: string;
}

/** Returns true for URLs whose file extension is not natively playable by HTML5 <video>. */
function isExternalFormat(url?: string): boolean {
  if (!url) return false;
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return /\.(mkv|avi|flv|wmv|mov|ts|rmvb|divx)$/.test(pathname);
  } catch {
    return false;
  }
}

export default function MediaDetails() {
  const { id, mediaType } = useParams();
  const navigate = useNavigate();
  
  const [item, setItem] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [inLibrary, setInLibrary] = useState(false);
  const [streams, setStreams] = useState<StremioStream[]>([]);
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [activeEpisode, setActiveEpisode] = useState<number | null>(null);
  const [isDownloadingMpv, setIsDownloadingMpv] = useState(false);


  useEffect(() => {
    if (!id) return;
    setLoading(true);
    invoke<MediaItem | null>("get_media_item_by_id", { id })
      .then((data) => {
        if (data) {
          setItem(data);
          checkLibraryStatus(data.id);
          // If it's a movie, auto-fetch streams
          if (data.type === "movie") {
            handleFetchStreams(1);
          }
        } else {
          setError("Media not found in library.");
        }
      })
      .catch((err) => setError(err.toString()))
      .finally(() => setLoading(false));
  }, [id]);

  const checkLibraryStatus = async (mediaId: string) => {
    try {
        const status = await invoke<boolean>("check_in_library", { mediaItemId: mediaId });
        setInLibrary(status);
    } catch(e) {
        console.error("Failed to check library status:", e);
    }
  };

  const toggleLibrary = async () => {
    if (!item) return;
    try {
        await invoke("toggle_in_library", { mediaItemId: item.id, inLibrary: !inLibrary });
        setInLibrary(!inLibrary);
    } catch(e) {
        console.error("Failed to toggle library:", e);
    }
  };

  const handleFetchStreams = (episodeId: number) => {
    setActiveEpisode(episodeId);
    setLoadingStreams(true);
    setStreams([]);
    invoke<StremioStream[]>("fetch_stremio_streams", { 
        mediaType: item?.type || mediaType || "movie", 
        mediaId: id,
        season: item?.type === "movie" ? null : 1,
        episode: item?.type === "movie" ? null : episodeId
    })
      .then((data) => {
        setStreams(data);
      })
      .catch((e) => {
        console.error("Failed to fetch streams:", e);
      })
      .finally(() => {
        setLoadingStreams(false);
      });
  };

  const [isResolvingStream, setIsResolvingStream] = useState(false);

  const handleStreamClick = async (stream: StremioStream) => {
      let finalUrl = stream.url;

      if (!finalUrl && stream.info_hash) {
          try {
              setIsResolvingStream(true);
              finalUrl = await invoke<string>("stream_torrent", {
                  infoHash: stream.info_hash,
              });
          } catch (e) {
              console.error("Failed to start torrent stream:", e);
              return;
          } finally {
              setIsResolvingStream(false);
          }
      }

      if (!finalUrl) {
          console.error("No valid stream URL found");
          return;
      }

      // For non-browser formats, launch MPV directly instead of navigating to the HTML5 player.
      if (isExternalFormat(finalUrl)) {
          try {
              await invoke("launch_external_player", {
                  url: finalUrl,
                  title: item?.title
                      ? `${item.title}${activeEpisode ? ` - Episode ${activeEpisode}` : ""}`
                      : undefined,
              });
          } catch (e: any) {
              if (e === "MPV_NOT_FOUND") {
                  try {
                      setIsDownloadingMpv(true);
                      await invoke("download_mpv");
                      // Retry
                      await invoke("launch_external_player", {
                          url: finalUrl,
                          title: item?.title
                              ? `${item.title}${activeEpisode ? ` - Episode ${activeEpisode}` : ""}`
                              : undefined,
                      });
                  } catch (downloadErr) {
                      console.error("Failed to download or launch MPV after download:", downloadErr);
                  } finally {
                      setIsDownloadingMpv(false);
                  }
              } else {
                  console.error("Failed to launch external player:", e);
                  // Fallback: still try the built-in player
                  navigate(`/play/${item?.type || mediaType}/${id}/${activeEpisode || 1}`, {
                      state: { streamUrl: finalUrl, streamTitle: stream.title || stream.name }
                  });
              }
          }
          return;
      }
      navigate(`/play/${item?.type || mediaType}/${id}/${activeEpisode || 1}`, {
          state: { streamUrl: finalUrl, streamTitle: stream.title || stream.name }
      });
  };

  const getImageUrl = (path?: string, type: "poster" | "backdrop" = "poster") => {
    if (!path) return "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Image_created_with_a_mobile_phone.png/1200px-Image_created_with_a_mobile_phone.png";
    if (path.startsWith("http")) return path;
    if (item?.source_provider === "tmdb") return `https://image.tmdb.org/t/p/${type === 'backdrop' ? 'original' : 'w500'}${path}`;
    return convertFileSrc(path);
  };

  const parseQualityPills = (title: string = "") => {
      const pills: string[] = [];
      const keywords = ["1080p", "720p", "4k", "hdr", "multi-subs", "dual-audio"];
      const lower = title.toLowerCase();
      keywords.forEach(k => {
          if (lower.includes(k)) {
              pills.push(k.toUpperCase());
          }
      });
      // Extract size like 2.1 GB
      const sizeMatch = title.match(/\b\d+(\.\d+)?\s*(GB|MB)\b/i);
      if (sizeMatch) {
          pills.push(sizeMatch[0].toUpperCase());
      }
      return pills;
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (error || !item) return <div className="p-8 text-center text-destructive">{error}</div>;

  const genres = item.genres ? item.genres.split(",") : [];
  const episodesCount = item.type === "movie" ? 1 : (() => {
    try {
      const meta = item.metadata ? JSON.parse(item.metadata) : null;
      return meta?.number_of_episodes || meta?.episodes || 12;
    } catch { return 12; }
  })();

  return (
    <div className="relative min-h-screen pb-16">
      {/* Downloading MPV Overlay */}
      {isDownloadingMpv && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
            <Loader2 className="w-16 h-16 animate-spin text-primary mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Setting up high-performance player...</h2>
            <p className="text-white/70">First-time setup, downloading MPV directly to app data...</p>
        </div>
      )}

      {/* Hero Banner */}
      <div className="absolute top-0 left-0 right-0 h-[50vh] w-full">
        <img 
          src={getImageUrl(item.backdrop_path || undefined, "backdrop")} 
          alt="Banner" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
      </div>

      {/* Content Split */}
      <div className="relative z-10 pt-[30vh] px-8 max-w-7xl mx-auto flex flex-col md:flex-row gap-10">
        {/* Poster */}
        <div className="w-72 shrink-0 rounded-lg overflow-hidden shadow-2xl border border-border/50 bg-card -mt-24">
          <img 
            src={getImageUrl(item.poster_path || undefined, "poster")} 
            alt="Poster" 
            className="w-full aspect-[2/3] object-cover"
          />
        </div>

        {/* Metadata */}
        <div className="flex-1 space-y-6">
          <h1 className="text-5xl md:text-6xl font-bold text-foreground drop-shadow-sm tracking-tight line-clamp-2">{item.title}</h1>
          
          <div className="flex gap-2 flex-wrap">
            {genres.map(g => (
               <span key={g} className="bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-sm font-medium">{g.trim()}</span>
            ))}
            <span className="bg-primary/20 text-primary rounded-full px-3 py-1 text-sm font-bold uppercase">{item.type}</span>
          </div>

          <p className="text-lg text-foreground/80 leading-relaxed max-w-3xl line-clamp-4">
            {item.overview || "No synopsis available."}
          </p>

          {/* Action Row */}
          <div className="flex gap-4 mt-6">
            <button 
              onClick={() => handleFetchStreams(1)}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-md font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              <Play className="w-5 h-5 fill-current" />
              {item.type === "manga" ? "Read" : "Play"}
            </button>
            <button 
              onClick={toggleLibrary}
              className={`flex items-center gap-2 px-8 py-3 rounded-md font-bold transition-colors shadow-lg backdrop-blur-md ${inLibrary ? 'bg-primary/20 text-primary hover:bg-primary/30 border border-primary/50' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
            >
              {inLibrary ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              {inLibrary ? "In Library" : "Add to Library"}
            </button>
          </div>
        </div>
      </div>

      {/* Two-Column Lower Layout */}
      <div className="relative z-10 px-8 mt-20 max-w-7xl mx-auto flex flex-col lg:flex-row gap-8 items-start h-[60vh]">
        {/* Left Column: Episodes List */}
        <div className="w-full lg:w-[65%] space-y-2 overflow-y-auto pr-2 h-full">
          <h2 className="text-2xl font-bold mb-6 text-foreground sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-2">
            {item.type === "movie" ? "Movie" : "Episodes"}
          </h2>
          {Array.from({length: episodesCount}).map((_, i) => (
            <div 
              key={i} 
              onClick={() => handleFetchStreams(i + 1)} 
              className={`flex items-center gap-4 p-4 rounded-xl border transition-colors cursor-pointer group ${activeEpisode === i + 1 ? 'bg-primary/10 border-primary/50' : 'hover:bg-muted/50 border-transparent'}`}
            >
              <div className="text-muted-foreground w-8 text-center font-medium text-lg">{i + 1}</div>
              <div className="w-40 h-24 bg-muted rounded-md overflow-hidden relative shrink-0 shadow-sm">
                 <img 
                   src={getImageUrl(item.backdrop_path || undefined, "backdrop")} 
                   alt={`Thumbnail ${i + 1}`}
                   className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                 />
                 <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                    <Play className="w-10 h-10 text-white drop-shadow-md fill-white" />
                 </div>
              </div>
              <div className="flex-1">
                <h3 className={`font-semibold text-lg transition-colors ${activeEpisode === i + 1 ? 'text-primary' : 'text-foreground group-hover:text-primary'}`}>
                   {item.type === "movie" ? item.title : `Episode ${i + 1}`}
                </h3>
              </div>
            </div>
          ))}
        </div>

        {/* Right Column: Stream Selection Panel */}
        <div className="w-full lg:w-[35%] h-full bg-card/40 border border-border backdrop-blur-md rounded-xl p-4 overflow-y-auto shadow-xl flex flex-col">
            <h3 className="text-xl font-bold text-foreground mb-4 sticky top-0 bg-card/80 backdrop-blur-md p-2 -mt-2 -mx-2 rounded-t-xl z-10 flex justify-between items-center">
                Stream Providers
                {isResolvingStream && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
            </h3>
            
            {loadingStreams ? (
                <div className="flex-1 flex flex-col gap-3 mt-2">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="w-full h-24 bg-muted/50 animate-pulse rounded-lg border border-border/50"></div>
                    ))}
                </div>
            ) : streams.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
                    {activeEpisode ? "No streams found for this selection." : "Select an episode to view streams."}
                </div>
            ) : (
                <div className="flex-1 flex flex-col gap-3">
                    {streams.map((stream, idx) => {
                        const pills = parseQualityPills(stream.title);
                        // Try to extract main title from raw text, stripping common pills
                        let cleanTitle = stream.title || "";
                        
                        return (
                            <button
                                key={idx}
                                onClick={() => handleStreamClick(stream)}
                                className="w-full text-left bg-background/50 hover:bg-muted p-4 rounded-lg transition-colors border border-border/50 hover:border-primary/50 group"
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                        {stream.name || "Unknown Provider"}
                                    </span>
                                    {isExternalFormat(stream.url) && (
                                      <span className="flex items-center gap-1 bg-amber-500/20 text-amber-400 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                        <MonitorPlay className="w-3 h-3" />
                                        MPV
                                      </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                    {pills.map((p, i) => (
                                        <span key={i} className="bg-secondary text-secondary-foreground text-[10px] font-semibold rounded px-1.5 py-0.5 whitespace-nowrap">
                                            {p}
                                        </span>
                                    ))}
                                </div>
                                <div className="text-xs text-foreground/70 break-words group-hover:text-foreground transition-colors line-clamp-3 whitespace-pre-line">
                                    {cleanTitle}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
