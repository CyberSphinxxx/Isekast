import { useEffect, useState, useRef } from "react";
import { Play, Pause, X, Maximize, ClosedCaption, Volume2, Settings } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface VideoPlayerProps {
    src: string;
    onClose: () => void;
}

export default function VideoPlayer({ src: _src, onClose }: VideoPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(true);
    const [showControls, setShowControls] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleClose = async () => {
        try {
            await invoke("push_progress_to_anilist", { anilistId: 108465, progress: 1 }); // Example ID for Frieren
            console.log("Synced video progress to AniList");
        } catch (e) {
            console.error("Failed to sync progress:", e);
        }
        onClose();
    };

    const resetHideTimeout = () => {
        setShowControls(true);
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        
        // Don't hide if settings menu is open
        if (!showSettings) {
            hideTimeoutRef.current = setTimeout(() => {
                setShowControls(false);
            }, 3000);
        }
    };

    useEffect(() => {
        resetHideTimeout();
        return () => {
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        };
    }, [showSettings]);

    useEffect(() => {
        let isMpv = true; // Assume MPV is the player
        if (isMpv && _src) {
            let targetPath = _src;
            
            // If it's our custom local protocol, parse the raw absolute OS path for native MPV speed
            if (_src.startsWith("isekast-stream://localhost/")) {
                targetPath = decodeURIComponent(_src.replace("isekast-stream://localhost/", ""));
                console.log("Spawning MPV with native local file:", targetPath);
            } else {
                console.log("Spawning MPV with network URL:", targetPath);
            }

            import("@tauri-apps/plugin-shell").then(({ Command }) => {
                const mpvCommand = Command.create("mpv", [
                    targetPath,
                    "--fs", // Fullscreen
                    "--ontop", // Keep on top
                ]);
                
                mpvCommand.execute().then((res: any) => {
                    console.log("MPV exited:", res.code);
                    handleClose();
                }).catch((err: any) => {
                    console.error("Failed to launch MPV:", err);
                });
            });
        }
    }, [_src]);

    return (
        <div 
            className="absolute inset-0 z-50 pointer-events-none flex flex-col justify-between"
            onMouseMove={resetHideTimeout}
        >
            {/* Top Bar (Close) */}
            <div className={`pointer-events-auto p-6 flex justify-end bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                <button onClick={handleClose} className="p-3 bg-black/50 hover:bg-destructive/80 text-white rounded-full backdrop-blur-md transition-colors shadow-lg">
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Bottom Controls */}
            <div className={`pointer-events-auto p-8 pt-24 bg-background/80 backdrop-blur-md transition-opacity duration-300 border-t border-border/50 shadow-2xl relative ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                
                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-foreground/20 rounded-full mb-6 relative cursor-pointer group">
                    <div className="absolute top-0 left-0 h-full bg-primary rounded-full w-1/3"></div>
                    <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"></div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between text-foreground">
                    <div className="flex items-center gap-6">
                        <button onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }} className="hover:text-primary transition-colors">
                            {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current" />}
                        </button>
                        <div className="flex items-center gap-3 group">
                            <Volume2 className="w-6 h-6 hover:text-primary transition-colors cursor-pointer" />
                            <div className="w-24 h-1.5 bg-foreground/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                <div className="h-full w-2/3 bg-foreground rounded-full"></div>
                            </div>
                        </div>
                        <div className="text-sm font-medium font-mono text-foreground/80">
                            08:24 / 23:40
                        </div>
                    </div>

                    <div className="flex items-center gap-6 relative">
                        <button className="hover:text-primary transition-colors flex items-center gap-2">
                            <ClosedCaption className="w-6 h-6" />
                            <span className="text-sm font-medium">EN</span>
                        </button>

                        {/* Settings Toggle */}
                        <div className="relative">
                            <button 
                                onClick={() => setShowSettings(!showSettings)}
                                className={`hover:text-primary transition-colors ${showSettings ? 'text-primary' : ''}`}
                            >
                                <Settings className="w-6 h-6" />
                            </button>

                            {/* Settings Popover */}
                            {showSettings && (
                                <div className="absolute bottom-full right-0 mb-4 w-64 bg-card border border-border rounded-lg shadow-xl p-4 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 z-50">
                                    <h3 className="font-semibold text-sm border-b border-border pb-2">Advanced Audio/Subtitles</h3>
                                    
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs font-medium text-muted-foreground block mb-1">Audio Track</label>
                                            <select className="w-full bg-secondary text-secondary-foreground text-sm rounded px-2 py-1 outline-none border border-border focus:border-primary">
                                                <option>Japanese (2.0 AAC)</option>
                                                <option>English (Dub)</option>
                                            </select>
                                        </div>
                                        
                                        <div>
                                            <label className="text-xs font-medium text-muted-foreground block mb-1">Subtitle Track</label>
                                            <select className="w-full bg-secondary text-secondary-foreground text-sm rounded px-2 py-1 outline-none border border-border focus:border-primary">
                                                <option>English (ASS/SSA)</option>
                                                <option>English (SRT)</option>
                                                <option>None</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button className="hover:text-primary transition-colors">
                            <Maximize className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
