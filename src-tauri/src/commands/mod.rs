use crate::db::{repository::MediaItem, Database};
use crate::metadata::{mangadex, mapping, tmdb};
use crate::secure;
use chrono::Utc;
use uuid::Uuid;

#[tauri::command]
pub async fn get_media_items(db: tauri::State<'_, Database>) -> Result<Vec<MediaItem>, String> {
    db.get_media_items().await
}

#[tauri::command]
pub fn save_tmdb_token(app: tauri::AppHandle, token: String) -> Result<(), String> {
    secure::set_tmdb_token(&app, &token)
}

#[tauri::command]
pub fn get_tmdb_token_status(app: tauri::AppHandle) -> Result<bool, String> {
    match secure::get_tmdb_token(&app) {
        Ok(Some(token)) => Ok(!token.is_empty()),
        Ok(None) => Ok(false),
        Err(e) => {
            eprintln!("Token status error: {}", e);
            Ok(false)
        }
    }
}

#[tauri::command]
pub fn delete_tmdb_token(app: tauri::AppHandle) -> Result<(), String> {
    secure::delete_tmdb_token(&app)
}

#[tauri::command]
pub async fn search_tmdb(
    app: tauri::AppHandle,
    query: &str,
    db: tauri::State<'_, Database>,
) -> Result<Vec<MediaItem>, String> {
    let token = secure::get_tmdb_token(&app)?.unwrap_or_default();
    if token.is_empty() {
        return Err("No TMDB token found".to_string());
    }
    let tmdb_res = tmdb::search(query, &token).await?;

    let mut items = Vec::new();
    for res in tmdb_res.results {
        let media_type = res.media_type.unwrap_or_else(|| "movie".to_string());
        if media_type != "movie" && media_type != "tv" {
            continue;
        }

        let existing = db.get_media_item_by_tmdb_id(res.id).await?;
        let id = existing
            .map(|e| e.id)
            .unwrap_or_else(|| Uuid::new_v4().to_string());

        let external_ids = serde_json::json!({ "tmdb": res.id }).to_string();

        let item = MediaItem {
            id,
            r#type: media_type,
            external_ids: Some(external_ids),
            title: res.title.unwrap_or_else(|| res.name.unwrap_or_default()),
            alt_titles: None,
            overview: res.overview,
            poster_path: res.poster_path,
            backdrop_path: res.backdrop_path,
            genres: None,
            status: None,
            source_provider: Some("tmdb".to_string()),
            metadata: None,
            cached_at: Some(Utc::now().to_rfc3339()),
            stale_after: None, // e.g., +7 days
        };

        // Caching: store the item
        let _ = db.upsert_media_item(&item).await;

        items.push(item);
    }

    Ok(items)
}

#[tauri::command]
pub async fn search_mangadex(
    query: &str,
    db: tauri::State<'_, Database>,
) -> Result<Vec<MediaItem>, String> {
    let md_res = mangadex::search(query).await?;

    let mut items = Vec::new();
    for res in md_res.data {
        let existing = db.get_media_item_by_mangadex_id(&res.id).await?;
        let id = existing
            .map(|e| e.id)
            .unwrap_or_else(|| Uuid::new_v4().to_string());

        let external_ids = serde_json::json!({ "mangadex": res.id }).to_string();

        let title = res
            .attributes
            .title
            .get("en")
            .or_else(|| res.attributes.title.values().next())
            .cloned()
            .unwrap_or_else(|| "Unknown Title".to_string());

        let overview = res.attributes.description.get("en").cloned();

        let item = MediaItem {
            id,
            r#type: "manga".to_string(),
            external_ids: Some(external_ids),
            title,
            alt_titles: None,
            overview,
            poster_path: None,
            backdrop_path: None,
            genres: None,
            status: res.attributes.status,
            source_provider: Some("mangadex".to_string()),
            metadata: None,
            cached_at: Some(Utc::now().to_rfc3339()),
            stale_after: None,
        };

        let _ = db.upsert_media_item(&item).await;

        items.push(item);
    }

    Ok(items)
}

#[tauri::command]
pub async fn map_anime_ids(
    internal_id: &str,
    anilist_id: i64,
    db: tauri::State<'_, Database>,
) -> Result<MediaItem, String> {
    let mapping_res = mapping::get_anilist_mapping(anilist_id).await?;

    // Fetch the existing item from DB
    let mut item = db
        .get_media_item_by_id(internal_id)
        .await?
        .ok_or_else(|| "MediaItem not found".to_string())?;

    // Parse external_ids, merge, and save
    let mut ext_ids: serde_json::Value = if let Some(ref e) = item.external_ids {
        serde_json::from_str(e).unwrap_or_else(|_| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    if let Some(obj) = ext_ids.as_object_mut() {
        obj.insert("anilist".to_string(), serde_json::json!(mapping_res.id));
        if let Some(mal) = mapping_res.id_mal {
            obj.insert("mal".to_string(), serde_json::json!(mal));
        }
    }

    item.external_ids = Some(ext_ids.to_string());
    db.upsert_media_item(&item).await?;

    Ok(item)
}

#[tauri::command]
pub fn run_extension(script: &str, media_id: &str) -> Result<String, String> {
    crate::extensions::execute_scraper(script, media_id)
}

#[tauri::command]
pub fn submit_cloudflare_bypass_result(
    app: tauri::AppHandle,
    label: String,
    html: String,
    state: tauri::State<'_, crate::downloader::AntibotState>,
) {
    use tauri::Manager;
    if let Some((_, tx)) = state.pending_requests.remove(&label) {
        let _ = tx.send(html);
    }

    if let Some(window) = app.get_webview_window(&label) {
        let _ = window.close();
    }
}

#[tauri::command]
pub async fn download_media(url: String, filename: String) -> Result<(), String> {
    crate::downloader::download_to_disk(&url, &filename).await
}

#[tauri::command]
pub async fn update_media_progress(
    id: String,
    progress_json: String,
    db: tauri::State<'_, crate::db::Database>,
) -> Result<(), String> {
    db.update_progress(&id, &progress_json).await
}

#[tauri::command]
pub async fn get_media_progress(
    id: String,
    db: tauri::State<'_, crate::db::Database>,
) -> Result<Option<crate::db::repository::MediaProgress>, String> {
    db.get_progress(&id).await
}

#[tauri::command]
pub async fn get_trending_anime(app: tauri::AppHandle) -> Result<Vec<MediaItem>, String> {
    let token = secure::get_tmdb_token(&app)?.unwrap_or_default();
    if token.is_empty() {
        return Err("No TMDB token found".to_string());
    }
    let tmdb_res = tmdb::get_trending_anime(&token).await?;

    let mut items = Vec::new();
    for res in tmdb_res.results {
        // Just return it transiently since it's for discovery dashboard, no need to cache aggressively unless requested.
        let media_type = res.media_type.unwrap_or_else(|| "tv".to_string());
        items.push(MediaItem {
            id: res.id.to_string(), // TMDB ID directly for frontend
            r#type: media_type,
            external_ids: Some(serde_json::json!({ "tmdb": res.id }).to_string()),
            title: res.title.unwrap_or_else(|| res.name.unwrap_or_default()),
            alt_titles: None,
            overview: res.overview,
            poster_path: res.poster_path,
            backdrop_path: res.backdrop_path,
            genres: None,
            status: None,
            source_provider: Some("tmdb".to_string()),
            metadata: None,
            cached_at: None,
            stale_after: None,
        });
    }
    Ok(items)
}

#[tauri::command]
pub async fn get_trending_movies(app: tauri::AppHandle) -> Result<Vec<MediaItem>, String> {
    let token = secure::get_tmdb_token(&app)?.unwrap_or_default();
    if token.is_empty() {
        return Err("No TMDB token found".to_string());
    }
    let tmdb_res = tmdb::get_trending(&token).await?;

    let mut items = Vec::new();
    for res in tmdb_res.results {
        let media_type = res.media_type.unwrap_or_else(|| "movie".to_string());
        items.push(MediaItem {
            id: res.id.to_string(),
            r#type: media_type,
            external_ids: Some(serde_json::json!({ "tmdb": res.id }).to_string()),
            title: res.title.unwrap_or_else(|| res.name.unwrap_or_default()),
            alt_titles: None,
            overview: res.overview,
            poster_path: res.poster_path,
            backdrop_path: res.backdrop_path,
            genres: None,
            status: None,
            source_provider: Some("tmdb".to_string()),
            metadata: None,
            cached_at: None,
            stale_after: None,
        });
    }
    Ok(items)
}

#[tauri::command]
pub async fn get_popular_manga() -> Result<Vec<MediaItem>, String> {
    let md_res = mangadex::get_popular_manga().await?;

    let mut items = Vec::new();
    for res in md_res.data {
        let title = res
            .attributes
            .title
            .get("en")
            .or_else(|| res.attributes.title.values().next())
            .cloned()
            .unwrap_or_else(|| "Unknown Title".to_string());

        let overview = res.attributes.description.get("en").cloned();

        items.push(MediaItem {
            id: res.id.to_string(),
            r#type: "manga".to_string(),
            external_ids: Some(serde_json::json!({ "mangadex": res.id }).to_string()),
            title,
            alt_titles: None,
            overview,
            poster_path: None,
            backdrop_path: None,
            genres: None,
            status: res.attributes.status,
            source_provider: Some("mangadex".to_string()),
            metadata: None,
            cached_at: None,
            stale_after: None,
        });
    }
    Ok(items)
}
