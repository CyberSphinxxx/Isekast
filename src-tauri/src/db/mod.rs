pub mod repository;

use sqlx::{sqlite::SqliteConnectOptions, SqlitePool};
use std::str::FromStr;
use tauri::AppHandle;
use tauri::Manager;

#[derive(Clone)]
pub struct Database {
    pub pool: SqlitePool,
}

impl Database {
    pub async fn init(app: &AppHandle) -> Result<Self, String> {
        let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;

        std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
        let db_path = app_dir.join("library.sqlite");

        let options =
            SqliteConnectOptions::from_str(&format!("sqlite://{}", db_path.to_string_lossy()))
                .map_err(|e| e.to_string())?
                .create_if_missing(true);

        let pool = SqlitePool::connect_with(options)
            .await
            .map_err(|e| e.to_string())?;

        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .map_err(|e| e.to_string())?;

        Ok(Self { pool })
    }
}
