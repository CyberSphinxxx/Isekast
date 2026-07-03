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
pub fn get_anilist_auth_url() -> String {
    // Should be from env or constants, using placeholder client ID for this implementation
    let client_id = "12345"; 
    format!("https://anilist.co/api/v2/oauth/authorize?client_id={}&redirect_uri=https://anilist.co/api/v2/oauth/pin&response_type=token", client_id)
}

#[tauri::command]
pub fn save_anilist_token(token: String) -> Result<(), String> {
    secure::set_anilist_token(&token)
}

#[tauri::command]
pub fn get_anilist_token_status() -> Result<bool, String> {
    match secure::get_anilist_token() {
        Ok(Some(token)) => Ok(!token.is_empty()),
        Ok(None) => Ok(false),
        Err(e) => {
            eprintln!("Anilist Token status error: {}", e);
            Ok(false)
        }
    }
}

#[tauri::command]
pub fn delete_anilist_token() -> Result<(), String> {
    secure::delete_anilist_token()
}

#[tauri::command]
pub async fn sync_anilist_to_local(app: tauri::AppHandle, db: tauri::State<'_, Database>) -> Result<(), String> {
    crate::sync::sync_anilist_to_local(&app, &db).await
}

#[tauri::command]
pub async fn push_progress_to_anilist(anilist_id: i64, progress: i64) -> Result<(), String> {
    crate::sync::push_progress_to_anilist(anilist_id, progress).await
}

#[tauri::command]
pub async fn get_anilist_viewer() -> Result<Option<serde_json::Value>, String> {
    crate::sync::get_anilist_viewer().await
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

        let mut poster_path = None;
        for rel in &res.relationships {
            if rel.r#type == "cover_art" {
                if let Some(ref attrs) = rel.attributes {
                    if let Some(ref file_name) = attrs.file_name {
                        poster_path = Some(format!("https://uploads.mangadex.org/covers/{}/{}.256.jpg", res.id, file_name));
                    }
                }
            }
        }

        let item = MediaItem {
            id,
            r#type: "manga".to_string(),
            external_ids: Some(external_ids),
            title,
            alt_titles: None,
            overview,
            poster_path,
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

// Removed old run_extension sync logic

#[tauri::command]
pub fn submit_cloudflare_bypass_result(
    app: tauri::AppHandle,
    label: String,
    html: String,
    cookie: String,
    user_agent: String,
    state: tauri::State<'_, crate::downloader::AntibotState>,
) {
    use tauri::Manager;
    if let Some((_, tx)) = state.pending_requests.remove(&label) {
        let _ = tx.send((html, cookie, user_agent));
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

        let mut poster_path = None;
        for rel in &res.relationships {
            if rel.r#type == "cover_art" {
                if let Some(ref attrs) = rel.attributes {
                    if let Some(ref file_name) = attrs.file_name {
                        poster_path = Some(format!("https://uploads.mangadex.org/covers/{}/{}.256.jpg", res.id, file_name));
                    }
                }
            }
        }

        items.push(MediaItem {
            id: res.id.to_string(),
            r#type: "manga".to_string(),
            external_ids: Some(serde_json::json!({ "mangadex": res.id }).to_string()),
            title,
            alt_titles: None,
            overview,
            poster_path,
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

#[tauri::command]
pub async fn start_download(
    app: tauri::AppHandle,
    manager: tauri::State<'_, crate::downloads::DownloadManager>,
    id: String,
    title: String,
    url: String,
    r#type: String,
) -> Result<(), String> {
    crate::downloads::start_download(app, manager, id, title, url, r#type).await
}

#[tauri::command]
pub fn cancel_download(
    manager: tauri::State<'_, crate::downloads::DownloadManager>,
    id: String,
) -> Result<(), String> {
    crate::downloads::cancel_download(manager, id)
}

#[tauri::command]
pub async fn get_downloads(
    db: tauri::State<'_, crate::db::Database>,
) -> Result<Vec<crate::db::repository::DownloadItem>, String> {
    db.get_downloads().await
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ExtensionManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub resources: Vec<String>,
    pub types: Vec<String>,
    pub idPrefixes: Option<Vec<String>>,
    pub script_url: String,
}

#[tauri::command]
pub async fn fetch_extension_registry() -> Result<Vec<ExtensionManifest>, String> {
    Ok(vec![
        ExtensionManifest {
            id: "com.isekast.mock.video".into(),
            name: "Mock Anime Source".into(),
            version: "1.0.0".into(),
            resources: vec!["stream".into()],
            types: vec!["anime".into(), "movie".into(), "series".into()],
            idPrefixes: Some(vec!["tmdb:".into()]),
            script_url: "https://mock.isekast.com/anime.js".into(),
        },
        ExtensionManifest {
            id: "com.isekast.mock.manga".into(),
            name: "Mock Manga Source".into(),
            version: "1.0.0".into(),
            resources: vec!["manga".into()],
            types: vec!["manga".into()],
            idPrefixes: Some(vec!["mangadex:".into()]),
            script_url: "https://mock.isekast.com/manga.js".into(),
        }
    ])
}

#[tauri::command]
pub async fn install_extension(
    manifest: ExtensionManifest,
    db: tauri::State<'_, crate::db::Database>,
) -> Result<(), String> {
    let script = format!(
        r#"
        async function getStreams(type, id) {{
            if (type === 'manga') {{
                return {{ chapters: [ {{ id: 'ch1', title: 'Chapter 1' }} ] }};
            }}
            return {{ streams: [ {{ url: 'http://test.m3u8', title: '1080p' }} ] }};
        }}
        "#
    );
    
    let ext = crate::db::repository::Extension {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        manifest_url: Some(manifest.script_url),
        resource_types: Some(manifest.resources.join(",")),
        enabled: true,
        last_updated: Some(chrono::Utc::now().to_rfc3339()),
        script_content: Some(script),
    };
    
    db.upsert_extension(&ext).await?;
    Ok(())
}

#[tauri::command]
pub async fn get_extensions(
    db: tauri::State<'_, crate::db::Database>,
) -> Result<Vec<crate::db::repository::Extension>, String> {
    db.get_extensions().await
}

#[tauri::command]
pub async fn run_extension(
    extension_id: String,
    r#type: String,
    media_id: String,
    db: tauri::State<'_, crate::db::Database>,
) -> Result<String, String> {
    if extension_id == "local-source" {
        let downloads = sqlx::query_as::<_, crate::db::repository::DownloadItem>(
            "SELECT * FROM download WHERE media_item_id = ?"
        )
        .bind(&media_id)
        .fetch_all(&db.pool)
        .await
        .map_err(|e| e.to_string())?;
        
        let mut streams = Vec::new();
        for d in downloads {
            let title = d.episode_or_chapter_id.unwrap_or_else(|| "Local File".to_string());
            let encoded_path = urlencoding::encode(&d.local_file_path);
            let url = format!("isekast-stream://localhost/{}", encoded_path);
            
            streams.push(serde_json::json!({
                "name": "Local Source",
                "title": title,
                "url": url
            }));
        }
        
        let res = serde_json::json!({ "streams": streams });
        return Ok(res.to_string());
    }

    let ext = db.get_extension_by_id(&extension_id).await?.ok_or_else(|| "Extension not found".to_string())?;
    let script = ext.script_content.unwrap_or_default();
    crate::extensions::execute_scraper(&script, &r#type, &media_id).await
}
