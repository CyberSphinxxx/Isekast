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
    let token = token.trim();
    let client = Client::new();
    let mut req = client.get("https://api.themoviedb.org/3/search/multi");

    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::ACCEPT,
        reqwest::header::HeaderValue::from_static("application/json")
    );

    if token.len() > 60 {
        headers.insert(
            reqwest::header::AUTHORIZATION,
            reqwest::header::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap()
        );
        req = req.headers(headers);
    } else {
        req = req.headers(headers).query(&[("api_key", token)]);
    }

    let res = req
        .query(&[("query", query)])
        .send()
        .await
        .map_err(|e| {
            eprintln!("TMDB Network Error during search: {}", e);
            e.to_string()
        })?;

    if res.status().is_success() {
        res.json::<TmdbSearchResponse>()
            .await
            .map_err(|e| {
                eprintln!("TMDB JSON Parse Error: {}", e);
                e.to_string()
            })
    } else {
        let status = res.status();
        let err_text = res.text().await.unwrap_or_default();
        eprintln!("TMDB API Error [{}]: {}", status, err_text);
        Err(format!("TMDB API Error: {}", status))
    }
}

pub async fn get_trending_anime(token: &str) -> Result<TmdbSearchResponse, String> {
    let token = token.trim();
    let client = Client::new();
    let mut req = client.get("https://api.themoviedb.org/3/discover/tv");

    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::ACCEPT,
        reqwest::header::HeaderValue::from_static("application/json")
    );

    if token.len() > 60 {
        headers.insert(
            reqwest::header::AUTHORIZATION,
            reqwest::header::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap()
        );
        req = req.headers(headers);
    } else {
        req = req.headers(headers).query(&[("api_key", token)]);
    }

    let res = req
        .query(&[("with_original_language", "ja"), ("with_genres", "16"), ("sort_by", "popularity.desc")])
        .send()
        .await
        .map_err(|e| {
            eprintln!("TMDB Network Error during get_trending_anime: {}", e);
            e.to_string()
        })?;

    if res.status().is_success() {
        res.json::<TmdbSearchResponse>().await.map_err(|e| e.to_string())
    } else {
        let status = res.status();
        eprintln!("TMDB API Error [get_trending_anime]: {}", status);
        Err(format!("TMDB API Error: {}", status))
    }
}

pub async fn get_trending(token: &str) -> Result<TmdbSearchResponse, String> {
    let token = token.trim();
    let client = Client::new();
    let mut req = client.get("https://api.themoviedb.org/3/trending/all/week");

    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::ACCEPT,
        reqwest::header::HeaderValue::from_static("application/json")
    );

    if token.len() > 60 {
        headers.insert(
            reqwest::header::AUTHORIZATION,
            reqwest::header::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap()
        );
        req = req.headers(headers);
    } else {
        req = req.headers(headers).query(&[("api_key", token)]);
    }

    let res = req
        .send()
        .await
        .map_err(|e| {
            eprintln!("TMDB Network Error during get_trending: {}", e);
            e.to_string()
        })?;

    if res.status().is_success() {
        res.json::<TmdbSearchResponse>().await.map_err(|e| e.to_string())
    } else {
        let status = res.status();
        eprintln!("TMDB API Error [get_trending]: {}", status);
        Err(format!("TMDB API Error: {}", status))
    }
}
