import { Play, Loader2, Video, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import type { MediaItem } from "../types";

export default function Details() {
  const { id } = useParams();
  const [item, setItem] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Streaming state
  const [fetchingStreams, setFetchingStreams] = useState(false);
  const [availableStreams, setAvailableStreams] = useState<any[]>([]);
  const [showStreamsModal, setShowStreamsModal] = useState(false);
  const [activeEpisode, setActiveEpisode] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    invoke<MediaItem | null>("get_media_item_by_id", { id })
      .then((data) => {
        if (data) {
          setItem(data);
        } else {
          setError("Media not found in library.");
        }
      })
      .catch((err) => setError(err.toString()))
      .finally(() => setLoading(false));
  }, [id]);

  const getImageUrl = (path?: string, type: "poster" | "backdrop" = "poster") => {
    if (!path) return "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Image_created_with_a_mobile_phone.png/1200px-Image_created_with_a_mobile_phone.png";
    if (path.startsWith("http")) return path;
    if (item?.source_provider === "tmdb") return `https://image.tmdb.org/t/p/${type === 'backdrop' ? 'original' : 'w500'}${path}`;
    return convertFileSrc(path);
  };

  const handleFetchStreams = async (episodeNumber: number) => {
    if (!item) return;
    setFetchingStreams(true);
    setShowStreamsModal(true);
    setActiveEpisode(episodeNumber);
    setAvailableStreams([]);

    try {
      // 1. Get enabled extensions
      const exts: any[] = await invoke("get_extensions");
      const enabledExts = exts.filter(e => e.enabled);
      
      let allStreams: any[] = [];
      
      // 2. Determine external ID for Stremio protocol
      let extIds: Record<string, any> = {};
      try { extIds = JSON.parse(item.external_ids || "{}"); } catch(e) {}
      
      // Construct a generic Stremio ID. E.g. tmdb:12345:1:epNum
      // For movies, just tmdb:12345
      let mediaId = item.id; // fallback for local-source
      if (extIds.tmdb) {
        mediaId = item.type === "movie" ? `tmdb:${extIds.tmdb}` : `tmdb:${extIds.tmdb}:1:${episodeNumber}`;
      } else if (extIds.anilist) {
        mediaId = item.type === "movie" ? `anilist:${extIds.anilist}` : `anilist:${extIds.anilist}:${episodeNumber}`;
      }

      // 3. Query all extensions concurrently
      await Promise.allSettled(enabledExts.map(async (ext) => {
        try {
          const res = await invoke<string>("run_extension", {
            extensionId: ext.id,
            type: item.type,
            mediaId
          });
          const parsed = JSON.parse(res);
          if (parsed && parsed.streams && parsed.streams.length > 0) {
            allStreams.push(...parsed.streams.map((s: any) => ({ ...s, addonName: ext.name })));
            setAvailableStreams([...allStreams]); // update UI incrementally
          }
        } catch (e) {
          console.error(`Extension ${ext.name} failed to fetch streams:`, e);
        }
      }));

    } catch (err) {
      console.error("Failed to fetch streams:", err);
    } finally {
      setFetchingStreams(false);
    }
  };

  const handlePlayStream = (streamUrl: string) => {
    setShowStreamsModal(false);
    window.dispatchEvent(new CustomEvent('play-video', { detail: streamUrl }));
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (error || !item) return <div className="p-8 text-center text-destructive">{error}</div>;

  const genres = item.genres ? item.genres.split(",") : [];
  const episodesCount = item.type === "movie" ? 1 : 12; // Mock season length for TV

  return (
    <div className="relative min-h-screen pb-16">
      {/* Hero Banner */}
      <div className="absolute top-0 left-0 right-0 h-[60vh] w-full">
        <img 
          src={getImageUrl(item.backdrop_path || undefined, "backdrop")} 
          alt="Banner" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
      </div>

      {/* Content Split */}
      <div className="relative z-10 pt-[40vh] px-8 max-w-7xl mx-auto flex flex-col md:flex-row gap-10">
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
        </div>
      </div>

      {/* Episodes List */}
      <div className="relative z-10 px-8 mt-20 max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 text-foreground">{item.type === "movie" ? "Movie" : "Episodes"}</h2>
        <div className="space-y-2">
          {Array.from({length: episodesCount}).map((_, i) => (
            <div key={i} onClick={() => handleFetchStreams(i + 1)} className="flex items-center gap-4 p-4 rounded-xl hover:bg-muted/50 border border-transparent transition-colors cursor-pointer group">
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
                <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">
                   {item.type === "movie" ? item.title : `Episode ${i + 1}`}
                </h3>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Streams Modal */}
      {showStreamsModal && (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
             <div className="flex justify-between items-center p-6 border-b border-border bg-muted/50">
               <div>
                 <h2 className="text-xl font-bold">Select Source</h2>
                 <p className="text-sm text-muted-foreground">{item.title} - Episode {activeEpisode}</p>
               </div>
               <button onClick={() => setShowStreamsModal(false)} className="p-2 hover:bg-background rounded-full transition-colors">
                 <X className="w-6 h-6" />
               </button>
             </div>
             <div className="p-6 overflow-y-auto flex-1 space-y-3 bg-background">
                {fetchingStreams && availableStreams.length === 0 && (
                   <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-4">
                     <Loader2 className="w-8 h-8 animate-spin text-primary" />
                     <p>Scraping providers...</p>
                   </div>
                )}
                
                {availableStreams.map((s, idx) => (
                   <div 
                     key={idx} 
                     onClick={() => handlePlayStream(s.url)}
                     className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group"
                   >
                     <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                         <Video className="w-5 h-5 text-secondary-foreground group-hover:text-primary" />
                       </div>
                       <div>
                         <h4 className="font-semibold text-foreground">{s.name || s.addonName}</h4>
                         <p className="text-sm text-muted-foreground">{s.title || "Standard Quality"}</p>
                       </div>
                     </div>
                     <Play className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                   </div>
                ))}

                {!fetchingStreams && availableStreams.length === 0 && (
                   <div className="text-center py-12 text-muted-foreground">
                      No streams found for this episode. Try installing more extensions.
                   </div>
                )}
             </div>
           </div>
        </div>
      )}
    </div>
  );
}
