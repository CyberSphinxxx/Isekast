CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE media_item (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    external_ids TEXT,
    title TEXT NOT NULL,
    alt_titles TEXT,
    overview TEXT,
    poster_path TEXT,
    backdrop_path TEXT,
    genres TEXT,
    status TEXT,
    source_provider TEXT,
    metadata TEXT,
    cached_at DATETIME,
    stale_after DATETIME
);

CREATE TABLE episode_or_chapter (
    id TEXT PRIMARY KEY,
    media_item_id TEXT NOT NULL,
    number REAL NOT NULL,
    season_or_volume REAL,
    title TEXT,
    air_or_release_date DATETIME,
    thumbnail TEXT,
    FOREIGN KEY(media_item_id) REFERENCES media_item(id) ON DELETE CASCADE
);

CREATE TABLE progress (
    media_item_id TEXT NOT NULL,
    episode_or_chapter_id TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    completed BOOLEAN NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY(media_item_id, episode_or_chapter_id),
    FOREIGN KEY(media_item_id) REFERENCES media_item(id) ON DELETE CASCADE,
    FOREIGN KEY(episode_or_chapter_id) REFERENCES episode_or_chapter(id) ON DELETE CASCADE
);

CREATE TABLE collection (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at DATETIME NOT NULL
);

CREATE TABLE media_item_collection (
    media_item_id TEXT NOT NULL,
    collection_id TEXT NOT NULL,
    PRIMARY KEY(media_item_id, collection_id),
    FOREIGN KEY(media_item_id) REFERENCES media_item(id) ON DELETE CASCADE,
    FOREIGN KEY(collection_id) REFERENCES collection(id) ON DELETE CASCADE
);

CREATE TABLE extension (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    manifest_url TEXT,
    resource_types TEXT,
    enabled BOOLEAN NOT NULL DEFAULT 0,
    last_updated DATETIME
);

CREATE TABLE download (
    media_item_id TEXT NOT NULL,
    episode_or_chapter_id TEXT,
    local_file_path TEXT NOT NULL,
    status TEXT NOT NULL,
    size INTEGER,
    PRIMARY KEY(media_item_id, episode_or_chapter_id),
    FOREIGN KEY(media_item_id) REFERENCES media_item(id) ON DELETE CASCADE,
    FOREIGN KEY(episode_or_chapter_id) REFERENCES episode_or_chapter(id) ON DELETE CASCADE
);
