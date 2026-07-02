import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { check } from "@tauri-apps/plugin-updater";
import VideoPlayer from "./components/VideoPlayer";
import MangaReader from "./components/MangaReader";

interface MediaItem {
  id: string;
  type: string;
  title: string;
  status: string | null;
  source_provider: string | null;
}

function App() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [tokenInput, setTokenInput] = useState("");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchProvider, setSearchProvider] = useState<"tmdb" | "mangadex">("tmdb");
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [activeMangaPages, setActiveMangaPages] = useState<string[] | null>(null);

  const checkForUpdates = async () => {
    try {
      const update = await check();
      if (update) {
        console.log(`found update ${update.version} from ${update.date} with notes ${update.body}`);
        // For foundational MVP, we just notify via alert instead of downloading
        alert(`New update available: ${update.version}\n\n${update.body}`);
      }
    } catch (e) {
      console.error("Update check failed:", e);
    }
  };

  useEffect(() => {
    fetchLibrary();
    checkForUpdates();
    invoke<boolean>("get_tmdb_token_status")
      .then(setHasToken)
      .catch(console.error);
  }, []);

  const fetchLibrary = () => {
    invoke<MediaItem[]>("get_media_items")
      .then(setItems)
      .catch((err) => setError(err as string));
  };

  const saveToken = async () => {
    try {
      await invoke("save_tmdb_token", { token: tokenInput });
      setHasToken(true);
      setTokenInput("");
    } catch (err) {
      setError(err as string);
    }
  };

  const removeToken = async () => {
    try {
      await invoke("delete_tmdb_token");
      setHasToken(false);
    } catch (err) {
      setError(err as string);
    }
  };

  const search = async () => {
    if (!searchQuery) return;
    setIsSearching(true);
    setError(null);
    try {
      let results;
      if (searchProvider === "tmdb") {
        results = await invoke<MediaItem[]>("search_tmdb", { query: searchQuery });
      } else {
        results = await invoke<MediaItem[]>("search_mangadex", { query: searchQuery });
      }
      setSearchResults(results);
      fetchLibrary(); // refresh library since search automatically caches to DB
    } catch (err) {
      setError(err as string);
    } finally {
      setIsSearching(false);
    }
  };

  const watchMedia = async (id: string) => {
    try {
      // Execute the Javascript Sandbox via Rust
      const script = `
        function getStreams(id) {
            return [
                { url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", quality: "1080p", id: id }
            ];
        }
      `;
      const res: string = await invoke("run_extension", { script, mediaId: id });
      
      const streams = JSON.parse(res);
      if (streams && streams.length > 0) {
        setActiveVideoUrl(streams[0].url);
      }
    } catch (e) {
      setError(e as string);
    }
  };

  const readMedia = async (id: string) => {
    try {
      const script = `
        function getStreams(id) {
            return [
                { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Image_created_with_a_mobile_phone.png/1200px-Image_created_with_a_mobile_phone.png", type: "manga_page" },
                { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png", type: "manga_page" }
            ];
        }
      `;
      const res: string = await invoke("run_extension", { script, mediaId: id });
      
      const streams = JSON.parse(res);
      if (streams && streams.length > 0) {
        const pages = streams.map((s: any) => s.url);
        setActiveMangaPages(pages);
      }
    } catch (e) {
      setError(e as string);
    }
  };

  const markCompleted = async (id: string) => {
    try {
      await invoke("update_media_progress", { 
        id, 
        progressJson: JSON.stringify({ status: 'completed' }) 
      });
      alert(`Marked ${id} as completed!`);
    } catch (e) {
      setError(e as string);
    }
  };

  return (
    <div className="min-h-screen bg-background-primary text-accent p-8 space-y-8">
      {activeVideoUrl && (
        <VideoPlayer src={activeVideoUrl} onClose={() => setActiveVideoUrl(null)} />
      )}
      {activeMangaPages && (
        <MangaReader pages={activeMangaPages} onClose={() => setActiveMangaPages(null)} />
      )}

      <h1 className="text-3xl font-bold">Isekast</h1>
      
      {error && <div className="bg-red-900/50 p-4 border border-red-500 rounded text-red-200">{error}</div>}
      
      <section className="bg-background-secondary p-6 rounded-lg border border-accent/20">
        <h2 className="text-2xl mb-4">Settings</h2>
        <div className="mb-2">
          <h3 className="text-lg font-semibold mb-2">TMDB Configuration (For Anime/Movies/TV)</h3>
          {hasToken ? (
            <div>
              <p className="text-green-500 mb-2">Token is configured securely.</p>
              <button onClick={removeToken} className="bg-red-600 px-4 py-2 rounded text-white hover:bg-red-700">Delete Token</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input 
                type="password" 
                value={tokenInput} 
                onChange={e => setTokenInput(e.target.value)} 
                placeholder="Enter TMDB Read Access Token"
                className="bg-background-primary border border-accent/40 rounded px-4 py-2 flex-grow text-white"
              />
              <button onClick={saveToken} className="bg-blue-600 px-4 py-2 rounded text-white hover:bg-blue-700">Save</button>
            </div>
          )}
        </div>
      </section>

      <section className="bg-background-secondary p-6 rounded-lg border border-accent/20">
        <h2 className="text-2xl mb-4">Discover</h2>
        <div className="flex gap-2 mb-4">
          <select 
            value={searchProvider} 
            onChange={(e) => setSearchProvider(e.target.value as "tmdb" | "mangadex")}
            className="bg-background-primary border border-accent/40 rounded px-4 py-2 text-white"
          >
            <option value="tmdb">TMDB</option>
            <option value="mangadex">MangaDex</option>
          </select>
          <input 
            type="text" 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            placeholder={`Search via ${searchProvider === 'tmdb' ? 'TMDB' : 'MangaDex'}...`}
            className="bg-background-primary border border-accent/40 rounded px-4 py-2 flex-grow text-white"
          />
          <button 
            onClick={search} 
            disabled={isSearching || (searchProvider === 'tmdb' && !hasToken)} 
            className="bg-blue-600 px-4 py-2 rounded text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSearching ? "Searching..." : "Search"}
          </button>
        </div>
        
        {searchProvider === 'tmdb' && !hasToken && (
          <p className="text-yellow-500 text-sm mb-4">Please configure a TMDB token above to search for movies and TV shows.</p>
        )}
        
        {searchResults.length > 0 && (
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {searchResults.map((res) => (
              <li key={res.id} className="p-3 border border-accent/20 rounded hover:bg-accent/10 transition-colors">
                <div className="font-semibold">{res.title}</div>
                <div className="text-sm text-accent/60 flex gap-2">
                  <span>{res.type.toUpperCase()}</span>
                  <span>•</span>
                  <span>{res.source_provider}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-2xl mb-4">Local Library Cache</h2>
        {items.length === 0 ? (
          <p className="text-accent/60">Your library is empty. Search above to add items to the cache.</p>
        ) : (
          <ul className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {items.map((item) => (
              <li key={item.id} className="p-4 border border-accent/40 rounded shadow bg-background-secondary flex flex-col gap-2 relative group">
                <h3 className="text-lg font-semibold truncate" title={item.title}>{item.title}</h3>
                <span className="text-xs bg-accent/20 px-2 py-1 rounded w-fit">{item.type}</span>
                <span className="text-xs text-accent/60 truncate" title={item.id}>{item.id}</span>
                
                {/* Watch button overlay */}
                <div className="absolute inset-0 bg-background-secondary/80 flex flex-col items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.type === 'manga' ? (
                    <button 
                      onClick={() => readMedia(item.id)}
                      className="bg-purple-600 text-white px-6 py-2 rounded shadow-lg font-bold hover:bg-purple-500 transition-transform transform hover:scale-105"
                    >
                      Read
                    </button>
                  ) : (
                    <button 
                      onClick={() => watchMedia(item.id)}
                      className="bg-blue-600 text-white px-6 py-2 rounded shadow-lg font-bold hover:bg-blue-500 transition-transform transform hover:scale-105"
                    >
                      Watch
                    </button>
                  )}
                  <button 
                    onClick={() => markCompleted(item.id)}
                    className="bg-green-600 text-white px-4 py-2 rounded shadow-lg font-bold hover:bg-green-500 transition-transform transform hover:scale-105"
                  >
                    Done
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default App;
