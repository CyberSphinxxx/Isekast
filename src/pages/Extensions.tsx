import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, Download } from "lucide-react";
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

export default function Extensions() {
  const [activeTab, setActiveTab] = useState<'installed' | 'discover'>('installed');
  const [installed, setInstalled] = useState<Extension[]>([]);
  const [discover, setDiscover] = useState<ExtensionManifest[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    const init = async () => {
        setLoading(true);
        await fetchInstalled();
        await fetchDiscover();
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

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

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

      {activeTab === 'installed' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {installed.length === 0 ? (
              <p className="text-muted-foreground">No extensions installed.</p>
          ) : (
            installed.map((ext) => (
              <div key={ext.id} className="bg-card p-4 rounded-lg border border-border flex flex-col justify-between shadow-sm hover:border-primary/50 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-lg text-foreground">{ext.name}</h3>
                    <p className="text-sm text-muted-foreground">v{ext.version}</p>
                  </div>
                  <div className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${ext.enabled ? "bg-primary" : "bg-muted"}`}>
                    <div className={`w-4 h-4 bg-background rounded-full absolute top-1 transition-transform ${ext.enabled ? "right-1" : "left-1"}`}></div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                    Types: {ext.resource_types || 'N/A'}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'discover' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {discover.map((ext) => {
            const isInstalled = installed.some(i => i.id === ext.id);
            return (
              <div key={ext.id} className="bg-card p-4 rounded-lg border border-border flex flex-col justify-between shadow-sm hover:border-primary/50 transition-colors">
                <div className="mb-4">
                  <h3 className="font-semibold text-lg text-foreground">{ext.name}</h3>
                  <p className="text-sm text-muted-foreground mb-2">v{ext.version}</p>
                  <p className="text-xs text-muted-foreground mb-1">Provides: {ext.resources.join(", ")}</p>
                  <p className="text-xs text-muted-foreground">Types: {ext.types.join(", ")}</p>
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
      )}
    </div>
  );
}
