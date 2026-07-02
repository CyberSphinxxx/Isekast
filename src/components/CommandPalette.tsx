import * as Dialog from "@radix-ui/react-dialog";
import { Search, X, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { MediaItem } from "../types";

export function CommandPalette({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const [tmdbRes, mdRes] = await Promise.allSettled([
          invoke<MediaItem[]>("search_tmdb", { query: query.trim() }),
          invoke<MediaItem[]>("search_mangadex", { query: query.trim() })
        ]);

        const combined: MediaItem[] = [];
        if (tmdbRes.status === "fulfilled") combined.push(...tmdbRes.value);
        if (mdRes.status === "fulfilled") combined.push(...mdRes.value);

        setResults(combined);
      } catch (err) {
        console.error(err);
        setError("Failed to search.");
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  const getImageUrl = (item: MediaItem) => {
    if (item.source_provider === "tmdb" && item.poster_path) {
      return `https://image.tmdb.org/t/p/w500${item.poster_path}`;
    }
    // Fallback for missing poster
    return item.poster_path || "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Image_created_with_a_mobile_phone.png/280px-Image_created_with_a_mobile_phone.png";
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 backdrop-blur-md bg-background/80 transition-all duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[20%] z-50 w-full max-w-2xl translate-x-[-50%] gap-4 border border-border bg-card p-0 shadow-2xl sm:rounded-xl overflow-hidden duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=open]:slide-in-from-left-1/2">
          
          <div className="flex items-center border-b border-border px-4 py-3">
            <Search className="mr-3 w-5 h-5 text-muted-foreground" />
            <input 
              className="flex-1 bg-transparent text-foreground placeholder-muted-foreground outline-none border-none text-lg"
              placeholder="Search movies, anime, manga..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {loading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-3" />}
            <Dialog.Close className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <X className="w-5 h-5" />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            {query.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Start typing to search across TMDB and MangaDex...
              </div>
            ) : (
              <div className="p-4 flex flex-col gap-2">
                {error && <div className="text-destructive text-sm text-center py-2">{error}</div>}
                
                {results.length === 0 && !loading && !error && (
                  <div className="text-center text-muted-foreground py-4">No results found.</div>
                )}
                
                {results.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-2 hover:bg-secondary rounded-md cursor-pointer transition-colors">
                    <div className="w-10 h-14 bg-muted rounded overflow-hidden shrink-0">
                      <img src={getImageUrl(item)} alt={item.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{item.title}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {item.type} • {item.source_provider}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
