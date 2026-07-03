import { Loader2, BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import type { MediaItem } from "../types";

interface Chapter {
  id: string;
  chapter: string | null;
  title: string | null;
  scanlation_group: string | null;
  publish_at: string | null;
  pages: number | null;
}

export default function MangaDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    invoke<MediaItem | null>("get_media_item_by_id", { id })
      .then((data) => {
        if (data) {
          setItem(data);
          // Extract mangadex ID from external_ids
          let mangadexId = id;
          if (data.external_ids) {
            try {
              const ext = JSON.parse(data.external_ids);
              if (ext.mangadex) mangadexId = ext.mangadex;
            } catch {}
          }
          fetchChapters(mangadexId);
        } else {
          setError("Manga not found in library.");
        }
      })
      .catch((err) => setError(err.toString()))
      .finally(() => setLoading(false));
  }, [id]);

  const fetchChapters = async (mangadexId: string) => {
    setChaptersLoading(true);
    try {
      const data = await invoke<Chapter[]>("fetch_manga_chapters", { mangaId: mangadexId });
      setChapters(data);
    } catch (e) {
      console.error("Failed to fetch chapters:", e);
    } finally {
      setChaptersLoading(false);
    }
  };

  const getImageUrl = (path?: string) => {
    if (!path) return "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Image_created_with_a_mobile_phone.png/1200px-Image_created_with_a_mobile_phone.png";
    if (path.startsWith("http")) return path;
    if (item?.source_provider === "tmdb") return `https://image.tmdb.org/t/p/w500${path}`;
    return convertFileSrc(path);
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (error || !item) return <div className="p-8 text-center text-destructive">{error}</div>;

  const firstChapter = chapters.length > 0 ? chapters[chapters.length - 1] : null;

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Top Banner (blurred background version of poster) */}
      <div className="absolute top-0 left-0 right-0 h-[40vh] w-full overflow-hidden opacity-30 pointer-events-none">
        <img 
          src={getImageUrl(item.poster_path || undefined)} 
          alt="Banner" 
          className="w-full h-full object-cover blur-3xl scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="relative z-10 pt-24 px-8 max-w-7xl mx-auto flex flex-col md:flex-row gap-12">
        {/* Cover Art */}
        <div className="w-72 md:w-80 shrink-0 rounded-xl overflow-hidden shadow-2xl border border-border/50 bg-card">
          <img 
            src={getImageUrl(item.poster_path || undefined)} 
            alt="Cover" 
            className="w-full aspect-[2/3] object-cover"
          />
        </div>

        {/* Info */}
        <div className="flex-1 space-y-6 pt-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground drop-shadow-sm tracking-tight">{item.title}</h1>
            <p className="text-xl text-muted-foreground mt-2">{item.status || "Ongoing"}</p>
          </div>

          <div className="flex items-center gap-3">
             <span className="bg-primary/20 text-primary rounded-full px-4 py-1.5 text-sm font-bold uppercase tracking-wider">{item.status || "Ongoing"}</span>
             {chapters.length > 0 && (
               <span className="text-muted-foreground text-sm">{chapters.length} chapters</span>
             )}
          </div>

          <p className="text-lg text-foreground/80 leading-relaxed max-w-3xl">
            {item.overview || "No synopsis available."}
          </p>

          <div className="pt-4 flex gap-4">
            <button 
              onClick={() => firstChapter && navigate(`/read/${item.id}/${firstChapter.id}`)}
              disabled={!firstChapter}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-md font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <BookOpen className="w-5 h-5" />
              {firstChapter ? `Read Ch. ${firstChapter.chapter || "1"}` : "No chapters"}
            </button>
          </div>
        </div>
      </div>

      {/* Chapters List */}
      <div className="relative z-10 px-8 mt-16 max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 text-foreground border-b border-border pb-4">Chapters</h2>
        
        {chaptersLoading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="w-full h-16 bg-muted/50 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : chapters.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">No English chapters found.</div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            {chapters.map((ch) => (
              <div 
                key={ch.id} 
                onClick={() => navigate(`/read/${item.id}/${ch.id}`)} 
                className="flex items-center gap-6 p-5 hover:bg-muted/50 transition-colors cursor-pointer border-b border-border last:border-b-0 text-foreground"
              >
                <div className="flex items-center gap-4 flex-1">
                   <div className="w-5 h-5 shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-lg">
                      Ch. {ch.chapter || "?"} {ch.title ? `— ${ch.title}` : ''}
                    </span>
                    <span className="text-sm opacity-70">
                      {ch.scanlation_group || "Unknown Group"}
                    </span>
                  </div>
                </div>
                <div className="text-sm opacity-70">
                   {ch.publish_at ? new Date(ch.publish_at).toLocaleDateString() : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
