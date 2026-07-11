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
pub async fn get_media_item_by_id(id: String, db: tauri::State<'_, Database>) -> Result<Option<MediaItem>, String> {
    db.get_media_item_by_id(&id).await
}

#[tauri::command]
pub async fn check_in_library(media_item_id: String, db: tauri::State<'_, Database>) -> Result<bool, String> {
    db.check_in_library(&media_item_id).await
}

#[tauri::command]
pub async fn toggle_in_library(media_item_id: String, in_library: bool, db: tauri::State<'_, Database>) -> Result<(), String> {
    db.toggle_in_library(&media_item_id, in_library).await
}

#[tauri::command]
pub async fn get_setting(key: String, db: tauri::State<'_, Database>) -> Result<Option<String>, String> {
    db.get_setting(&key).await
}

#[tauri::command]
pub async fn set_setting(key: String, value: String, db: tauri::State<'_, Database>) -> Result<(), String> {
    db.set_setting(&key, &value).await
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
    let client_id = std::env::var("ANILIST_CLIENT_ID").unwrap_or_else(|_| "12345".to_string());
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
    
    let allow_adult = db.get_setting("allow_adult_content").await?.unwrap_or_else(|| "false".to_string()) == "true";
    let tmdb_res = tmdb::search(query, &token, allow_adult).await?;

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
    let allow_adult = db.get_setting("allow_adult_content").await?.unwrap_or_else(|| "false".to_string()) == "true";
    let md_res = mangadex::search(query, allow_adult).await?;

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
pub async fn get_progress_items(
    db: tauri::State<'_, crate::db::Database>,
) -> Result<Vec<MediaItem>, String> {
    db.get_progress_items().await
}

#[tauri::command]
pub async fn get_trending_anime(app: tauri::AppHandle, db: tauri::State<'_, Database>) -> Result<Vec<MediaItem>, String> {
    let token = secure::get_tmdb_token(&app)?.unwrap_or_default();
    if token.is_empty() {
        return Err("No TMDB token found".to_string());
    }
    let allow_adult = db.get_setting("allow_adult_content").await?.unwrap_or_else(|| "false".to_string()) == "true";
    let tmdb_res = tmdb::get_trending_anime(&token, allow_adult).await?;

    let mut items = Vec::new();
    for res in tmdb_res.results {
        let media_type = res.media_type.unwrap_or_else(|| "tv".to_string());

        let existing = db.get_media_item_by_tmdb_id(res.id).await?;
        let id = existing
            .map(|e| e.id)
            .unwrap_or_else(|| Uuid::new_v4().to_string());

        let item = MediaItem {
            id,
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
            cached_at: Some(Utc::now().to_rfc3339()),
            stale_after: None,
        };

        let _ = db.upsert_media_item(&item).await;
        items.push(item);
    }
    Ok(items)
}

#[tauri::command]
pub async fn get_trending_movies(app: tauri::AppHandle, db: tauri::State<'_, Database>) -> Result<Vec<MediaItem>, String> {
    let token = secure::get_tmdb_token(&app)?.unwrap_or_default();
    if token.is_empty() {
        return Err("No TMDB token found".to_string());
    }
    let allow_adult = db.get_setting("allow_adult_content").await?.unwrap_or_else(|| "false".to_string()) == "true";
    let tmdb_res = tmdb::get_trending(&token, allow_adult).await?;

    let mut items = Vec::new();
    for res in tmdb_res.results {
        let media_type = res.media_type.unwrap_or_else(|| "movie".to_string());

        let existing = db.get_media_item_by_tmdb_id(res.id).await?;
        let id = existing
            .map(|e| e.id)
            .unwrap_or_else(|| Uuid::new_v4().to_string());

        let item = MediaItem {
            id,
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
            cached_at: Some(Utc::now().to_rfc3339()),
            stale_after: None,
        };

        let _ = db.upsert_media_item(&item).await;
        items.push(item);
    }
    Ok(items)
}

#[tauri::command]
pub async fn get_popular_manga(db: tauri::State<'_, Database>) -> Result<Vec<MediaItem>, String> {
    let allow_adult = db.get_setting("allow_adult_content").await?.unwrap_or_else(|| "false".to_string()) == "true";
    let md_res = mangadex::get_popular_manga(allow_adult).await?;

    let mut items = Vec::new();
    for res in md_res.data {
        let existing = db.get_media_item_by_mangadex_id(&res.id).await?;
        let id = existing
            .map(|e| e.id)
            .unwrap_or_else(|| Uuid::new_v4().to_string());

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
            cached_at: Some(Utc::now().to_rfc3339()),
            stale_after: None,
        };

        let _ = db.upsert_media_item(&item).await;
        items.push(item);
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
    Ok(vec![])
}

#[tauri::command]
pub async fn install_extension(
    manifest: ExtensionManifest,
    db: tauri::State<'_, Database>,
) -> Result<(), String> {
    let script_content = reqwest::get(&manifest.script_url)
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;

    let ext = crate::db::repository::Extension {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        manifest_url: Some(manifest.script_url),
        resource_types: Some(manifest.resources.join(",")),
        enabled: true,
        last_updated: Some(chrono::Utc::now().to_rfc3339()),
        script_content: Some(script_content),
    };

    db.upsert_extension(&ext).await?;
    Ok(())
}

#[tauri::command]
pub async fn uninstall_extension(
    id: String,
    db: tauri::State<'_, Database>,
) -> Result<(), String> {
    db.delete_extension(&id).await
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

#[tauri::command]
pub async fn install_stremio_addon(
    manifest_url: String,
    db: tauri::State<'_, Database>,
) -> Result<(), String> {
    let resp = reqwest::get(&manifest_url)
        .await
        .map_err(|e| e.to_string())?;

    let manifest: crate::db::repository::StremioManifest = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse manifest: {}", e))?;

    let transport_url = manifest_url.trim_end_matches("/manifest.json").to_string();

    let addon = crate::db::repository::StremioAddon {
        id: manifest.id.clone(),
        transport_url,
        manifest_json: serde_json::to_string(&manifest).unwrap(),
        is_active: true,
    };

    db.upsert_stremio_addon(&addon).await?;

    Ok(())
}
#[tauri::command]
pub async fn uninstall_stremio_addon(
    id: String,
    db: tauri::State<'_, Database>,
) -> Result<(), String> {
    db.delete_stremio_addon(&id).await
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct StremioStream {
    pub name: Option<String>,
    pub title: Option<String>,
    pub url: Option<String>,
    #[serde(rename = "infoHash", default)]
    pub info_hash: Option<String>,
}

#[tauri::command]
pub async fn fetch_stremio_streams(
    media_type: String,
    media_id: String,
    season: Option<u32>,
    episode: Option<u32>,
    db: tauri::State<'_, Database>,
    app: tauri::AppHandle,
) -> Result<Vec<StremioStream>, String> {
    let addons = db.get_stremio_addons().await?;
    let active_addons = addons.into_iter().filter(|a| a.is_active).collect::<Vec<_>>();

    let mut handles = Vec::new();

    let media_item_opt = db.get_media_item_by_id(&media_id).await?;
    
    let mut resolved_id = media_id.clone();
    
    if let Some(item) = media_item_opt {
        if let Some(ext_ids_str) = item.external_ids {
            if let Ok(ext_ids) = serde_json::from_str::<serde_json::Value>(&ext_ids_str) {
                if let Some(imdb) = ext_ids.get("imdb").and_then(|v| v.as_str()) {
                    resolved_id = imdb.to_string();
                } else if let Some(tmdb) = ext_ids.get("tmdb") {
                    let tmdb_id = tmdb.as_u64().or_else(|| tmdb.as_str().and_then(|s| s.parse().ok()));
                    
                    if let Some(n) = tmdb_id {
                        // Try fetching external ids to get IMDb id since most stremio addons require it
                        if let Ok(Some(token)) = crate::secure::get_tmdb_token(&app) {
                            if let Ok(external) = crate::metadata::tmdb::get_external_ids(&media_type, n as i64, &token).await {
                                if let Some(imdb) = external.imdb_id {
                                    resolved_id = imdb;
                                } else {
                                    resolved_id = format!("tmdb:{}", n);
                                }
                            } else {
                                resolved_id = format!("tmdb:{}", n);
                            }
                        } else {
                            resolved_id = format!("tmdb:{}", n);
                        }
                    } else if let Some(s) = tmdb.as_str() {
                        resolved_id = format!("tmdb:{}", s);
                    }
                }
            }
        }
    }

    for addon in active_addons {
        let manifest: crate::db::repository::StremioManifest = 
            serde_json::from_str(&addon.manifest_json).unwrap();
        
        let supports_type = manifest.types.contains(&media_type) || manifest.types.contains(&"other".to_string());
        
        let has_stream_resource = manifest.resources.iter().any(|r| {
            if let Some(r_str) = r.as_str() {
                r_str == "stream"
            } else if let Some(r_obj) = r.as_object() {
                r_obj.get("name").and_then(|n| n.as_str()) == Some("stream")
            } else {
                false
            }
        });

        if supports_type && has_stream_resource {
            let url = if media_type == "series" && season.is_some() && episode.is_some() {
                format!("{}/stream/{}/{}:{}:{}.json", addon.transport_url, media_type, resolved_id, season.unwrap(), episode.unwrap())
            } else {
                format!("{}/stream/{}/{}.json", addon.transport_url, media_type, resolved_id)
            };
            println!("Fetching Stremio stream: {}", url);
            let handle = tokio::spawn(async move {
                let resp = reqwest::get(&url).await.ok()?;
                println!("Stremio response status for {}: {}", url, resp.status());
                let json: serde_json::Value = resp.json().await.ok()?;
                let streams = json.get("streams")?.as_array()?.clone();
                println!("Stremio streams found for {}: {}", url, streams.len());
                
                let mut parsed_streams = Vec::new();
                for s in streams {
                    if let Ok(st) = serde_json::from_value::<StremioStream>(s.clone()) {
                        parsed_streams.push(st);
                    } else {
                        println!("Failed to parse stream: {:?}", s);
                    }
                }
                Some(parsed_streams)
            });
            handles.push(handle);
        } else {
            println!("Addon {} skipped. supports_type: {}, has_stream_resource: {}", addon.transport_url, supports_type, has_stream_resource);
        }
    }

    let mut all_streams = Vec::new();
    for handle in handles {
        if let Ok(Some(streams)) = handle.await {
            all_streams.extend(streams);
        }
    }

    // Keep streams that have either a playable URL or an infoHash (torrent)
    all_streams.retain(|s| s.url.is_some() || s.info_hash.is_some());

    Ok(all_streams)
}

#[tauri::command]
pub async fn get_stremio_addons(
    db: tauri::State<'_, Database>,
) -> Result<Vec<crate::db::repository::StremioAddon>, String> {
    db.get_stremio_addons().await
}

#[tauri::command]
pub async fn toggle_stremio_addon(
    id: String,
    is_active: bool,
    db: tauri::State<'_, Database>,
) -> Result<(), String> {
    db.toggle_stremio_addon(&id, is_active).await
}

#[derive(serde::Serialize)]
pub struct MangaChapter {
    pub id: String,
    pub chapter: Option<String>,
    pub title: Option<String>,
    pub scanlation_group: Option<String>,
    pub publish_at: Option<String>,
    pub pages: Option<u32>,
}

#[tauri::command]
pub async fn fetch_manga_chapters(
    manga_id: String,
) -> Result<Vec<MangaChapter>, String> {
    let resp = mangadex::get_chapters(&manga_id).await?;
    let chapters: Vec<MangaChapter> = resp.data.into_iter().map(|ch| {
        let group = ch.relationships.iter()
            .find(|r| r.r#type == "scanlation_group")
            .and_then(|r| r.attributes.as_ref())
            .and_then(|a| a.name.clone());
        MangaChapter {
            id: ch.id,
            chapter: ch.attributes.chapter,
            title: ch.attributes.title,
            scanlation_group: group,
            publish_at: ch.attributes.publish_at,
            pages: ch.attributes.pages,
        }
    }).collect();
    Ok(chapters)
}

#[tauri::command]
pub async fn fetch_manga_pages(
    chapter_id: String,
) -> Result<Vec<String>, String> {
    mangadex::get_chapter_pages(&chapter_id).await
}

#[tauri::command]
pub async fn stream_torrent(
    info_hash: String,
    torrent_state: tauri::State<'_, crate::torrent::TorrentState>,
) -> Result<String, String> {
    let guard = torrent_state.0.read().await;
    let streamer = guard.as_ref().ok_or("Torrent streaming engine is not initialized")?;
    streamer.stream_torrent(&info_hash).await
}
