use tauri::{AppHandle, Manager};
use std::path::{Path, PathBuf};
use crate::db::Database;
use std::fs;

fn walk_dir(dir: &Path, files: &mut Vec<PathBuf>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                walk_dir(&path, files);
            } else {
                files.push(path);
            }
        }
    }
}

#[tauri::command]
pub async fn scan_local_media(app: AppHandle) -> Result<String, String> {
    let db = app.state::<Database>();
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let local_media = app_data.join("LocalMedia");
    let anime_dir = local_media.join("Anime");
    let manga_dir = local_media.join("Manga");
    
    let _ = fs::create_dir_all(&anime_dir);
    let _ = fs::create_dir_all(&manga_dir);
    
    let mut files = Vec::new();
    walk_dir(&anime_dir, &mut files);
    
    let mut added = 0;
    
    for path in files {
        if let Some(ext) = path.extension() {
            let ext_str = ext.to_string_lossy().to_lowercase();
            if ext_str == "mp4" || ext_str == "mkv" {
                if let Some(parent) = path.parent() {
                    let parent_name = parent.file_name().unwrap_or_default().to_string_lossy().to_string();
                    let title = if parent_name.starts_with("Season") || parent_name.starts_with("Specials") {
                        parent.parent().and_then(|p| p.file_name()).unwrap_or_default().to_string_lossy().to_string()
                    } else {
                        parent_name
                    };
                    
                    let filename = path.file_stem().unwrap_or_default().to_string_lossy().to_string();
                    
                    let item: Option<crate::db::repository::MediaItem> = sqlx::query_as(
                        "SELECT * FROM media_item WHERE title LIKE ?"
                    )
                    .bind(&format!("%{}%", title))
                    .fetch_optional(&db.pool)
                    .await
                    .map_err(|e| e.to_string())?;
                    
                    if let Some(media) = item {
                        db.upsert_download(&media.id, &filename, &path.to_string_lossy(), "completed", 0).await?;
                        added += 1;
                    }
                }
            }
        }
    }
    
    Ok(format!("Scanned and mapped {} files", added))
}
