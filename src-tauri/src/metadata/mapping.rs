use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct GraphQLQuery {
    query: String,
    variables: serde_json::Value,
}

#[derive(Deserialize, Debug)]
pub struct AniListResponse {
    pub data: Option<AniListData>,
}

#[derive(Deserialize, Debug)]
pub struct AniListData {
    #[serde(rename = "Media")]
    pub media: Option<AniListMedia>,
}

#[derive(Deserialize, Debug)]
pub struct AniListMedia {
    pub id: i64,
    #[serde(rename = "idMal")]
    pub id_mal: Option<i64>,
}

pub async fn get_anilist_mapping(anilist_id: i64) -> Result<AniListMedia, String> {
    let client = Client::new();
    let query = r#"
        query ($id: Int) {
          Media(id: $id, type: ANIME) {
            id
            idMal
          }
        }
    "#
    .to_string();

    let res = client
        .post("https://graphql.anilist.co")
        .json(&GraphQLQuery {
            query,
            variables: serde_json::json!({ "id": anilist_id }),
        })
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        let json: AniListResponse = res.json().await.map_err(|e| e.to_string())?;
        if let Some(data) = json.data {
            if let Some(media) = data.media {
                return Ok(media);
            }
        }
        Err("Media not found on AniList".to_string())
    } else {
        Err(format!("AniList API Error: {}", res.status()))
    }
}
