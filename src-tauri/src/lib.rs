use tauri::Manager;

pub mod commands;
pub mod db;
pub mod downloader;
pub mod extensions;
pub mod metadata;
pub mod player;
pub mod secure;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                let db = db::Database::init(&handle)
                    .await
                    .expect("Failed to init DB");
                handle.manage(db);
                handle.manage(downloader::AntibotState::new());
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_media_items,
            commands::save_tmdb_token,
            commands::get_tmdb_token_status,
            commands::delete_tmdb_token,
            commands::search_tmdb,
            commands::search_mangadex,
            commands::map_anime_ids,
            commands::run_extension,
            commands::submit_cloudflare_bypass_result,
            commands::download_media,
            commands::update_media_progress,
            commands::get_media_progress
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
