use super::Database;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct MediaProgress {
    pub id: String,
    pub progress_json: String,
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
            r#"SELECT id, progress_json FROM media_progress WHERE id = ?"#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
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
}
