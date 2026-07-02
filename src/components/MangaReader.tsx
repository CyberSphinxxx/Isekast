import { useState } from "react";
import { Settings, X, ChevronLeft, ChevronRight } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";

interface MangaReaderProps {
    pages: string[];
    onClose: () => void;
}

export default function MangaReader({ pages, onClose }: MangaReaderProps) {
    const [showOverlays, setShowOverlays] = useState(true);
    const [mode, setMode] = useState<"webtoon" | "paginated">("webtoon");
    const [direction, setDirection] = useState<"ltr" | "rtl">("rtl");
    const [currentPage, setCurrentPage] = useState(0);

    const toggleOverlays = () => setShowOverlays(!showOverlays);

    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center select-none">
            {/* Top Overlay */}
            <div className={`fixed top-0 left-0 right-0 p-4 flex justify-between items-center bg-background/80 backdrop-blur-md z-10 transition-opacity duration-300 border-b border-border ${showOverlays ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <span className="text-foreground font-semibold">Manga Reader</span>
                <div className="flex items-center gap-4">
                    <Dialog.Root>
                        <Dialog.Trigger asChild>
                            <button className="p-2 hover:bg-secondary rounded-full transition-colors">
                                <Settings className="w-5 h-5 text-foreground" />
                            </button>
                        </Dialog.Trigger>
                        <Dialog.Portal>
                            <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" />
                            <Dialog.Content className="fixed right-0 top-0 bottom-0 w-80 bg-card border-l border-border p-6 z-[60] flex flex-col gap-6 animate-in slide-in-from-right">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-xl font-bold">Reader Settings</h2>
                                    <Dialog.Close asChild>
                                        <button className="p-1 hover:bg-secondary rounded-full"><X className="w-5 h-5" /></button>
                                    </Dialog.Close>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">Reading Mode</label>
                                        <div className="flex gap-2">
                                            <button onClick={() => setMode("webtoon")} className={`flex-1 py-2 rounded border ${mode === "webtoon" ? "border-primary bg-primary/20 text-primary" : "border-border"}`}>Webtoon</button>
                                            <button onClick={() => setMode("paginated")} className={`flex-1 py-2 rounded border ${mode === "paginated" ? "border-primary bg-primary/20 text-primary" : "border-border"}`}>Paginated</button>
                                        </div>
                                    </div>
                                    {mode === "paginated" && (
                                        <div>
                                            <label className="text-sm font-medium mb-2 block">Direction</label>
                                            <div className="flex gap-2">
                                                <button onClick={() => setDirection("rtl")} className={`flex-1 py-2 rounded border ${direction === "rtl" ? "border-primary bg-primary/20 text-primary" : "border-border"}`}>Right-to-Left</button>
                                                <button onClick={() => setDirection("ltr")} className={`flex-1 py-2 rounded border ${direction === "ltr" ? "border-primary bg-primary/20 text-primary" : "border-border"}`}>Left-to-Right</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Dialog.Content>
                        </Dialog.Portal>
                    </Dialog.Root>
                    <button onClick={onClose} className="p-2 hover:bg-destructive/20 text-destructive rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>
            
            {/* Canvas */}
            <div className="flex-1 w-full h-full overflow-y-auto" onClick={toggleOverlays}>
                {mode === "webtoon" ? (
                    <div className="flex flex-col w-full max-w-3xl mx-auto pb-20 pt-16">
                        {pages.map((url, index) => (
                            <img 
                                key={index} 
                                src={url} 
                                alt={`Page ${index + 1}`} 
                                loading="lazy" 
                                className="w-full object-contain mb-1"
                            />
                        ))}
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center pt-16 pb-16 relative">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setCurrentPage(Math.max(0, currentPage - 1)); }}
                            className="absolute left-4 p-4 text-white/50 hover:text-white z-10"
                        >
                            <ChevronLeft className="w-10 h-10" />
                        </button>
                        <img 
                            src={pages[currentPage]} 
                            alt={`Page ${currentPage + 1}`}
                            className="max-h-full max-w-full object-contain"
                        />
                        <button 
                            onClick={(e) => { e.stopPropagation(); setCurrentPage(Math.min(pages.length - 1, currentPage + 1)); }}
                            className="absolute right-4 p-4 text-white/50 hover:text-white z-10"
                        >
                            <ChevronRight className="w-10 h-10" />
                        </button>
                    </div>
                )}
            </div>

            {/* Bottom Overlay */}
            <div className={`fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md z-10 transition-opacity duration-300 border-t border-border flex justify-center items-center ${showOverlays ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                {mode === "paginated" && (
                    <div className="text-foreground text-sm font-medium">
                        Page {currentPage + 1} of {pages.length}
                    </div>
                )}
                {mode === "webtoon" && (
                    <div className="text-foreground text-sm font-medium">
                        Webtoon Mode
                    </div>
                )}
            </div>
        </div>
    );
}
