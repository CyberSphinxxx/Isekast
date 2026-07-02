use keyring::Entry;

const SERVICE_NAME: &str = "isekast-tmdb-token";
const USER_NAME: &str = "default";

pub fn set_tmdb_token(token: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, USER_NAME).map_err(|e| e.to_string())?;
    entry.set_password(token).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_tmdb_token() -> Result<Option<String>, String> {
    let entry = Entry::new(SERVICE_NAME, USER_NAME).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn delete_tmdb_token() -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, USER_NAME).map_err(|e| e.to_string())?;
    entry.delete_credential().map_err(|e| e.to_string())?;
    Ok(())
}
