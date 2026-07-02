import { useEffect, useState, useRef } from "react";
import { Play, Pause, X, Maximize, ClosedCaption, Volume2 } from "lucide-react";

interface VideoPlayerProps {
    src: string;
    onClose: () => void;
}

export default function VideoPlayer({ src: _src, onClose }: VideoPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(true);
    const [showControls, setShowControls] = useState(true);
    const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const resetHideTimeout = () => {
        setShowControls(true);
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = setTimeout(() => {
            setShowControls(false);
        }, 3000);
    };

    useEffect(() => {
        resetHideTimeout();
        return () => {
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        };
    }, []);

    return (
        <div 
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center cursor-default bg-transparent"
            onMouseMove={resetHideTimeout}
            onClick={resetHideTimeout}
        >
            {/* Top Bar (Close) */}
            <div className={`absolute top-0 left-0 right-0 p-6 flex justify-end bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <button onClick={onClose} className="p-3 bg-black/50 hover:bg-destructive/80 text-white rounded-full backdrop-blur-md transition-colors">
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Bottom Controls */}
            <div className={`absolute bottom-0 left-0 right-0 p-8 pt-24 bg-gradient-to-t from-black via-black/80 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                
                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-white/20 rounded-full mb-6 relative cursor-pointer group">
                    <div className="absolute top-0 left-0 h-full bg-primary rounded-full w-1/3"></div>
                    <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"></div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-6">
                        <button onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }} className="hover:text-primary transition-colors">
                            {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current" />}
                        </button>
                        <div className="flex items-center gap-3 group">
                            <Volume2 className="w-6 h-6 hover:text-primary transition-colors cursor-pointer" />
                            <div className="w-24 h-1.5 bg-white/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                <div className="h-full w-2/3 bg-white rounded-full"></div>
                            </div>
                        </div>
                        <div className="text-sm font-medium font-mono">
                            08:24 / 23:40
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <button className="hover:text-primary transition-colors flex items-center gap-2">
                            <ClosedCaption className="w-6 h-6" />
                            <span className="text-sm font-medium">EN</span>
                        </button>
                        <button className="hover:text-primary transition-colors">
                            <Maximize className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
