use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Debug)]
pub struct TmdbSearchResponse {
    pub results: Vec<TmdbResult>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct TmdbResult {
    pub id: i64,
    pub title: Option<String>,
    pub name: Option<String>, // for TV
    pub overview: Option<String>,
    pub poster_path: Option<String>,
    pub backdrop_path: Option<String>,
    pub media_type: Option<String>,
}

pub async fn search(query: &str, token: &str) -> Result<TmdbSearchResponse, String> {
    let client = Client::new();
    let res = client
        .get("https://api.themoviedb.org/3/search/multi")
        .query(&[("query", query)])
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        res.json::<TmdbSearchResponse>()
            .await
            .map_err(|e| e.to_string())
    } else {
        Err(format!("TMDB API Error: {}", res.status()))
    }
}
