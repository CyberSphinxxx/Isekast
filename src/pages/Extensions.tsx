import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, Download, Search, Trash2 } from "lucide-react";
import type { Extension } from "../types";

interface ExtensionManifest {
    id: string;
    name: string;
    version: string;
    resources: string[];
    types: string[];
    idPrefixes?: string[];
    script_url: string;
}

interface StremioAddon {
    id: string;
    transport_url: string;
    manifest_json: string; // Serialized string
    is_active: boolean;
}

const RECOMMENDED_STREMIO_ADDONS = [
  { name: "Cinemeta", url: "https://v3-cinemeta.strem.io/manifest.json", desc: "Official Stremio catalog for movies & series.", types: ["movie", "series"] },
  { name: "YouTube", url: "https://v3-channels.strem.io/manifest.json", desc: "Official YouTube channels addon.", types: ["channel"] },
  { name: "Watch Hub", url: "https://watchhub.strem.io/manifest.json", desc: "Find streams from Netflix, Hulu, Amazon, etc.", types: ["movie", "series"] },
  { name: "Public Domain Movies", url: "https://publicdomainmovies.strem.io/manifest.json", desc: "Official public domain movie catalog.", types: ["movie"] },
  { name: "Open Subtitles v3", url: "https://opensubtitles-v3.strem.io/manifest.json", desc: "Official subtitle source.", types: ["movie", "series"] },
  { name: "Local Files", url: "http://127.0.0.1:11470/local-addon/manifest.json", desc: "Addon for playing local files if running Stremio node.", types: ["movie", "series", "other"] },
];

export default function Extensions() {
  const [activeTab, setActiveTab] = useState<'installed' | 'discover'>('installed');
  const [installed, setInstalled] = useState<Extension[]>([]);
  const [discover, setDiscover] = useState<ExtensionManifest[]>([]);
  const [stremioAddons, setStremioAddons] = useState<StremioAddon[]>([]);
  const [stremioUrlInput, setStremioUrlInput] = useState("");
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [filterSource, setFilterSource] = useState("All");

  const fetchInstalled = async () => {
    try {
        const data = await invoke<Extension[]>("get_extensions");
        setInstalled(data);
    } catch(e) {
        console.error(e);
    }
  };

  const fetchDiscover = async () => {
    try {
        const data = await invoke<ExtensionManifest[]>("fetch_extension_registry");
        setDiscover(data);
    } catch(e) {
        console.error(e);
    }
  };

  const fetchStremioAddons = async () => {
    try {
        const data = await invoke<StremioAddon[]>("get_stremio_addons");
        setStremioAddons(data);
    } catch (e) {
        console.error("Failed to fetch stremio addons:", e);
    }
  };

  useEffect(() => {
    const init = async () => {
        setLoading(true);
        await Promise.all([fetchInstalled(), fetchDiscover(), fetchStremioAddons()]);
        setLoading(false);
    };
    init();
  }, []);

  const handleInstall = async (manifest: ExtensionManifest) => {
    try {
        await invoke('install_extension', { manifest });
        await fetchInstalled();
        setActiveTab('installed');
    } catch (e) {
        console.error("Install failed:", e);
    }
  };

  const handleStremioInstall = async (url: string) => {
    try {
        await invoke("install_stremio_addon", { manifestUrl: url });
        setStremioUrlInput("");
        await fetchStremioAddons();
        setActiveTab('installed');
    } catch (err) {
        console.error("Stremio Addon install failed:", err);
        alert("Failed to install addon. Ensure URL is valid and ends in /manifest.json");
    }
  };

  const handleUninstallJs = async (id: string) => {
    try {
        await invoke("uninstall_extension", { id });
        await fetchInstalled();
    } catch (err) {
        console.error("Uninstall JS failed:", err);
    }
  };

  const handleUninstallStremio = async (id: string) => {
    try {
        await invoke("uninstall_stremio_addon", { id });
        await fetchStremioAddons();
    } catch (err) {
        console.error("Uninstall Stremio failed:", err);
    }
  };

  const toggleStremio = async (id: string, current: boolean) => {
    try {
        await invoke("toggle_stremio_addon", { id, isActive: !current });
        await fetchStremioAddons();
    } catch (err) {
        console.error("Toggle failed:", err);
    }
  };

  const renderFilters = () => (
    <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-muted/50 rounded-lg border border-border">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input 
          type="text" 
          placeholder="Search addons..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-background border border-border rounded-md pl-9 pr-4 py-2 focus:outline-none focus:ring-1 focus:ring-primary text-sm"
        />
      </div>
      <div className="flex gap-4">
        <select 
          value={filterType} 
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary text-sm min-w-[120px]"
        >
          <option value="All">All Types</option>
          <option value="Movies">Movies</option>
          <option value="Series">Series</option>
          <option value="Channel">Channel</option>
          <option value="Other">Other</option>
        </select>
        <select 
          value={filterSource} 
          onChange={(e) => setFilterSource(e.target.value)}
          className="bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary text-sm min-w-[160px]"
        >
          <option value="All">All Sources</option>
          <option value="Official Addons">Official Addons</option>
          <option value="Community Addons">Community Addons</option>
        </select>
      </div>
    </div>
  );

  const filterMatches = (name: string, types: string[], isOfficial: boolean) => {
    if (searchQuery && !name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    
    if (filterType !== "All") {
      const typeMap: Record<string, string> = { "Movies": "movie", "Series": "series", "Channel": "channel", "Other": "other" };
      const target = typeMap[filterType];
      if (!types.includes(target) && !types.some(t => t.includes(target))) return false;
    }

    if (filterSource !== "All") {
      if (filterSource === "Official Addons" && !isOfficial) return false;
      if (filterSource === "Community Addons" && isOfficial) return false;
    }
    return true;
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const isOfficialAddon = (url: string | undefined) => url ? url.includes('strem.io') : false;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Extensions</h1>
        <p className="text-muted-foreground">Manage sources and community extensions.</p>
      </header>

      <div className="flex gap-4 mb-6 border-b border-border pb-2">
        <button 
            className={`pb-2 px-1 font-medium transition-colors ${activeTab === 'installed' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('installed')}
        >
            Installed
        </button>
        <button 
            className={`pb-2 px-1 font-medium transition-colors ${activeTab === 'discover' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('discover')}
        >
            Discover
        </button>
      </div>

      {renderFilters()}

      {activeTab === 'installed' && (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-semibold mb-4 border-b border-border pb-2">JS Scripts</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {installed.filter(ext => filterMatches(ext.name, [ext.resource_types || ''], false)).length === 0 ? (
                    <p className="text-muted-foreground">No matching JS extensions.</p>
                ) : (
                    installed.filter(ext => filterMatches(ext.name, [ext.resource_types || ''], false)).map((ext) => (
                    <div key={ext.id} className="bg-card p-4 rounded-lg border border-border flex flex-col justify-between shadow-sm hover:border-primary/50 transition-colors">
                        <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="font-semibold text-lg text-foreground">{ext.name}</h3>
                            <p className="text-sm text-muted-foreground">v{ext.version}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => handleUninstallJs(ext.id)}
                                className="text-muted-foreground hover:text-red-500 transition-colors p-1 rounded hover:bg-red-500/10"
                                title="Uninstall"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                            <div className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${ext.enabled ? "bg-primary" : "bg-muted"}`}>
                                <div className={`w-4 h-4 bg-background rounded-full absolute top-1 transition-transform ${ext.enabled ? "right-1" : "left-1"}`}></div>
                            </div>
                        </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                            Types: {ext.resource_types || 'N/A'}
                        </div>
                    </div>
                    ))
                )}
                </div>
            </div>

            <div>
                <h2 className="text-2xl font-semibold mb-4 border-b border-border pb-2">Stremio Addons</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stremioAddons.filter(ext => {
                    const manifest = JSON.parse(ext.manifest_json);
                    return filterMatches(manifest.name, manifest.types || [], isOfficialAddon(ext.transport_url));
                }).length === 0 ? (
                    <p className="text-muted-foreground">No matching Stremio addons.</p>
                ) : (
                    stremioAddons.filter(ext => {
                        const manifest = JSON.parse(ext.manifest_json);
                        return filterMatches(manifest.name, manifest.types || [], isOfficialAddon(ext.transport_url));
                    }).map((ext) => {
                        const manifest = JSON.parse(ext.manifest_json);
                        const isOfficial = isOfficialAddon(ext.transport_url);
                        return (
                        <div key={ext.id} className="bg-card p-4 rounded-lg border border-border flex flex-col justify-between shadow-sm hover:border-primary/50 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                            <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-lg text-foreground">{manifest.name}</h3>
                                  {isOfficial && <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Official</span>}
                                </div>
                                <p className="text-sm text-muted-foreground">v{manifest.version}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => handleUninstallStremio(ext.id)}
                                    className="text-muted-foreground hover:text-red-500 transition-colors p-1 rounded hover:bg-red-500/10"
                                    title="Uninstall"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                <div 
                                    onClick={() => toggleStremio(ext.id, ext.is_active)}
                                    className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${ext.is_active ? "bg-primary" : "bg-muted"}`}
                                >
                                    <div className={`w-4 h-4 bg-background rounded-full absolute top-1 transition-transform ${ext.is_active ? "right-1" : "left-1"}`}></div>
                                </div>
                            </div>
                            </div>
                            <p className="text-sm text-foreground/80 mb-4 line-clamp-2">{manifest.description || "No description."}</p>
                            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded border border-border/50">
                                Types: {manifest.types?.join(', ') || 'N/A'}
                            </div>
                        </div>
                        );
                    })
                )}
                </div>
            </div>
        </div>
      )}

      {activeTab === 'discover' && (
        <div className="space-y-8">
            <div className="p-6 bg-card border border-border rounded-xl shadow-sm">
              <h2 className="text-xl font-bold mb-4">Install Addon via URL</h2>
              <form onSubmit={(e) => { e.preventDefault(); handleStremioInstall(stremioUrlInput); }} className="flex gap-4">
                  <input 
                      type="url" 
                      value={stremioUrlInput}
                      onChange={(e) => setStremioUrlInput(e.target.value)}
                      placeholder="https://.../manifest.json" 
                      className="flex-1 bg-background border border-border rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                  />
                  <button 
                      type="submit"
                      className="bg-primary text-primary-foreground px-6 py-2 rounded-md font-bold hover:bg-primary/90 transition-colors flex items-center gap-2"
                  >
                      <Download className="w-4 h-4" />
                      Install
                  </button>
              </form>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-4 border-b border-border pb-2">Recommended Stremio Addons</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {RECOMMENDED_STREMIO_ADDONS.filter(rec => filterMatches(rec.name, rec.types, true)).map((rec) => {
                  const isInstalled = stremioAddons.some(a => a.transport_url === rec.url.replace('/manifest.json', ''));
                  return (
                    <div key={rec.url} className="bg-card p-4 rounded-lg border border-border flex flex-col justify-between shadow-sm hover:border-primary/50 transition-colors">
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg text-foreground">{rec.name}</h3>
                          <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Official</span>
                        </div>
                        <p className="text-sm text-foreground/80 mb-2">{rec.desc}</p>
                        <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded border border-border/50">Types: {rec.types.join(", ")}</p>
                      </div>
                      <button 
                          disabled={isInstalled}
                          onClick={() => handleStremioInstall(rec.url)}
                          className={`w-full py-2 rounded flex items-center justify-center gap-2 text-sm font-medium transition-colors ${isInstalled ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                      >
                          {isInstalled ? 'Installed' : (
                              <>
                                  <Download className="w-4 h-4" /> Install
                              </>
                          )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-4 border-b border-border pb-2">Community JS Registry</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {discover.filter(ext => filterMatches(ext.name, ext.types, false)).map((ext) => {
                  const isInstalled = installed.some(i => i.id === ext.id);
                  return (
                    <div key={ext.id} className="bg-card p-4 rounded-lg border border-border flex flex-col justify-between shadow-sm hover:border-primary/50 transition-colors">
                      <div className="mb-4">
                        <h3 className="font-semibold text-lg text-foreground">{ext.name}</h3>
                        <p className="text-sm text-muted-foreground mb-2">v{ext.version}</p>
                        <p className="text-xs text-muted-foreground mb-1">Provides: {ext.resources.join(", ")}</p>
                        <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded border border-border/50">Types: {ext.types.join(", ")}</p>
                      </div>
                      <button 
                          disabled={isInstalled}
                          onClick={() => handleInstall(ext)}
                          className={`w-full py-2 rounded flex items-center justify-center gap-2 text-sm font-medium transition-colors ${isInstalled ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                      >
                          {isInstalled ? 'Installed' : (
                              <>
                                  <Download className="w-4 h-4" /> Install
                              </>
                          )}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
        </div>
      )}
    </div>
  );
}
