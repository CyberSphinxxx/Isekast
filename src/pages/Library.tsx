import { PlayCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import type { MediaItem } from "../types";

export default function Library() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<MediaItem[]>("get_media_items")
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load library:", err);
        setLoading(false);
      });
  }, []);

  const getImageUrl = (item: MediaItem) => {
    const path = item.poster_path;
    if (!path) return "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Image_created_with_a_mobile_phone.png/280px-Image_created_with_a_mobile_phone.png";
    if (path.startsWith("http")) return path;
    if (item.source_provider === "tmdb") return `https://image.tmdb.org/t/p/w500${path}`;
    return convertFileSrc(path);
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  // Placeholder for items in progress
  const continueItems = items.slice(0, 5); 
  const gridItems = items;

  return (
    <div className="p-8 space-y-10">
      <section>
        <h2 className="text-2xl font-bold mb-4">Continue</h2>
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
          {continueItems.map(item => (
            <div key={item.id} className="min-w-[280px] group cursor-pointer relative rounded-md overflow-hidden bg-muted snap-start">
              <img src={getImageUrl(item)} alt={item.title} className="w-full h-40 object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                 <PlayCircle className="w-12 h-12 text-primary" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                <span className="text-white font-medium drop-shadow-md">{item.title}</span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted-foreground/50">
                <div className="h-full bg-primary" style={{ width: `30%` }} />
              </div>
            </div>
          ))}
          {continueItems.length === 0 && (
            <div className="text-muted-foreground">Nothing in progress.</div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Your Collection</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {gridItems.map(item => (
            <div key={item.id} className="relative group cursor-pointer rounded-md overflow-hidden bg-muted aspect-[2/3] transition-transform duration-300 hover:scale-105 hover:z-10 shadow-md">
              <img src={getImageUrl(item)} alt={item.title} className="w-full h-full object-cover transition-opacity group-hover:opacity-60" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                <PlayCircle className="w-14 h-14 text-primary drop-shadow-lg" />
              </div>
            </div>
          ))}
          {gridItems.length === 0 && (
            <div className="col-span-full text-muted-foreground">Your library is empty. Discover new content to add here!</div>
          )}
        </div>
      </section>
    </div>
  );
}
