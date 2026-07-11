use std::process::Command;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use std::io::Write;

/// Returns the path to the bundled portable mpv.exe if it exists.
fn get_local_mpv_path(app: &AppHandle) -> Option<PathBuf> {
    let app_dir = app.path().app_data_dir().ok()?;
    let mpv_exe = app_dir.join("mpv").join("mpv.exe");
    if mpv_exe.exists() {
        Some(mpv_exe)
    } else {
        None
    }
}

/// Download and extract a portable MPV to the app's data directory.
#[tauri::command]
pub async fn download_mpv(app: tauri::AppHandle) -> Result<(), String> {
    let app_dir = app.path().app_data_dir().map_err(|_| "Failed to get app data dir".to_string())?;
    let mpv_dir = app_dir.join("mpv");
    
    if !mpv_dir.exists() {
        std::fs::create_dir_all(&mpv_dir).map_err(|e| e.to_string())?;
    }
    
    // Fetch latest release from GitHub API
    let client = reqwest::Client::builder()
        .user_agent("Isekast/0.1.0")
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;

    let release_url = "https://api.github.com/repos/shinchiro/mpv-winbuild-cmake/releases/latest";
    let release_json: serde_json::Value = client.get(release_url)
        .send().await.map_err(|e| format!("Failed to fetch release info: {}", e))?
        .json().await.map_err(|e| format!("Failed to parse release info: {}", e))?;

    let assets = release_json["assets"].as_array().ok_or("No assets found in release")?;
    let mut download_url = String::new();
    for asset in assets {
        if let Some(name) = asset["name"].as_str() {
            // Prefer the standard x86_64 build over the v3 (AVX2) build for maximum compatibility
            if name.starts_with("mpv-x86_64-") && name.ends_with(".7z") && !name.contains("-v3-") && !name.contains("-dev-") {
                if let Some(url) = asset["browser_download_url"].as_str() {
                    download_url = url.to_string();
                    break;
                }
            }
        }
    }

    if download_url.is_empty() {
        return Err("Could not find a compatible mpv x86_64 asset in the latest release".to_string());
    }

    let url = download_url;
    
    let archive_path = mpv_dir.join("mpv.7z");
    
    // Download
    let response = reqwest::get(url).await.map_err(|e| format!("Download failed: {}", e))?;
    let bytes = response.bytes().await.map_err(|e| format!("Failed to read body: {}", e))?;
    
    let mut file = std::fs::File::create(&archive_path).map_err(|e| format!("File creation failed: {}", e))?;
    file.write_all(&bytes).map_err(|e| format!("File write failed: {}", e))?;
    
    // Extract using sevenz-rust
    sevenz_rust::decompress_file(&archive_path, &mpv_dir).map_err(|e| format!("Extraction failed: {}", e))?;
    
    // Clean up archive
    let _ = std::fs::remove_file(archive_path);
    
    Ok(())
}

/// Launch an external player (mpv) with the given stream URL.
///
/// Spawns mpv as a detached process so it runs independently of the app.
/// Returns Ok(()) on successful spawn, or an error message if mpv is not found.
#[tauri::command]
pub async fn launch_external_player(
    url: String,
    title: Option<String>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    // Determine which mpv to run. Try local portable version first.
    let mpv_cmd = if let Some(local_mpv) = get_local_mpv_path(&app) {
        local_mpv.to_string_lossy().to_string()
    } else {
        "mpv".to_string()
    };

    let mut cmd = Command::new(&mpv_cmd);
    cmd.arg(&url);

    if let Some(t) = title {
        cmd.arg(format!("--force-media-title={}", t));
    }

    // Prevent mpv's stdout/stderr from blocking the Tauri process.
    cmd.stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());

    cmd.spawn().map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            "MPV_NOT_FOUND".to_string() // Special signal to frontend
        } else {
            format!("Failed to launch mpv: {}", e)
        }
    })?;

    Ok(())
}
