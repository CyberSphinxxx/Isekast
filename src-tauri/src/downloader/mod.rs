use dashmap::DashMap;
use std::sync::Arc;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tokio::sync::oneshot;
use uuid::Uuid;

#[derive(Clone, Default)]
pub struct AntibotState {
    pub pending_requests: Arc<DashMap<String, oneshot::Sender<(String, String, String)>>>,
}

impl AntibotState {
    pub fn new() -> Self {
        Self {
            pending_requests: Arc::new(DashMap::new()),
        }
    }
}

pub async fn fetch_with_webview(app: AppHandle, url: String) -> Result<(String, String, String), String> {
    let state = app.state::<AntibotState>();

    let window_label = format!("antibot_{}", Uuid::new_v4().simple());
    let (tx, rx) = oneshot::channel();

    state.pending_requests.insert(window_label.clone(), tx);

    let init_script = format!(
        r#"
        let checkInterval = setInterval(() => {{
            let title = document.title.toLowerCase();
            let bodyText = document.body.innerText.toLowerCase();
            if (!title.includes('just a moment') && !title.includes('attention required') && !bodyText.includes('cloudflare')) {{
                clearInterval(checkInterval);
                window.__TAURI__.core.invoke('submit_cloudflare_bypass_result', {{
                    label: '{}',
                    html: document.documentElement.outerHTML,
                    cookie: document.cookie,
                    user_agent: navigator.userAgent
                }}).catch(console.error);
            }}
        }}, 1000);
    "#,
        window_label
    );

    let _webview = WebviewWindowBuilder::new(
        &app,
        &window_label,
        WebviewUrl::External(url.parse().unwrap()),
    )
    .visible(false)
    .initialization_script(&init_script)
    .build()
    .map_err(|e| e.to_string())?;

    match rx.await {
        Ok(result) => Ok(result),
        Err(_) => Err("Failed to receive data from webview".to_string()),
    }
}

pub async fn download_to_disk(url: &str, destination: &str) -> Result<(), String> {
    use futures_util::StreamExt;
    use std::path::Path;
    use tokio::fs::File;
    use tokio::io::AsyncWriteExt;

    let response = reqwest::get(url)
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Server returned error: {}", response.status()));
    }

    let path = Path::new(destination);
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create directories: {}", e))?;
    }

    let mut file = File::create(path)
        .await
        .map_err(|e| format!("Failed to create file: {}", e))?;
    let mut stream = response.bytes_stream();

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Error while downloading: {}", e))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Failed to write to file: {}", e))?;
    }

    Ok(())
}

pub async fn fetch_with_retry(app: AppHandle, url: String) -> Result<String, String> {
    use reqwest::header::{COOKIE, USER_AGENT};
    use tauri::Emitter;

    let client = reqwest::Client::new();
    
    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    
    if res.status() == 403 || res.status() == 503 {
        let _ = app.emit("cloudflare-challenge-started", ());
        
        let (_html, cookie, user_agent) = fetch_with_webview(app.clone(), url.clone()).await?;
        
        let _ = app.emit("cloudflare-challenge-resolved", ());
        
        let res2 = client.get(&url)
            .header(COOKIE, cookie)
            .header(USER_AGENT, user_agent)
            .send()
            .await
            .map_err(|e| e.to_string())?;
            
        return res2.text().await.map_err(|e| e.to_string());
    }
    
    res.text().await.map_err(|e| e.to_string())
}
