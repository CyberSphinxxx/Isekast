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
    let client = Client::new();
    let res = client
        .get("https://api.mangadex.org/manga")
        .query(&[("title", query)])
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
