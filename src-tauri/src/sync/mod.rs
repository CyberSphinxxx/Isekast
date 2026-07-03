use crate::secure;
use reqwest::Client;
use serde_json::json;

const ANILIST_API_URL: &str = "https://graphql.anilist.co";

pub async fn sync_anilist_to_local(_app: &tauri::AppHandle, db: &crate::db::Database) -> Result<(), String> {
    let token = secure::get_anilist_token()?.unwrap_or_default();
    if token.is_empty() {
        return Ok(());
    }

    let client = Client::new();
    
    let query = "query { Viewer { id name avatar { large } } }";
    let res = client.post(ANILIST_API_URL)
        .bearer_auth(&token)
        .json(&json!({ "query": query }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
        
    let body: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let user_id = body["data"]["Viewer"]["id"].as_i64().ok_or("Failed to get Viewer ID")?;
    
    let list_query = r#"
    query($userId: Int) {
        MediaListCollection(userId: $userId, type: ANIME) {
            lists {
                entries {
                    id
                    status
                    progress
                    score
                    media {
                        id
                    }
                }
            }
        }
        MangaList: MediaListCollection(userId: $userId, type: MANGA) {
            lists {
                entries {
                    id
                    status
                    progress
                    progressVolumes
                    score
                    media {
                        id
                    }
                }
            }
        }
    }
    "#;
    
    let res2 = client.post(ANILIST_API_URL)
        .bearer_auth(&token)
        .json(&json!({
            "query": list_query,
            "variables": { "userId": user_id }
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
        
    let lists_body: serde_json::Value = res2.json().await.map_err(|e| e.to_string())?;
    
    // Basic sync loop: iterate through anime and manga lists and update local tracking
    if let Some(lists) = lists_body["data"]["MediaListCollection"]["lists"].as_array() {
        for list in lists {
            if let Some(entries) = list["entries"].as_array() {
                for entry in entries {
                    let anilist_id = entry["media"]["id"].as_i64().unwrap_or(0);
                    let progress = entry["progress"].as_i64();
                    let score = entry["score"].as_f64();
                    let status = entry["status"].as_str();

                    if anilist_id == 0 { continue; }

                    if let Ok(Some(item)) = db.get_media_item_by_anilist_id(anilist_id).await {
                        let _ = db.update_anilist_progress(&item.id, progress, None, score, status).await;
                    }
                }
            }
        }
    }

    if let Some(lists) = lists_body["data"]["MangaList"]["lists"].as_array() {
        for list in lists {
            if let Some(entries) = list["entries"].as_array() {
                for entry in entries {
                    let anilist_id = entry["media"]["id"].as_i64().unwrap_or(0);
                    let progress = entry["progress"].as_i64();
                    let score = entry["score"].as_f64();
                    let status = entry["status"].as_str();

                    if anilist_id == 0 { continue; }

                    if let Ok(Some(item)) = db.get_media_item_by_anilist_id(anilist_id).await {
                        let _ = db.update_anilist_progress(&item.id, None, progress, score, status).await;
                    }
                }
            }
        }
    }
    
    Ok(())
}

pub async fn push_progress_to_anilist(
    anilist_id: i64,
    progress: i64,
) -> Result<(), String> {
    let token = secure::get_anilist_token()?.unwrap_or_default();
    if token.is_empty() {
        return Ok(());
    }

    let mutation = r#"
    mutation($mediaId: Int, $progress: Int) {
        SaveMediaListEntry(mediaId: $mediaId, progress: $progress) {
            id
            progress
        }
    }
    "#;

    let client = Client::new();
    let res = client.post(ANILIST_API_URL)
        .bearer_auth(&token)
        .json(&json!({
            "query": mutation,
            "variables": { "mediaId": anilist_id, "progress": progress }
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let _: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

    Ok(())
}

pub async fn get_anilist_viewer() -> Result<Option<serde_json::Value>, String> {
    let token = secure::get_anilist_token()?.unwrap_or_default();
    if token.is_empty() {
        return Ok(None);
    }
    let client = Client::new();
    let query = "query { Viewer { id name avatar { large } } }";
    let res = client.post(ANILIST_API_URL)
        .bearer_auth(&token)
        .json(&json!({ "query": query }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
        
    let body: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    Ok(Some(body["data"]["Viewer"].clone()))
}
