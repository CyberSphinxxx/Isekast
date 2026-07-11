import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Settings, ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { invoke } from "@tauri-apps/api/core";
import type { MediaItem } from "../types";

export default function MangaReader() {
    const { mangaId, chapterId } = useParams();
    const navigate = useNavigate();
    
    // UI State
    const [showOverlays, setShowOverlays] = useState(true);
    const [mode, setMode] = useState<"webtoon" | "paginated">("paginated");
    const [direction, setDirection] = useState<"ltr" | "rtl">("rtl");
    const [fitMode, setFitMode] = useState<"width" | "original">("width");
    
    // Reading State
    const [item, setItem] = useState<MediaItem | null>(null);
    const [pages, setPages] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(0);
    const [loadingPages, setLoadingPages] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // Deduplication guard — prevents pushing progress twice per chapter session.
    const chapterCompletedRef = useRef(false);
    // Ref for the webtoon scroll container so we can observe scroll position.
    const webtoonContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!mangaId) return;
        invoke<MediaItem | null>("get_media_item_by_id", { id: mangaId })
          .then((data) => {
            if (data) setItem(data);
          })
          .catch(console.error);
    }, [mangaId]);

    useEffect(() => {
        if (!chapterId) return;
        setLoadingPages(true);
        setError(null);
        // Reset completion guard whenever a new chapter is loaded.
        chapterCompletedRef.current = false;
        invoke<string[]>("fetch_manga_pages", { chapterId })
            .then((urls) => {
                setPages(urls);
                setCurrentPage(0);
            })
            .catch((e) => {
                console.error("Failed to fetch chapter pages:", e);
                setError(`Failed to load pages: ${e}`);
            })
            .finally(() => setLoadingPages(false));
    }, [chapterId]);

    // ─── Chapter Completion Handler ─────────────────────────────────────────
    // Fire-and-forget: records chapter completion locally and pushes to AniList.
    const pushChapterCompletion = useCallback(() => {
        if (chapterCompletedRef.current) return; // Already pushed for this chapter.
        if (!mangaId) return;
        chapterCompletedRef.current = true;

        const progressJson = JSON.stringify({
            chapterId,
            completed: true,
            completedAt: new Date().toISOString(),
        });

        // 1. Persist completion locally.
        invoke("update_media_progress", { id: mangaId, progressJson }).catch(console.error);

        // 2. Push to AniList if available.
        if (item) {
            const externalIds = item.external_ids ? JSON.parse(item.external_ids) : {};
            const anilistId: number | null = externalIds?.anilist ?? null;
            // Derive chapter number from chapterId or fall back to null.
            const chapterNum = chapterId ? parseInt(chapterId, 10) : null;
            if (anilistId && chapterNum !== null && !isNaN(chapterNum)) {
                invoke("push_progress_to_anilist", {
                    anilistId,
                    progress: chapterNum,
                }).catch(console.error);
            }
        }
    }, [mangaId, chapterId, item]);

    const toggleOverlays = () => setShowOverlays(!showOverlays);

    const handlePageTurn = (forward: boolean) => {
        if (forward) {
            const nextPage = Math.min(pages.length - 1, currentPage + 1);
            setCurrentPage(nextPage);
            // In paginated mode: reaching the last page = chapter complete.
            if (nextPage === pages.length - 1 && pages.length > 0) {
                pushChapterCompletion();
            }
        } else {
            setCurrentPage(p => Math.max(0, p - 1));
        }
    };

    const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (mode === "webtoon") {
            toggleOverlays();
            return;
        }

        const width = e.currentTarget.clientWidth;
        const clickX = e.nativeEvent.offsetX;
        
        const zoneWidth = width * 0.25; // 25% on each side for turning pages
        
        if (clickX < zoneWidth) {
            // Clicked left side
            handlePageTurn(direction === "ltr" ? false : true);
        } else if (clickX > width - zoneWidth) {
            // Clicked right side
            handlePageTurn(direction === "ltr" ? true : false);
        } else {
            // Clicked center
            toggleOverlays();
        }
    };

    return (
        <div className="fixed inset-0 w-[100vw] h-[100vh] bg-black text-white flex flex-col items-center select-none z-50 overflow-hidden">
            
            {/* Top Overlay */}
            <div className={`fixed top-0 left-0 right-0 p-4 flex justify-between items-center bg-zinc-900/90 backdrop-blur-md z-30 transition-transform duration-300 border-b border-zinc-800 ${showOverlays ? 'translate-y-0' : '-translate-y-full'}`}>
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <div className="text-white font-semibold text-lg drop-shadow-sm leading-tight">{item?.title || "Loading..."}</div>
                        <div className="text-zinc-400 text-sm">Chapter {chapterId?.slice(0, 8)}...</div>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    <Dialog.Root>
                        <Dialog.Trigger asChild>
                            <button className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                                <Settings className="w-6 h-6 text-white" />
                            </button>
                        </Dialog.Trigger>
                        <Dialog.Portal>
                            <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" />
                            <Dialog.Content className="fixed right-0 top-0 bottom-0 w-80 bg-zinc-900 text-white border-l border-zinc-800 p-6 z-[60] flex flex-col gap-6 animate-in slide-in-from-right">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-xl font-bold">Reader Settings</h2>
                                </div>
                                <div className="space-y-6 mt-4">
                                    <div>
                                        <label className="text-sm font-medium mb-3 block text-zinc-400">Reading Mode</label>
                                        <div className="flex bg-zinc-950 rounded-lg p-1">
                                            <button onClick={() => setMode("webtoon")} className={`flex-1 py-2 text-sm rounded-md transition-colors ${mode === "webtoon" ? "bg-zinc-800 font-semibold text-white" : "text-zinc-400"}`}>Webtoon</button>
                                            <button onClick={() => setMode("paginated")} className={`flex-1 py-2 text-sm rounded-md transition-colors ${mode === "paginated" ? "bg-zinc-800 font-semibold text-white" : "text-zinc-400"}`}>Paginated</button>
                                        </div>
                                    </div>
                                    
                                    <div className={`transition-opacity ${mode === "paginated" ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
                                        <label className="text-sm font-medium mb-3 block text-zinc-400">Reading Direction</label>
                                        <div className="flex bg-zinc-950 rounded-lg p-1">
                                            <button onClick={() => setDirection("rtl")} className={`flex-1 py-2 text-sm rounded-md transition-colors ${direction === "rtl" ? "bg-zinc-800 font-semibold text-white" : "text-zinc-400"}`}>RTL</button>
                                            <button onClick={() => setDirection("ltr")} className={`flex-1 py-2 text-sm rounded-md transition-colors ${direction === "ltr" ? "bg-zinc-800 font-semibold text-white" : "text-zinc-400"}`}>LTR</button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-sm font-medium mb-3 block text-zinc-400">Image Sizing</label>
                                        <div className="flex bg-zinc-950 rounded-lg p-1">
                                            <button onClick={() => setFitMode("width")} className={`flex-1 py-2 text-sm rounded-md transition-colors ${fitMode === "width" ? "bg-zinc-800 font-semibold text-white" : "text-zinc-400"}`}>Fit Width</button>
                                            <button onClick={() => setFitMode("original")} className={`flex-1 py-2 text-sm rounded-md transition-colors ${fitMode === "original" ? "bg-zinc-800 font-semibold text-white" : "text-zinc-400"}`}>Original</button>
                                        </div>
                                    </div>
                                </div>
                            </Dialog.Content>
                        </Dialog.Portal>
                    </Dialog.Root>
                </div>
            </div>
            
            {/* Canvas */}
            {loadingPages ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-12 h-12 animate-spin text-primary" />
                </div>
            ) : error ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="bg-card border border-destructive/50 text-card-foreground p-8 rounded-xl max-w-lg text-center">
                        <h2 className="font-bold text-xl mb-3 text-destructive">Error</h2>
                        <p className="text-sm opacity-90">{error}</p>
                        <button onClick={() => navigate(-1)} className="mt-6 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-medium transition-colors">
                            Go Back
                        </button>
                    </div>
                </div>
            ) : (
                <div 
                    className={`flex-1 w-full h-full z-10 relative bg-black ${mode === "webtoon" ? 'overflow-y-auto overflow-x-hidden' : 'overflow-hidden'}`}
                    onClick={handleCanvasClick}
                >
                    {mode === "webtoon" ? (
                        // Webtoon: vertical scroll. Completion = scroll near the bottom.
                        <div
                            ref={webtoonContainerRef}
                            className="flex flex-col w-full max-w-3xl mx-auto bg-black overflow-y-auto"
                            onScroll={(e) => {
                                const el = e.currentTarget;
                                const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 200;
                                if (nearBottom && pages.length > 0) {
                                    pushChapterCompletion();
                                }
                            }}
                        >
                            {pages.map((url, index) => (
                                <img 
                                    key={index} 
                                    src={url} 
                                    alt={`Page ${index + 1}`} 
                                    loading="lazy" 
                                    className={`w-full ${fitMode === 'width' ? 'object-cover' : 'object-contain mx-auto'}`}
                                    style={{ marginBottom: 0, paddingBottom: 0, display: 'block' }}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center relative bg-black">
                            {pages[currentPage] && (
                                <img 
                                    src={pages[currentPage]} 
                                    alt={`Page ${currentPage + 1}`}
                                    className={`${fitMode === 'width' ? 'w-full object-contain' : 'max-h-full max-w-full object-contain'}`}
                                />
                            )}
                            <button 
                                onClick={(e) => { e.stopPropagation(); handlePageTurn(direction === "rtl" ? false : true); }}
                                className="absolute left-4 p-4 text-white/50 hover:text-white z-30 opacity-0 hover:opacity-100 transition-opacity"
                            >
                                <ChevronLeft className="w-12 h-12" />
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handlePageTurn(direction === "rtl" ? true : false); }}
                                className="absolute right-4 p-4 text-white/50 hover:text-white z-30 opacity-0 hover:opacity-100 transition-opacity"
                            >
                                <ChevronRight className="w-12 h-12" />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Bottom Overlay (Paginated Only Scrubber) */}
            <div className={`fixed bottom-0 left-0 right-0 p-6 bg-zinc-900/90 backdrop-blur-md z-30 transition-transform duration-300 border-t border-zinc-800 flex justify-center items-center ${showOverlays && mode === "paginated" && pages.length > 0 ? 'translate-y-0' : 'translate-y-full'}`}>
                <div className="w-full max-w-2xl flex items-center gap-4 text-white">
                    <span className="text-sm font-medium w-12 text-right">{currentPage + 1}</span>
                    <input 
                        type="range"
                        min={0}
                        max={pages.length - 1}
                        value={direction === "rtl" ? pages.length - 1 - currentPage : currentPage}
                        onChange={(e) => {
                            const val = Number(e.target.value);
                            setCurrentPage(direction === "rtl" ? pages.length - 1 - val : val);
                        }}
                        className="flex-1 h-2 bg-zinc-700 rounded-full appearance-none cursor-pointer"
                        style={{ direction: direction === "rtl" ? "rtl" : "ltr" }}
                    />
                    <span className="text-sm font-medium w-12">{pages.length}</span>
                </div>
            </div>
        </div>
    );
}
