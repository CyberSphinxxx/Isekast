use dashmap::DashMap;
use serde::Serialize;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::process::Command;
use tokio::io::{AsyncBufReadExt, BufReader};
use std::process::Stdio;
use std::fs;

#[derive(Clone, Serialize)]
pub struct DownloadProgressPayload {
    pub id: String,
    pub progress_percentage: f64,
    pub speed: String,
    pub status: String,
}

pub struct DownloadState {
    pub cancel_tx: tokio::sync::broadcast::Sender<()>,
}

pub struct DownloadManager {
    pub active_downloads: Arc<DashMap<String, DownloadState>>,
}

impl DownloadManager {
    pub fn new() -> Self {
        Self {
            active_downloads: Arc::new(DashMap::new()),
        }
    }
}

pub async fn start_download(
    app: AppHandle,
    manager: tauri::State<'_, DownloadManager>,
    id: String,
    title: String,
    url: String,
    r#type: String,
) -> Result<(), String> {
    if manager.active_downloads.contains_key(&id) {
        return Err("Download already active".into());
    }

    let (cancel_tx, mut cancel_rx) = tokio::sync::broadcast::channel(1);
    manager.active_downloads.insert(id.clone(), DownloadState { cancel_tx });

    let app_clone = app.clone();
    let id_clone = id.clone();
    let active_downloads = manager.active_downloads.clone();

    tokio::spawn(async move {
        let _ = app_clone.emit("download-progress", DownloadProgressPayload {
            id: id_clone.clone(),
            progress_percentage: 0.0,
            speed: "Starting...".into(),
            status: "active".into(),
        });

        let result = if r#type == "video" {
            download_video(&app_clone, &id_clone, &title, &url, &mut cancel_rx).await
        } else {
            download_manga(&app_clone, &id_clone, &title, &url, &mut cancel_rx).await
        };

        match result {
            Ok(_) => {
                let _ = app_clone.emit("download-progress", DownloadProgressPayload {
                    id: id_clone.clone(),
                    progress_percentage: 100.0,
                    speed: "Done".into(),
                    status: "completed".into(),
                });
                
                if let Some(db) = app_clone.try_state::<crate::db::Database>() {
                    let dir = app_clone.path().app_data_dir().unwrap_or_default();
                    let file_path = if r#type == "video" {
                        dir.join("Video").join(&title).join(format!("{}.mp4", title)).to_string_lossy().to_string()
                    } else {
                        dir.join("Manga").join(&title).join(&id_clone).to_string_lossy().to_string()
                    };
                    
                    let _ = db.upsert_download(&id_clone, &id_clone, &file_path, "completed", 0).await;
                }
            }
            Err(e) => {
                if e == "Cancelled" {
                    let _ = app_clone.emit("download-progress", DownloadProgressPayload {
                        id: id_clone.clone(),
                        progress_percentage: 0.0,
                        speed: "Cancelled".into(),
                        status: "cancelled".into(),
                    });
                } else {
                    let _ = app_clone.emit("download-progress", DownloadProgressPayload {
                        id: id_clone.clone(),
                        progress_percentage: 0.0,
                        speed: format!("Error: {}", e),
                        status: "error".into(),
                    });
                }
            }
        }

        active_downloads.remove(&id_clone);
    });

    Ok(())
}

pub fn cancel_download(manager: tauri::State<'_, DownloadManager>, id: String) -> Result<(), String> {
    if let Some(state) = manager.active_downloads.get(&id) {
        let _ = state.cancel_tx.send(());
        Ok(())
    } else {
        Err("Download not found".into())
    }
}

async fn download_video(
    app: &AppHandle,
    id: &str,
    title: &str,
    url: &str,
    cancel_rx: &mut tokio::sync::broadcast::Receiver<()>,
) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let video_dir = dir.join("Video").join(title);
    fs::create_dir_all(&video_dir).map_err(|e| e.to_string())?;
    
    let output_path = video_dir.join(format!("{}.mp4", title));

    let mut child = Command::new("ffmpeg")
        .args(["-y", "-i", url, "-c", "copy", output_path.to_str().unwrap()])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {}", e))?;

    let stderr = child.stderr.take().unwrap();
    let mut reader = BufReader::new(stderr).lines();

    let mut progress = 0.0;
    loop {
        tokio::select! {
            _ = cancel_rx.recv() => {
                let _ = child.kill().await;
                return Err("Cancelled".into());
            }
            line = reader.next_line() => {
                match line {
                    Ok(Some(line)) => {
                        if line.contains("time=") {
                            progress += 1.0;
                            if progress > 99.0 { progress = 99.0; }
                            
                            let _ = app.emit("download-progress", DownloadProgressPayload {
                                id: id.to_string(),
                                progress_percentage: progress,
                                speed: "Downloading...".into(),
                                status: "active".into(),
                            });
                        }
                    }
                    Ok(None) => break,
                    Err(_) => break,
                }
            }
        }
    }

    let status = child.wait().await.map_err(|e| e.to_string())?;
    if !status.success() {
        return Err("ffmpeg failed".into());
    }

    Ok(())
}

async fn download_manga(
    app: &AppHandle,
    id: &str,
    title: &str,
    _url: &str,
    cancel_rx: &mut tokio::sync::broadcast::Receiver<()>,
) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let manga_dir = dir.join("Manga").join(title).join(id);
    fs::create_dir_all(&manga_dir).map_err(|e| e.to_string())?;

    for i in 1..=10 {
        tokio::select! {
            _ = cancel_rx.recv() => {
                return Err("Cancelled".into());
            }
            _ = tokio::time::sleep(tokio::time::Duration::from_millis(500)) => {
                let progress = (i as f64 / 10.0) * 100.0;
                let _ = app.emit("download-progress", DownloadProgressPayload {
                    id: id.to_string(),
                    progress_percentage: progress,
                    speed: "250 KB/s".into(),
                    status: "active".into(),
                });
                fs::write(manga_dir.join(format!("{}.jpg", i)), b"mock image data").unwrap_or_default();
            }
        }
    }

    let details = serde_json::json!({
        "title": title,
        "chapter_id": id,
    });
    fs::write(manga_dir.join("details.json"), details.to_string()).unwrap_or_default();

    Ok(())
}
