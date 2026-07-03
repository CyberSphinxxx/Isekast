CREATE TABLE IF NOT EXISTS stremio_addons (
    id TEXT PRIMARY KEY,
    transport_url TEXT NOT NULL,
    manifest_json TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT 1
);
