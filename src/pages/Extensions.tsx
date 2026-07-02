import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2 } from "lucide-react";
import type { Extension } from "../types";

export default function Extensions() {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<Extension[]>("get_extensions")
      .then((data) => {
        setExtensions(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch extensions:", err);
        // Fallback mock if backend command doesn't exist yet
        setExtensions([
          { id: "local", name: "Local Source", version: "1.0", manifest_url: "", resource_types: "", enabled: true, last_updated: "" }
        ]);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Extensions</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {extensions.map((ext) => (
          <div key={ext.id} className="bg-card p-4 rounded-lg border border-border flex justify-between items-center shadow-sm hover:border-primary/50 transition-colors">
            <div>
              <h3 className="font-medium text-foreground">{ext.name}</h3>
              <p className="text-sm text-muted-foreground">v{ext.version}</p>
            </div>
            <div className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${ext.enabled ? "bg-primary" : "bg-muted"}`}>
               <div className={`w-4 h-4 bg-background rounded-full absolute top-1 transition-transform ${ext.enabled ? "right-1" : "left-1"}`}></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
