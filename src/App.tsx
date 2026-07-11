import { useState, useEffect, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { listen } from "@tauri-apps/api/event";
import { ShieldAlert, AlertTriangle, Copy, RefreshCw } from "lucide-react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ThemeProvider } from "./components/ThemeProvider";
import Layout from "./components/Layout";
import Library from "./pages/Library";
import Discover from "./pages/Discover";
import MediaDetails from "./pages/MediaDetails";
import MangaDetails from "./pages/MangaDetails";
import Settings from "./pages/Settings";
import Extensions from "./pages/Extensions";
import Downloads from "./pages/Downloads";
import { CommandPalette } from "./components/CommandPalette";
import MangaReader from "./pages/MangaReader";
import Player from "./pages/Player";

// ─── Global Error Boundary ────────────────────────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("[ErrorBoundary] Uncaught error:", error, errorInfo);
  }

  private handleCopyLogs = () => {
    const { error, errorInfo } = this.state;
    const text = [
      `Error: ${error?.message ?? "Unknown error"}`,
      "",
      "Stack trace:",
      error?.stack ?? "N/A",
      "",
      "Component stack:",
      errorInfo?.componentStack ?? "N/A",
    ].join("\n");
    navigator.clipboard.writeText(text).catch(console.error);
  };

  private handleRelaunch = () => {
    // Attempt a soft reset by reloading the webview window.
    import("@tauri-apps/api/core")
      .then(({ invoke }) => invoke("relaunch").catch(() => window.location.reload()))
      .catch(() => window.location.reload());
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error } = this.state;

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "hsl(var(--background, 222 47% 7%))",
          color: "hsl(var(--foreground, 210 40% 98%))",
          fontFamily: "system-ui, sans-serif",
          padding: "2rem",
        }}
      >
        <div
          style={{
            maxWidth: "540px",
            width: "100%",
            background: "hsl(var(--card, 222 47% 11%))",
            border: "1px solid hsl(var(--border, 217 33% 17%))",
            borderRadius: "1rem",
            padding: "2.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
            boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
          }}
        >
          {/* Icon + heading */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
            <div
              style={{
                width: "3rem",
                height: "3rem",
                borderRadius: "50%",
                background: "hsl(var(--destructive, 0 63% 31%) / 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <AlertTriangle
                style={{
                  width: "1.5rem",
                  height: "1.5rem",
                  color: "hsl(var(--destructive, 0 63% 31%))",
                }}
              />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>
                Something went wrong
              </h1>
              <p style={{ margin: 0, fontSize: "0.875rem", opacity: 0.6 }}>
                An unexpected error crashed this view.
              </p>
            </div>
          </div>

          {/* Error message */}
          {error?.message && (
            <div
              style={{
                background: "hsl(var(--destructive, 0 63% 31%) / 0.08)",
                border: "1px solid hsl(var(--destructive, 0 63% 31%) / 0.3)",
                borderRadius: "0.5rem",
                padding: "0.875rem 1rem",
                fontSize: "0.8rem",
                fontFamily: "monospace",
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: "hsl(var(--destructive, 0 63% 65%))",
              }}
            >
              {error.message}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              onClick={this.handleCopyLogs}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.625rem 1.125rem",
                borderRadius: "0.5rem",
                border: "1px solid hsl(var(--border, 217 33% 17%))",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 500,
              }}
            >
              <Copy style={{ width: "1rem", height: "1rem" }} />
              Copy Error Logs
            </button>
            <button
              onClick={this.handleRelaunch}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.625rem 1.25rem",
                borderRadius: "0.5rem",
                border: "none",
                background: "hsl(var(--primary, 217 91% 60%))",
                color: "hsl(var(--primary-foreground, 210 40% 98%))",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 600,
              }}
            >
              <RefreshCw style={{ width: "1rem", height: "1rem" }} />
              Relaunch Core Window
            </button>
          </div>
        </div>
      </div>
    );
  }
}

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
        path: "/details/:mediaType/:id",
        element: <MediaDetails />,
      },
      {
        path: "/manga/:id",
        element: <MangaDetails />,
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
  {
    path: "/play/:mediaType/:id/:episodeId",
    element: <Player />,
  },
  {
    path: "/read/:mangaId/:chapterId",
    element: <MangaReader />,
  },
]);

function App() {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
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
      <ErrorBoundary>
        <RouterProvider router={router} />
        <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />

        {showCloudflareToast && (
          <div className="fixed bottom-4 right-4 bg-card border border-border shadow-lg p-4 rounded-lg flex items-center gap-3 z-50 animate-in slide-in-from-bottom-5">
            <ShieldAlert className="w-5 h-5 text-primary animate-pulse" />
            <span className="text-sm font-medium">Solving provider security challenge... (This may take a few seconds)</span>
          </div>
        )}
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
