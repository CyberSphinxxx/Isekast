import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { ShieldAlert } from "lucide-react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ThemeProvider } from "./components/ThemeProvider";
import Layout from "./components/Layout";
import Library from "./pages/Library";
import Discover from "./pages/Discover";
import Details from "./pages/Details";
import Settings from "./pages/Settings";
import Extensions from "./pages/Extensions";
import Downloads from "./pages/Downloads";
import { CommandPalette } from "./components/CommandPalette";
import VideoPlayer from "./components/VideoPlayer";
import MangaReader from "./components/MangaReader";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        path: "/",
        element: <Library />,
      },
      {
        path: "/discover",
        element: <Discover />,
      },
      {
        path: "/details/:id",
        element: <Details />,
      },
      {
        path: "/extensions",
        element: <Extensions />,
      },
      {
        path: "/downloads",
        element: <Downloads />,
      },
      {
        path: "/settings",
        element: <Settings />,
      },
    ],
  },
]);

function App() {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [activeMangaPages, setActiveMangaPages] = useState<string[] | null>(null);
  const [showCloudflareToast, setShowCloudflareToast] = useState(false);

  useEffect(() => {
    const unlistenStart = listen("cloudflare-challenge-started", () => {
      setShowCloudflareToast(true);
    });
    const unlistenResolved = listen("cloudflare-challenge-resolved", () => {
      setShowCloudflareToast(false);
    });

    return () => {
      unlistenStart.then(f => f());
      unlistenResolved.then(f => f());
    };
  }, []);

  useEffect(() => {
    const handleOpenSearch = () => setCommandPaletteOpen(true);
    const handlePlayVideo = (e: any) => setActiveVideoUrl(e.detail);
    
    window.addEventListener('open-search-modal', handleOpenSearch);
    window.addEventListener('play-video', handlePlayVideo);

    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandPaletteOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    
    return () => {
      window.removeEventListener('open-search-modal', handleOpenSearch);
      window.removeEventListener('play-video', handlePlayVideo);
      document.removeEventListener("keydown", down);
    };
  }, []);

  useEffect(() => {
    import("@tauri-apps/api/core").then(({ invoke }) => {
      invoke<boolean>("get_anilist_token_status")
        .then(status => {
            if (status) {
                console.log("Anilist token found, starting background sync...");
                invoke("sync_anilist_to_local").catch(console.error);
            }
        })
        .catch(console.error);
    });
  }, []);

  return (
    <ThemeProvider defaultTheme="default" storageKey="isekast-theme">
      <RouterProvider router={router} />
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
      
      {activeVideoUrl && (
        <VideoPlayer src={activeVideoUrl} onClose={() => setActiveVideoUrl(null)} />
      )}
      
      {activeMangaPages && (
        <MangaReader pages={activeMangaPages} onClose={() => setActiveMangaPages(null)} />
      )}

      {showCloudflareToast && (
        <div className="fixed bottom-4 right-4 bg-card border border-border shadow-lg p-4 rounded-lg flex items-center gap-3 z-50 animate-in slide-in-from-bottom-5">
          <ShieldAlert className="w-5 h-5 text-primary animate-pulse" />
          <span className="text-sm font-medium">Solving provider security challenge... (This may take a few seconds)</span>
        </div>
      )}
    </ThemeProvider>
  );
}

export default App;
