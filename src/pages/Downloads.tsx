import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { Play, Pause, X } from 'lucide-react';

interface ActiveDownload {
  id: string;
  progress_percentage: number;
  speed: string;
  status: string;
}

interface OfflineItem {
  media_item_id: string;
  episode_or_chapter_id?: string;
  local_file_path: string;
  status: string;
  size?: number;
}

export default function Downloads() {
  const [activeDownloads, setActiveDownloads] = useState<Record<string, ActiveDownload>>({});
  const [offlineLibrary, setOfflineLibrary] = useState<OfflineItem[]>([]);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    
    // Fetch offline items
    invoke<OfflineItem[]>('get_downloads').then(setOfflineLibrary).catch(console.error);

    // Listen to download progress
    listen<ActiveDownload>('download-progress', (event) => {
      setActiveDownloads(prev => {
        const payload = event.payload;
        if (payload.status === 'completed' || payload.status === 'cancelled' || payload.status === 'error') {
            const next = { ...prev };
            delete next[payload.id];
            
            // If completed, refresh offline library
            if (payload.status === 'completed') {
                invoke<OfflineItem[]>('get_downloads').then(setOfflineLibrary).catch(console.error);
            }
            return next;
        }
        return { ...prev, [payload.id]: payload };
      });
    }).then(un => unlisten = un);

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleCancel = async (id: string) => {
      try {
          await invoke('cancel_download', { id });
      } catch(e) {
          console.error("Cancel failed:", e);
      }
  };

  const handlePause = (id: string) => {
      console.log("Pause clicked for", id);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12">
      <header>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Downloads</h1>
        <p className="text-muted-foreground">Manage your active queue and offline library.</p>
      </header>

      {/* Active Queue */}
      <section>
        <h2 className="text-2xl font-semibold mb-6">Active Queue</h2>
        <div className="space-y-4">
          {Object.values(activeDownloads).length === 0 ? (
              <p className="text-muted-foreground">No active downloads.</p>
          ) : (
            Object.values(activeDownloads).map(item => (
              <div key={item.id} className="bg-card border border-border rounded-lg p-6 flex flex-col gap-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg text-foreground">{item.id}</h3>
                    <p className="text-sm text-muted-foreground">{item.speed}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handlePause(item.id)} className="p-2 hover:bg-secondary rounded-full transition-colors">
                      <Pause className="w-5 h-5 text-foreground" />
                    </button>
                    <button onClick={() => handleCancel(item.id)} className="p-2 hover:bg-destructive/20 text-destructive rounded-full transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300 ease-out" 
                    style={{ width: `${item.progress_percentage}%` }} 
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Offline Library */}
      <section>
        <h2 className="text-2xl font-semibold mb-6">Offline Library</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {offlineLibrary.length === 0 ? (
              <p className="text-muted-foreground col-span-full">Your offline library is empty.</p>
          ) : (
              offlineLibrary.map(item => (
                <div key={item.media_item_id} className="group cursor-pointer">
                  <div className="relative aspect-[2/3] rounded-md overflow-hidden mb-3 border border-border shadow-sm">
                    <img 
                      src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Image_created_with_a_mobile_phone.png/400px-Image_created_with_a_mobile_phone.png"
                      alt={item.media_item_id} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                       <Play className="w-12 h-12 text-white drop-shadow-md" />
                    </div>
                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded shadow">
                      {item.local_file_path.includes('.mp4') ? 'VIDEO' : 'MANGA'}
                    </div>
                  </div>
                  <h3 className="font-medium text-sm text-foreground line-clamp-2 leading-snug">{item.media_item_id}</h3>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {item.local_file_path}
                  </p>
                </div>
              ))
          )}
        </div>
      </section>
    </div>
  );
}
