use dashmap::DashMap;
use std::sync::Arc;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tokio::sync::oneshot;
use uuid::Uuid;

#[derive(Clone, Default)]
pub struct AntibotState {
    pub pending_requests: Arc<DashMap<String, oneshot::Sender<String>>>,
}

impl AntibotState {
    pub fn new() -> Self {
        Self {
            pending_requests: Arc::new(DashMap::new()),
        }
    }
}

pub async fn fetch_with_webview(app: AppHandle, url: String) -> Result<String, String> {
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
                    html: document.documentElement.outerHTML
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
        Ok(html) => Ok(html),
        Err(_) => Err("Failed to receive HTML from webview".to_string()),
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
