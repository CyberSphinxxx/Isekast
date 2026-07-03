import { useState } from "react";
import { Settings, X, ChevronLeft, ChevronRight } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { invoke } from "@tauri-apps/api/core";

interface MangaReaderProps {
    pages: string[];
    onClose: () => void;
}

export default function MangaReader({ pages, onClose }: MangaReaderProps) {
    const [showOverlays, setShowOverlays] = useState(true);
    const [mode, setMode] = useState<"webtoon" | "paginated">("webtoon");
    const [direction, setDirection] = useState<"ltr" | "rtl">("rtl");
    const [currentPage, setCurrentPage] = useState(0);

    const handleClose = async () => {
        try {
            await invoke("push_progress_to_anilist", { anilistId: 105398, progress: currentPage + 1 });
            console.log("Synced manga progress to AniList");
        } catch (e) {
            console.error("Failed to sync progress:", e);
        }
        onClose();
    };

    const toggleOverlays = () => setShowOverlays(!showOverlays);

    return (
        <div className="fixed inset-0 z-50 bg-black text-white flex flex-col items-center select-none" style={{ backgroundColor: 'black', color: 'white' }}>
            
            {/* Invisible Tap Zone (Center 60%) */}
            <div 
                className="absolute top-0 bottom-0 left-[20%] right-[20%] z-20 cursor-pointer" 
                onClick={toggleOverlays} 
            />

            {/* Top Overlay */}
            <div className={`fixed top-0 left-0 right-0 p-4 flex justify-between items-center bg-zinc-900/90 backdrop-blur-md z-30 transition-transform duration-300 border-b border-zinc-800 ${showOverlays ? 'translate-y-0' : '-translate-y-full'}`}>
                <div className="flex items-center gap-4">
                    <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
                        <X className="w-6 h-6" />
                    </button>
                    <span className="text-white font-semibold text-lg drop-shadow-sm">Chapter 12: Journey's End</span>
                </div>
                
                <div className="flex items-center gap-4">
                    <Dialog.Root>
                        <Dialog.Trigger asChild>
                            <button className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                                <Settings className="w-5 h-5 text-white" />
                            </button>
                        </Dialog.Trigger>
                        <Dialog.Portal>
                            <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" />
                            <Dialog.Content className="fixed right-0 top-0 bottom-0 w-80 bg-zinc-900 text-white border-l border-zinc-800 p-6 z-[60] flex flex-col gap-6 animate-in slide-in-from-right">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-xl font-bold">Reader Settings</h2>
                                    <Dialog.Close asChild>
                                        <button className="p-1 hover:bg-zinc-800 rounded-full"><X className="w-5 h-5" /></button>
                                    </Dialog.Close>
                                </div>
                                <div className="space-y-6">
                                    <div>
                                        <label className="text-sm font-medium mb-3 block text-zinc-400">Reading Mode</label>
                                        <div className="flex bg-zinc-950 rounded-lg p-1">
                                            <button 
                                                onClick={() => setMode("webtoon")} 
                                                className={`flex-1 py-2 text-sm rounded-md transition-colors ${mode === "webtoon" ? "bg-zinc-800 font-semibold shadow-sm text-white" : "text-zinc-400 hover:text-white"}`}
                                            >
                                                Webtoon
                                            </button>
                                            <button 
                                                onClick={() => setMode("paginated")} 
                                                className={`flex-1 py-2 text-sm rounded-md transition-colors ${mode === "paginated" ? "bg-zinc-800 font-semibold shadow-sm text-white" : "text-zinc-400 hover:text-white"}`}
                                            >
                                                Paginated
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className={`transition-opacity ${mode === "paginated" ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
                                        <label className="text-sm font-medium mb-3 block text-zinc-400">Reading Direction</label>
                                        <div className="flex bg-zinc-950 rounded-lg p-1">
                                            <button 
                                                onClick={() => setDirection("rtl")} 
                                                className={`flex-1 py-2 text-sm rounded-md transition-colors ${direction === "rtl" ? "bg-zinc-800 font-semibold shadow-sm text-white" : "text-zinc-400 hover:text-white"}`}
                                            >
                                                Right-to-Left
                                            </button>
                                            <button 
                                                onClick={() => setDirection("ltr")} 
                                                className={`flex-1 py-2 text-sm rounded-md transition-colors ${direction === "ltr" ? "bg-zinc-800 font-semibold shadow-sm text-white" : "text-zinc-400 hover:text-white"}`}
                                            >
                                                Left-to-Right
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </Dialog.Content>
                        </Dialog.Portal>
                    </Dialog.Root>
                </div>
            </div>
            
            {/* Canvas */}
            <div className="flex-1 w-full h-full overflow-y-auto z-10 relative bg-black">
                {mode === "webtoon" ? (
                    <div className="flex flex-col w-full max-w-3xl mx-auto pb-32 pt-24 bg-black">
                        {pages.map((url, index) => (
                            <img 
                                key={index} 
                                src={url} 
                                alt={`Page ${index + 1}`} 
                                loading="lazy" 
                                className="w-full object-contain mb-2"
                            />
                        ))}
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center pt-20 pb-24 relative bg-black">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setCurrentPage(direction === "rtl" ? Math.min(pages.length - 1, currentPage + 1) : Math.max(0, currentPage - 1)); }}
                            className="absolute left-4 p-4 text-white/50 hover:text-white z-30"
                        >
                            <ChevronLeft className="w-12 h-12" />
                        </button>
                        
                        <img 
                            src={pages[currentPage]} 
                            alt={`Page ${currentPage + 1}`}
                            className="max-h-full max-w-full object-contain"
                        />
                        
                        <button 
                            onClick={(e) => { e.stopPropagation(); setCurrentPage(direction === "rtl" ? Math.max(0, currentPage - 1) : Math.min(pages.length - 1, currentPage + 1)); }}
                            className="absolute right-4 p-4 text-white/50 hover:text-white z-30"
                        >
                            <ChevronRight className="w-12 h-12" />
                        </button>
                    </div>
                )}
            </div>

            {/* Bottom Overlay */}
            <div className={`fixed bottom-0 left-0 right-0 p-6 bg-zinc-900/90 backdrop-blur-md z-30 transition-transform duration-300 border-t border-zinc-800 flex justify-center items-center ${showOverlays ? 'translate-y-0' : 'translate-y-full'}`}>
                <div className="w-full max-w-2xl flex items-center gap-4 text-white">
                    <span className="text-sm font-medium w-12 text-right">{mode === "paginated" ? currentPage + 1 : 1}</span>
                    <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden relative cursor-pointer">
                        <div 
                            className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all"
                            style={{ width: mode === "paginated" ? `${((currentPage + 1) / pages.length) * 100}%` : '50%' }}
                        />
                    </div>
                    <span className="text-sm font-medium w-12">{pages.length}</span>
                </div>
            </div>
        </div>
    );
}
