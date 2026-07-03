use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Deserialize, Serialize, Debug)]
pub struct MangaDexSearchResponse {
    pub data: Vec<MangaDexManga>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct MangaDexManga {
    pub id: String,
    pub attributes: MangaDexAttributes,
    #[serde(default)]
    pub relationships: Vec<MangaDexRelationship>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct MangaDexRelationship {
    pub id: String,
    pub r#type: String,
    pub attributes: Option<MangaDexRelationshipAttributes>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct MangaDexRelationshipAttributes {
    #[serde(rename = "fileName")]
    pub file_name: Option<String>,
    pub name: Option<String>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct MangaDexAttributes {
    #[serde(default)]
    pub title: HashMap<String, String>,
    #[serde(default)]
    pub description: HashMap<String, String>,
    pub status: Option<String>,
}

pub async fn search(query: &str) -> Result<MangaDexSearchResponse, String> {
    let client = Client::builder()
        .user_agent("Isekast/0.1.0")
        .build()
        .unwrap_or_else(|_| Client::new());
    let res = client
        .get("https://api.mangadex.org/manga")
        .query(&[("title", query), ("includes[]", "cover_art")])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        res.json::<MangaDexSearchResponse>()
            .await
            .map_err(|e| e.to_string())
    } else {
        Err(format!("MangaDex API Error: {}", res.status()))
    }
}

pub async fn get_popular_manga() -> Result<MangaDexSearchResponse, String> {
    let client = Client::builder()
        .user_agent("Isekast/0.1.0")
        .build()
        .unwrap_or_else(|_| Client::new());
    let res = client
        .get("https://api.mangadex.org/manga")
        .query(&[("order[followedCount]", "desc"), ("limit", "15"), ("includes[]", "cover_art")])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        res.json::<MangaDexSearchResponse>().await.map_err(|e| e.to_string())
    } else {
        Err(format!("MangaDex API Error: {}", res.status()))
    }
}

// --- Chapter fetching ---

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct MangaDexChapterResponse {
    pub data: Vec<MangaDexChapter>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct MangaDexChapter {
    pub id: String,
    pub attributes: MangaDexChapterAttributes,
    #[serde(default)]
    pub relationships: Vec<MangaDexRelationship>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct MangaDexChapterAttributes {
    pub chapter: Option<String>,
    pub title: Option<String>,
    #[serde(rename = "translatedLanguage")]
    pub translated_language: Option<String>,
    pub pages: Option<u32>,
    #[serde(rename = "publishAt")]
    pub publish_at: Option<String>,
}

pub async fn get_chapters(manga_id: &str) -> Result<MangaDexChapterResponse, String> {
    let client = Client::builder()
        .user_agent("Isekast/0.1.0")
        .build()
        .unwrap_or_else(|_| Client::new());
    let res = client
        .get(&format!("https://api.mangadex.org/manga/{}/feed", manga_id))
        .query(&[
            ("translatedLanguage[]", "en"),
            ("order[chapter]", "desc"),
            ("limit", "100"),
            ("includes[]", "scanlation_group"),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        res.json::<MangaDexChapterResponse>().await.map_err(|e| e.to_string())
    } else {
        Err(format!("MangaDex API Error: {}", res.status()))
    }
}

// --- Page fetching (at-home) ---

#[derive(Deserialize, Debug)]
pub struct AtHomeResponse {
    #[serde(rename = "baseUrl")]
    pub base_url: String,
    pub chapter: AtHomeChapter,
}

#[derive(Deserialize, Debug)]
pub struct AtHomeChapter {
    pub hash: String,
    pub data: Vec<String>,
    #[serde(rename = "dataSaver")]
    pub data_saver: Vec<String>,
}

pub async fn get_chapter_pages(chapter_id: &str) -> Result<Vec<String>, String> {
    let client = Client::builder()
        .user_agent("Isekast/0.1.0")
        .build()
        .unwrap_or_else(|_| Client::new());
    let res = client
        .get(&format!("https://api.mangadex.org/at-home/server/{}", chapter_id))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        let at_home: AtHomeResponse = res.json().await.map_err(|e| e.to_string())?;
        // Build full URLs for data-saver images (smaller, faster loading)
        let urls: Vec<String> = at_home.chapter.data_saver.iter().map(|filename| {
            format!("{}/data-saver/{}/{}", at_home.base_url, at_home.chapter.hash, filename)
        }).collect();
        Ok(urls)
    } else {
        Err(format!("MangaDex At-Home API Error: {}", res.status()))
    }
}
