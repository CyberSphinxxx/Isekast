import { useState, useEffect } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ThemeProvider } from "./components/ThemeProvider";
import Layout from "./components/Layout";
import Library from "./pages/Library";
import Discover from "./pages/Discover";
import Details from "./pages/Details";
import Settings from "./pages/Settings";
import Extensions from "./pages/Extensions";
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

  useEffect(() => {
    const handleOpenSearch = () => setCommandPaletteOpen(true);
    window.addEventListener('open-search-modal', handleOpenSearch);

    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandPaletteOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    
    return () => {
      window.removeEventListener('open-search-modal', handleOpenSearch);
      document.removeEventListener("keydown", down);
    };
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
    </ThemeProvider>
  );
}

export default App;
