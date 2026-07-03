import { Search, Play, Plus, ChevronRight, ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import type { MediaItem } from "../types";

export default function Discover() {
  const navigate = useNavigate();
  const [trendingAnime, setTrendingAnime] = useState<MediaItem[]>([]);
  const [popularMovies, setPopularMovies] = useState<MediaItem[]>([]);
  const [topManga, setTopManga] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(null);
        const [anime, movies, manga] = await Promise.allSettled([
          invoke<MediaItem[]>("get_trending_anime"),
          invoke<MediaItem[]>("get_trending_movies"),
          invoke<MediaItem[]>("get_popular_manga")
        ]);

        let errorMessages = [];

        if (anime.status === "fulfilled" && Array.isArray(anime.value)) {
          setTrendingAnime(anime.value);
        } else {
          console.error("Anime fetch failed:", anime);
          errorMessages.push("Anime");
        }

        if (movies.status === "fulfilled" && Array.isArray(movies.value)) {
          setPopularMovies(movies.value);
        } else {
          console.error("Movies fetch failed:", movies);
          errorMessages.push("Movies");
        }

        if (manga.status === "fulfilled" && Array.isArray(manga.value)) {
          setTopManga(manga.value);
        } else {
          console.error("Manga fetch failed:", manga);
          errorMessages.push("Manga");
        }

        if (errorMessages.length > 0) {
          setError(`Failed to load: ${errorMessages.join(", ")}`);
        }
      } catch (err) {
        console.error("Error fetching discover data:", err);
        setError("Failed to load media. An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const openSearch = () => window.dispatchEvent(new Event('open-search-modal'));

  const getImageUrl = (item: MediaItem, type: "poster" | "backdrop" = "poster") => {
    const path = type === "poster" ? item.poster_path : item.backdrop_path;
    if (!path) return "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Image_created_with_a_mobile_phone.png/1200px-Image_created_with_a_mobile_phone.png";
    if (path.startsWith("http")) return path;
    if (item.source_provider === "tmdb") return `https://image.tmdb.org/t/p/${type === 'backdrop' ? 'original' : 'w500'}${path}`;
    return path;
  };

  const heroItem = trendingAnime[0] || popularMovies[0] || topManga[0];

  return (
    <div className="relative min-h-screen pb-16">
      {/* Search Trigger */}
      <div className="absolute top-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
        <button 
          onClick={openSearch}
          onFocus={openSearch}
          className="pointer-events-auto flex items-center gap-2 w-full max-w-2xl bg-black/40 backdrop-blur-xl border border-white/10 hover:border-primary/50 hover:bg-black/60 transition-all duration-300 rounded-full px-6 py-3 text-left text-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.5)]"
        >
          <Search className="w-5 h-5" />
          <span className="flex-1">Search everything...</span>
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-xs font-medium text-white/80">
            <span className="text-xs">Ctrl</span>K
          </kbd>
        </button>
      </div>

      {/* Hero Spotlight */}
      {loading ? (
        <div className="w-full h-[70vh] bg-muted animate-pulse"></div>
      ) : heroItem ? (
        <div className="relative w-full h-[70vh]">
          <img 
            src={getImageUrl(heroItem, "backdrop")} 
            alt={heroItem.title} 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-8 max-w-7xl mx-auto flex flex-col gap-4">
            <h1 className="text-5xl font-extrabold text-foreground drop-shadow-lg max-w-3xl line-clamp-2">{heroItem.title}</h1>
            <p className="text-lg text-foreground/80 max-w-2xl line-clamp-3 drop-shadow-md">{heroItem.overview}</p>
            <div className="flex gap-4 mt-4">
              <button 
                onClick={() => navigate(heroItem.type === 'manga' ? `/manga/${heroItem.id}` : `/details/${heroItem.type}/${heroItem.id}`)}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-md font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
              >
                <Play className="w-5 h-5 fill-current" />
                Play / Details
              </button>
              <button className="flex items-center gap-2 bg-secondary text-secondary-foreground px-8 py-3 rounded-md font-bold hover:bg-secondary/80 transition-colors shadow-lg backdrop-blur-md">
                <Plus className="w-5 h-5" />
                Add to Library
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Error Toast */}
      {error && !loading && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-destructive/90 text-destructive-foreground px-6 py-2 rounded-full shadow-lg backdrop-blur-md text-sm font-medium animate-in fade-in slide-in-from-top-4">
          {error}
        </div>
      )}

      {/* Content Rows */}
      <div className="px-8 max-w-7xl mx-auto mt-12 space-y-12 relative z-10">
        <MediaRow title="Trending Anime" items={trendingAnime} loading={loading} getImageUrl={getImageUrl} navigate={navigate} />
        <MediaRow title="Popular Movies & TV" items={popularMovies} loading={loading} getImageUrl={getImageUrl} navigate={navigate} />
        <MediaRow title="Top Manga Updates" items={topManga} loading={loading} getImageUrl={getImageUrl} navigate={navigate} />
      </div>
    </div>
  );
}

function MediaRow({ title, items, loading, getImageUrl, navigate }: { title: string, items: MediaItem[], loading: boolean, getImageUrl: (item: MediaItem, type?: "poster"|"backdrop") => string, navigate: (path: string) => void }) {
  if (!loading && items.length === 0) return null;

  return (
    <section>
      <h2 className="text-2xl font-bold mb-4 px-2">{title}</h2>
      <div className="relative group">
        <button className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-start pointer-events-none sm:pointer-events-auto">
          <ChevronLeft className="w-8 h-8 text-foreground drop-shadow-md hover:text-primary transition-colors cursor-pointer ml-2" />
        </button>

        <div className="flex gap-4 overflow-x-auto pb-4 snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] px-2">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="min-w-[160px] sm:min-w-[200px] aspect-[2/3] bg-muted animate-pulse rounded-md shrink-0"></div>
            ))
          ) : Array.isArray(items) ? (
            items.map((item) => (
              <div 
                key={item.id} 
                onClick={() => navigate(item.type === 'manga' ? `/manga/${item.id}` : `/details/${item.type}/${item.id}`)}
                className="min-w-[160px] sm:min-w-[200px] aspect-[2/3] shrink-0 group/card cursor-pointer relative rounded-md overflow-hidden bg-muted snap-start shadow-sm hover:shadow-lg transition-all hover:-translate-y-1 duration-300"
              >
                <img src={getImageUrl(item)} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/0 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300">
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <p className="text-white font-medium text-sm line-clamp-2 drop-shadow-md leading-tight">{item.title}</p>
                  </div>
                </div>
              </div>
            ))
          ) : null}
        </div>

        <button className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end pointer-events-none sm:pointer-events-auto">
          <ChevronRight className="w-8 h-8 text-foreground drop-shadow-md hover:text-primary transition-colors cursor-pointer mr-2" />
        </button>
      </div>
    </section>
  );
}
