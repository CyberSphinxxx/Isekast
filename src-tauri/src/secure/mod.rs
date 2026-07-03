use std::fs;
use tauri::Manager;

pub fn set_tmdb_token(app: &tauri::AppHandle, token: &str) -> Result<(), String> {
    let dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    let path = dir.join("tmdb_token.txt");
    fs::write(&path, token).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_tmdb_token(app: &tauri::AppHandle) -> Result<Option<String>, String> {
    let dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    let path = dir.join("tmdb_token.txt");
    if path.exists() {
        match fs::read_to_string(&path) {
            Ok(token) => Ok(Some(token.trim().to_string())),
            Err(e) => Err(e.to_string()),
        }
    } else {
        Ok(None)
    }
}

pub fn delete_tmdb_token(app: &tauri::AppHandle) -> Result<(), String> {
    let dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    let path = dir.join("tmdb_token.txt");
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn set_anilist_token(token: &str) -> Result<(), String> {
    let entry = keyring::Entry::new("isekast", "anilist_access_token").map_err(|e| e.to_string())?;
    entry.set_password(token).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_anilist_token() -> Result<Option<String>, String> {
    let entry = keyring::Entry::new("isekast", "anilist_access_token").map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn delete_anilist_token() -> Result<(), String> {
    let entry = keyring::Entry::new("isekast", "anilist_access_token").map_err(|e| e.to_string())?;
    let _ = entry.delete_credential();
    Ok(())
}
