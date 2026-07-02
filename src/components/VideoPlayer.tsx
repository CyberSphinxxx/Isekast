import { useEffect, useRef } from "react";
import Hls from "hls.js";

interface VideoPlayerProps {
    src: string;
    onClose: () => void;
}

export default function VideoPlayer({ src, onClose }: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        let hls: Hls | null = null;

        if (Hls.isSupported() && src.includes('.m3u8')) {
            hls = new Hls();
            hls.loadSource(src);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play().catch(console.error);
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Safari / Native support
            video.src = src;
            video.addEventListener('loadedmetadata', () => {
                video.play().catch(console.error);
            });
        } else {
            // Standard MP4 or other format
            video.src = src;
            video.play().catch(console.error);
        }

        return () => {
            if (hls) {
                hls.destroy();
            }
        };
    }, [src]);

    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
            <div className="absolute top-4 left-4 z-50">
                <button onClick={onClose} className="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700 transition-colors">
                    Close Player
                </button>
            </div>
            <video
                ref={videoRef}
                controls
                className="w-full h-full max-h-screen outline-none"
            />
        </div>
    );
}
