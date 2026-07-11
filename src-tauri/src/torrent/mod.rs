//! Torrent-to-HTTP streaming engine using librqbit.
//!
//! This spawns a local Axum HTTP server that converts BitTorrent infoHashes
//! into streamable HTTP URLs suitable for the built-in video player or MPV.

use std::net::SocketAddr;
use std::sync::Arc;

use librqbit::{AddTorrent, AddTorrentOptions, Api, Session, SessionOptions};
use tokio::sync::RwLock;

pub struct TorrentStreamer {
    api: Api,
    port: u16,
}

impl TorrentStreamer {
    pub async fn new(download_dir: std::path::PathBuf) -> Result<Arc<Self>, String> {
        let port = find_free_port().ok_or("No free port for torrent HTTP server")?;

        std::fs::create_dir_all(&download_dir).ok();

        let session = Session::new_with_opts(download_dir, SessionOptions::default())
            .await
            .map_err(|e| format!("Failed to create torrent session: {e}"))?;

        let api = Api::new(session, None);
        let streamer = Arc::new(TorrentStreamer {
            api: api.clone(),
            port,
        });

        // Spawn a minimal HTTP server for serving torrent file streams
        let api_clone = api.clone();
        let addr: SocketAddr = format!("127.0.0.1:{}", port).parse().unwrap();

        tokio::spawn(async move {
            use axum::extract::{Path as AxumPath, State};
            use axum::response::{IntoResponse, Response};
            use axum::{Router, routing::get};
            use tauri::http::StatusCode;
            use tokio_util::io::ReaderStream;

            #[derive(Clone)]
            struct AppState {
                api: Api,
            }

            async fn stream_handler(
                AxumPath((torrent_id, file_idx)): AxumPath<(usize, usize)>,
                State(state): State<AppState>,
            ) -> Response {
                match state.api.api_stream(torrent_id.into(), file_idx) {
                    Ok(file_stream) => {
                        let stream = ReaderStream::new(file_stream);
                        let body = axum::body::Body::from_stream(stream);
                        axum::response::Response::builder()
                            .header("Content-Type", "video/mp4")
                            .header("Accept-Ranges", "bytes")
                            .header("Access-Control-Allow-Origin", "*")
                            .body(body)
                            .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
                    }
                    Err(e) => {
                        eprintln!("[torrent] Stream error: {e}");
                        StatusCode::NOT_FOUND.into_response()
                    }
                }
            }

            let state = AppState { api: api_clone };
            let app = Router::new()
                .route("/torrents/:torrent_id/stream/:file_idx", get(stream_handler))
                .with_state(state);

            match tokio::net::TcpListener::bind(addr).await {
                Ok(listener) => {
                    if let Err(e) = axum::serve(listener, app).await {
                        eprintln!("[torrent] HTTP server error: {e}");
                    }
                }
                Err(e) => {
                    eprintln!("[torrent] Failed to bind HTTP server: {e}");
                }
            }
        });

        Ok(streamer)
    }

    /// Stream a torrent by info hash. Returns a local HTTP URL for the best video file.
    pub async fn stream_torrent(&self, info_hash: &str) -> Result<String, String> {
        let magnet = format!("magnet:?xt=urn:btih:{}", info_hash);

        let resp = self
            .api
            .api_add_torrent(
                AddTorrent::from_url(&magnet),
                Some(AddTorrentOptions {
                    overwrite: true,
                    ..Default::default()
                }),
            )
            .await
            .map_err(|e| format!("Failed to add torrent: {e}"))?;

        let id: usize = resp.details.id.expect("Torrent ID missing");

        // Wait up to 30 seconds for torrent metadata
        let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(30);
        let file_idx = loop {
            if tokio::time::Instant::now() > deadline {
                return Err("Timed out waiting for torrent metadata".to_string());
            }

            if let Ok(details) = self.api.api_torrent_details(id.into()) {
                if let Some(files) = &details.files {
                    let idx = find_best_video_file_index(files);
                    break idx;
                }
            }

            tokio::time::sleep(std::time::Duration::from_millis(300)).await;
        };

        let url = format!(
            "http://127.0.0.1:{}/torrents/{}/stream/{}",
            self.port, id, file_idx
        );
        Ok(url)
    }

    pub fn port(&self) -> u16 {
        self.port
    }
}

fn find_best_video_file_index(files: &[librqbit::api::TorrentDetailsResponseFile]) -> usize {
    let video_exts = ["mkv", "mp4", "avi", "mov", "wmv", "m4v", "webm", "ts", "m2ts"];
    let mut best_idx = 0usize;
    let mut best_size = 0u64;

    for (i, f) in files.iter().enumerate() {
        let name = f.name.to_lowercase();
        if video_exts.iter().any(|ext| name.ends_with(ext)) {
            let size = f.length as u64;
            if size > best_size {
                best_size = size;
                best_idx = i;
            }
        }
    }
    best_idx
}

fn find_free_port() -> Option<u16> {
    use std::net::TcpListener;
    TcpListener::bind("127.0.0.1:0")
        .ok()
        .and_then(|l| l.local_addr().ok())
        .map(|a| a.port())
}

/// Tauri managed state for the torrent streaming engine.
pub struct TorrentState(pub RwLock<Option<Arc<TorrentStreamer>>>);

impl TorrentState {
    pub fn new() -> Self {
        TorrentState(RwLock::new(None))
    }
}
