interface MangaReaderProps {
    pages: string[];
    onClose: () => void;
}

export default function MangaReader({ pages, onClose }: MangaReaderProps) {
    return (
        <div className="fixed inset-0 z-50 bg-[#0f0f0f] overflow-y-auto flex flex-col items-center">
            <div className="sticky top-0 w-full p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-10 pointer-events-none">
                <span className="text-white font-semibold drop-shadow-md">Manga Reader</span>
                <button onClick={onClose} className="pointer-events-auto bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700 transition-colors">
                    Close Reader
                </button>
            </div>
            
            <div className="flex flex-col w-full max-w-3xl pb-20 -mt-16">
                {pages.map((url, index) => (
                    <img 
                        key={index} 
                        src={url} 
                        alt={`Page ${index + 1}`} 
                        loading="lazy" 
                        className="w-full object-contain mb-1 bg-black/20 min-h-[300px]"
                    />
                ))}
            </div>
        </div>
    );
}
