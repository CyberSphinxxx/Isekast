use super::Database;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct StremioAddon {
    pub id: String,
    pub transport_url: String,
    pub manifest_json: String,
    pub is_active: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct StremioManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub types: Vec<String>,
    pub id_prefixes: Option<Vec<String>>,
    pub resources: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct MediaProgress {
    pub id: String,
    pub progress_json: String,
    pub progress_episode: Option<i64>,
    pub progress_chapter: Option<i64>,
    pub user_score: Option<f64>,
    pub watch_status: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct DownloadItem {
    pub media_item_id: String,
    pub episode_or_chapter_id: Option<String>,
    pub local_file_path: String,
    pub status: String,
    pub size: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Extension {
    pub id: String,
    pub name: String,
    pub version: String,
    pub manifest_url: Option<String>,
    pub resource_types: Option<String>,
    pub enabled: bool,
    pub last_updated: Option<String>,
    pub script_content: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct MediaItem {
    pub id: String,
    pub r#type: String,
    pub external_ids: Option<String>,
    pub title: String,
    pub alt_titles: Option<String>,
    pub overview: Option<String>,
    pub poster_path: Option<String>,
    pub backdrop_path: Option<String>,
    pub genres: Option<String>,
    pub status: Option<String>,
    pub source_provider: Option<String>,
    pub metadata: Option<String>,
    pub cached_at: Option<String>,
    pub stale_after: Option<String>,
}

impl Database {
    pub async fn get_media_items(&self) -> Result<Vec<MediaItem>, String> {
        sqlx::query_as::<_, MediaItem>("SELECT * FROM media_item")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_media_item_by_id(&self, id: &str) -> Result<Option<MediaItem>, String> {
        sqlx::query_as::<_, MediaItem>(r#"SELECT * FROM media_item WHERE id = ?"#)
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_media_item_by_tmdb_id(
        &self,
        tmdb_id: i64,
    ) -> Result<Option<MediaItem>, String> {
        sqlx::query_as::<_, MediaItem>(
            r#"SELECT * FROM media_item WHERE json_extract(external_ids, '$.tmdb') = ?"#,
        )
        .bind(tmdb_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())
    }

    pub async fn get_media_item_by_mangadex_id(
        &self,
        mangadex_id: &str,
    ) -> Result<Option<MediaItem>, String> {
        sqlx::query_as::<_, MediaItem>(
            r#"SELECT * FROM media_item WHERE json_extract(external_ids, '$.mangadex') = ?"#,
        )
        .bind(mangadex_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())
    }

    pub async fn get_media_item_by_anilist_id(
        &self,
        anilist_id: i64,
    ) -> Result<Option<MediaItem>, String> {
        sqlx::query_as::<_, MediaItem>(
            r#"SELECT * FROM media_item WHERE json_extract(external_ids, '$.anilist') = ?"#,
        )
        .bind(anilist_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())
    }

    pub async fn upsert_media_item(&self, item: &MediaItem) -> Result<(), String> {
        sqlx::query(
            r#"
            INSERT INTO media_item (id, type, external_ids, title, alt_titles, overview, poster_path, backdrop_path, genres, status, source_provider, metadata, cached_at, stale_after)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                overview = excluded.overview,
                poster_path = excluded.poster_path,
                backdrop_path = excluded.backdrop_path,
                metadata = excluded.metadata,
                cached_at = excluded.cached_at,
                stale_after = excluded.stale_after
            "#
        )
        .bind(&item.id)
        .bind(&item.r#type)
        .bind(&item.external_ids)
        .bind(&item.title)
        .bind(&item.alt_titles)
        .bind(&item.overview)
        .bind(&item.poster_path)
        .bind(&item.backdrop_path)
        .bind(&item.genres)
        .bind(&item.status)
        .bind(&item.source_provider)
        .bind(&item.metadata)
        .bind(&item.cached_at)
        .bind(&item.stale_after)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub async fn get_progress(&self, id: &str) -> Result<Option<MediaProgress>, String> {
        sqlx::query_as::<_, MediaProgress>(
            r#"SELECT * FROM media_progress WHERE id = ?"#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())
    }

    pub async fn get_progress_items(&self) -> Result<Vec<MediaItem>, String> {
        sqlx::query_as::<_, MediaItem>(
            "SELECT m.* FROM media_item m JOIN media_progress p ON m.id = p.id ORDER BY p.updated_at DESC"
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())
    }

    pub async fn update_progress(&self, id: &str, progress_json: &str) -> Result<(), String> {
        sqlx::query(
            r#"
            INSERT INTO media_progress (id, progress_json, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
                progress_json = excluded.progress_json,
                updated_at = CURRENT_TIMESTAMP
            "#,
        )
        .bind(id)
        .bind(progress_json)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub async fn check_in_library(&self, media_item_id: &str) -> Result<bool, String> {
        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM media_item_collection WHERE media_item_id = ? AND collection_id = 'default_library'"
        )
        .bind(media_item_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(count.0 > 0)
    }

    pub async fn toggle_in_library(&self, media_item_id: &str, in_library: bool) -> Result<(), String> {
        sqlx::query(
            "INSERT OR IGNORE INTO collection (id, name, created_at) VALUES ('default_library', 'Library', CURRENT_TIMESTAMP)"
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        if in_library {
            sqlx::query(
                "INSERT OR IGNORE INTO media_item_collection (media_item_id, collection_id) VALUES (?, 'default_library')"
            )
            .bind(media_item_id)
            .execute(&self.pool)
            .await
            .map_err(|e| e.to_string())?;
        } else {
            sqlx::query(
                "DELETE FROM media_item_collection WHERE media_item_id = ? AND collection_id = 'default_library'"
            )
            .bind(media_item_id)
            .execute(&self.pool)
            .await
            .map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub async fn update_anilist_progress(
        &self,
        id: &str,
        episode: Option<i64>,
        chapter: Option<i64>,
        score: Option<f64>,
        status: Option<&str>,
    ) -> Result<(), String> {
        sqlx::query(
            r#"
            INSERT INTO media_progress (id, progress_json, progress_episode, progress_chapter, user_score, watch_status, updated_at)
            VALUES (?, '{}', ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
                progress_episode = COALESCE(excluded.progress_episode, progress_episode),
                progress_chapter = COALESCE(excluded.progress_chapter, progress_chapter),
                user_score = COALESCE(excluded.user_score, user_score),
                watch_status = COALESCE(excluded.watch_status, watch_status),
                updated_at = CURRENT_TIMESTAMP
            "#,
        )
        .bind(id)
        .bind(episode)
        .bind(chapter)
        .bind(score)
        .bind(status)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub async fn upsert_download(
        &self,
        media_item_id: &str,
        episode_or_chapter_id: &str,
        local_file_path: &str,
        status: &str,
        size: i64,
    ) -> Result<(), String> {
        sqlx::query(
            r#"
            INSERT INTO download (media_item_id, episode_or_chapter_id, local_file_path, status, size)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(media_item_id, episode_or_chapter_id) DO UPDATE SET
                local_file_path = excluded.local_file_path,
                status = excluded.status,
                size = excluded.size
            "#
        )
        .bind(media_item_id)
        .bind(episode_or_chapter_id)
        .bind(local_file_path)
        .bind(status)
        .bind(size)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub async fn get_downloads(&self) -> Result<Vec<DownloadItem>, String> {
        sqlx::query_as::<_, DownloadItem>("SELECT * FROM download")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_extensions(&self) -> Result<Vec<Extension>, String> {
        sqlx::query_as::<_, Extension>("SELECT * FROM extension")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_extension_by_id(&self, id: &str) -> Result<Option<Extension>, String> {
        sqlx::query_as::<_, Extension>("SELECT * FROM extension WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn upsert_extension(&self, ext: &Extension) -> Result<(), String> {
        sqlx::query(
            r#"
            INSERT INTO extension (id, name, version, manifest_url, resource_types, enabled, last_updated, script_content)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                version = excluded.version,
                manifest_url = excluded.manifest_url,
                resource_types = excluded.resource_types,
                enabled = excluded.enabled,
                last_updated = excluded.last_updated,
                script_content = excluded.script_content
            "#
        )
        .bind(&ext.id)
        .bind(&ext.name)
        .bind(&ext.version)
        .bind(&ext.manifest_url)
        .bind(&ext.resource_types)
        .bind(&ext.enabled)
        .bind(&ext.last_updated)
        .bind(&ext.script_content)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn delete_extension(&self, id: &str) -> Result<(), String> {
        sqlx::query("DELETE FROM extension WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn upsert_stremio_addon(&self, addon: &StremioAddon) -> Result<(), String> {
        sqlx::query(
            r#"
            INSERT INTO stremio_addons (id, transport_url, manifest_json, is_active)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                transport_url = excluded.transport_url,
                manifest_json = excluded.manifest_json,
                is_active = excluded.is_active
            "#,
        )
        .bind(&addon.id)
        .bind(&addon.transport_url)
        .bind(&addon.manifest_json)
        .bind(addon.is_active)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub async fn get_stremio_addons(&self) -> Result<Vec<StremioAddon>, String> {
        sqlx::query_as::<_, StremioAddon>("SELECT * FROM stremio_addons")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn toggle_stremio_addon(&self, id: &str, is_active: bool) -> Result<(), String> {
        sqlx::query("UPDATE stremio_addons SET is_active = ? WHERE id = ?")
            .bind(is_active)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn delete_stremio_addon(&self, id: &str) -> Result<(), String> {
        sqlx::query("DELETE FROM stremio_addons WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}
