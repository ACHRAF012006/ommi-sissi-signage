CREATE TABLE users (
 id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'admin',
 created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE stores (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, code TEXT NOT NULL UNIQUE COLLATE NOCASE,
 address TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', timezone TEXT NOT NULL DEFAULT 'Africa/Tunis',
 enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)), closed_screen_enabled INTEGER NOT NULL DEFAULT 1 CHECK(closed_screen_enabled IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE store_hours (
 id INTEGER PRIMARY KEY, store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
 day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6), is_closed INTEGER NOT NULL DEFAULT 0 CHECK(is_closed IN (0,1)),
 opening_time TEXT NOT NULL DEFAULT '09:00', closing_time TEXT NOT NULL DEFAULT '20:00', UNIQUE(store_id,day_of_week)
);
CREATE TABLE store_exceptions (
 id INTEGER PRIMARY KEY, store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
 date TEXT NOT NULL, is_closed INTEGER NOT NULL DEFAULT 1, opening_time TEXT, closing_time TEXT, label TEXT NOT NULL DEFAULT '', UNIQUE(store_id,date)
);
CREATE TABLE playlists (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE display_groups (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
 playlist_id INTEGER REFERENCES playlists(id) ON DELETE SET NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE store_group_overrides (
 store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
 group_id INTEGER NOT NULL REFERENCES display_groups(id) ON DELETE CASCADE,
 playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE, PRIMARY KEY(store_id,group_id)
);
CREATE TABLE media (
 id INTEGER PRIMARY KEY, original_filename TEXT NOT NULL, stored_filename TEXT NOT NULL UNIQUE,
 type TEXT NOT NULL CHECK(type IN ('image','video')), mime_type TEXT NOT NULL, size INTEGER NOT NULL,
 width INTEGER, height INTEGER, video_duration REAL, thumbnail_filename TEXT,
 title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE playlist_items (
 id INTEGER PRIMARY KEY, playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
 media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE RESTRICT, sort_order INTEGER NOT NULL,
 image_duration_seconds REAL NOT NULL DEFAULT 8 CHECK(image_duration_seconds BETWEEN 1 AND 3600),
 enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)), fit TEXT NOT NULL DEFAULT 'contain' CHECK(fit IN ('contain','cover')),
 start_date TEXT, end_date TEXT, start_time TEXT, end_time TEXT
);
CREATE TABLE displays (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
 group_id INTEGER NOT NULL REFERENCES display_groups(id) ON DELETE CASCADE,
 unique_identifier TEXT NOT NULL UNIQUE, token_hash TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
 last_seen TEXT, browser_info TEXT NOT NULL DEFAULT '', ip_address TEXT NOT NULL DEFAULT '',
 current_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE sessions (sid TEXT PRIMARY KEY, expires INTEGER NOT NULL, data TEXT NOT NULL);
CREATE INDEX sessions_expiry ON sessions(expires);
CREATE INDEX displays_store ON displays(store_id);
CREATE INDEX displays_group ON displays(group_id);
CREATE INDEX displays_last_seen ON displays(last_seen);
CREATE INDEX playlist_items_order ON playlist_items(playlist_id,sort_order);
CREATE INDEX playlist_items_media ON playlist_items(media_id);
INSERT INTO settings(key,value) VALUES ('company_name','OMMI SISSI');
