# Build prompt — local-first media hub (Tauri)
**How to use this doc:** The `/goal` block right below is the master mission — paste it first so the agent has full context. After that, work through the numbered phases in order, one at a time. Each phase has its own `/goal` line, a hard scope boundary, and acceptance criteria — paste one phase per session/turn rather than the whole document, so the agent can't jump ahead, invent unscoped features, or blend phases together. Do not start Phase N+1 until Phase N's acceptance criteria are met.

**Working title used throughout:** <APP_NAME> — replace with your actual project name before use.

## /goal
Build <APP_NAME>, a cross-platform desktop application (Windows/macOS/Linux) using Tauri v2 that is a unified, local-first media hub for movies, TV shows, anime, and manga. The app has no backend server, no user accounts, and no mandatory cloud dependency. All library data, watch/read progress, settings, and caches live in a local SQLite database on the user's machine. The only external services the app talks to are: (1) metadata providers (TMDB, bring-your-own API key; MangaDex, no key required), and (2) user-installed content extensions (a sandboxed plugin system, not hardcoded scrapers) that resolve streams/chapters from third-party sources. The app ships as a single installable binary per platform, has its own auto-update channel, and extensions update independently through a separate manifest-driven channel so content-source breakage never requires an app release.

### Non-negotiable principles the agent must hold across every phase:
1. **Local-first, not just "offline-capable."** Reads/writes hit local SQLite first; nothing about browsing the library, viewing progress, or reading cached metadata should require a network round-trip. This is not the same as "works offline as a fallback" — local storage is the primary source of truth. *(Reference: Ink & Switch / Kleppmann, "Local-first software: you own your data, in spite of the cloud", 2019.)*
2. **No accounts, no company-run backend.** The user's data belongs to the user. Optional external sync (AniList/Trakt-style) is explicitly out of scope unless a later phase says otherwise.
3. **Bring-your-own-key for anything that needs one.** Only TMDB currently needs a key. MangaDex needs none. Never proxy third-party API keys through infrastructure you run — there is no "you" running infrastructure here.
4. **Secrets go in the OS keychain, not in a config file, not in Stronghold.** A single API token doesn't justify a full encrypted-vault-with-master-password system.
5. **Scrapers are extensions, not app code.** The app ships a generic, sandboxed extension host. It does not ship hardcoded logic for any specific piracy-adjacent streaming or manga site. See "Extension system" and "Important limitation" below — this is a hard boundary, not a style preference.
6. **Two independent update channels.** The app binary updates itself (Tauri updater). Extensions update via a separate JSON manifest feed. A broken scraper should never require waiting on an app release.
7. **Unified content model.** Movies, TV, anime, and manga are rows in one polymorphic schema with a type discriminant — not four parallel, duplicated table sets.

### Important limitation the agent must respect
Do not generate scraper implementations for specific third-party streaming or manga-piracy sites, and do not write code whose purpose is defeating a specific site's anti-bot/anti-scraping protections. This applies in every phase, regardless of how the request is framed (e.g. "as an example extension," "for testing," "the user already has this site's permission"). This is a hard boundary for the coding agent, not a preference.

**What the agent should build instead:**
* The generic extension host, manifest schema, sandbox runtime, and resource-type protocol (see "Extension system" below) — this is infrastructure, not a scraper.
* A small number of extensions against sources that are legitimately open (e.g. an extension for the user's own local files per the "local source" convention below, and/or an extension against MangaDex's public API, which is an authorized, ToS-compliant API).
* Clear extension-authoring docs so the user (or the existing open-source extension communities referenced below) can write and drop in their own source extensions independently of this codebase.
* Treat any actual content-source extensions as something the user sources from existing community extension repositories or writes themselves — not something this build produces.

### Reference projects (patterns to study, not code to copy)
* **HyperionBox / its maintained fork RecomBox:** Rust/Tauri + plugin-over-IPC shape: no local server, plugins resolve sources, Rust drives playback.
* **Seanime:** Extension-based design keeping the core app "clean"; real two-way AniList sync; mediastream module for HLS/transcoding; mpv-based desktop client (Denshi) with ASS/SSA subtitles. Not Tauri (Go+Wails) but the most instructive architecture reference here.
* **Nuvio:** Closest architectural match: no accounts, local-first storage (MMKV), optional Trakt sync, dual extension model (Stremio addons and local JS scraper plugins). Its provider `manifest.json` registry and its sandboxing rule (scraper scripts must be plain Promise-returning functions, no async/await allowed) are directly portable techniques.
* **Stremio addon protocol:** The extension protocol shape to mirror: `manifest.json` + `GET /{resource}/{type}/{id}.json`, resources = catalog, meta, stream, subtitles, idPrefixes for routing.
* **Ryot:** Rust backend, unified schema tracking movies/TV/anime/manga/books/games in one place; BYOK TMDB pattern via a single token setting. Domain-model reference.
* **Suwayomi (formerly Tachidesk):** Manga-specific resource shape (manga → chapters → ordered page images); its local source convention (folder or CBZ per chapter + optional `details.json`) is directly reusable for user-owned files.
* **MangaDex API:** No-key public API for manga search, details, and chapter pages — default manga metadata + content source.
* **VortX:** Thin native UI over a shared Rust engine + real libmpv player instead of a webview `<video>` wrapper — reference for player quality expectations.
* **ID-mapping datasets (manami-project/anime-offline-database, Fribb/anime-lists, nattadasu/animeApi):** Solve the "TMDB doesn't map cleanly onto anime numbering" problem without hand-rolling it — cross-reference AniDB/AniList/MAL IDs to TMDB IDs, including season/episode offset corrections.

---

## Architecture overview (applies to every phase)
```
Desktop app — single Tauri binary
├── Webview UI (React + TypeScript + Vite)
│     - calls Rust exclusively via Tauri commands (invoke), never a local HTTP server
├── Rust core (src-tauri)
│     ├── db/            SQLite access layer (sqlx), migrations, repositories
│     ├── secure/         OS-keychain wrapper (keyring crate) for the TMDB token
│     ├── metadata/       TMDB client, MangaDex client, ID-mapping bridge
│     ├── extensions/     manifest loader, sandboxed JS runtime, resource dispatch
│     ├── player/         mpv sidecar + JSON IPC control channel
│     ├── downloader/     reqwest streaming + ffmpeg sidecar (video), page/CBZ packer (manga)
│     └── commands/       thin Tauri command handlers wiring the above to the frontend
└── Local SQLite store    library, progress, collections, metadata cache, extension registry, settings
        ↑                              ↑                                  ↑
   AniList/MAL/AniDB↔TMDB          MangaDex API                  User-installed extensions
   ID-mapping snapshot           (no key required)          (remote manifest index, sandboxed)
        ↑
     TMDB GraphQL/REST
   (user-supplied BYOK token)
```
No Node/Express backend, no Redis, no Puppeteer/Chromium bundled, no Firebase. Caching lives in SQLite; secrets live in the OS keychain; heavy lifting (scraping, JS challenges) is delegated to sandboxed extensions or a sidecar the user opts into, never bundled by default.

---

## Technical Domain Architecture Specifications

### 1. Domain model (must implement exactly this shape)
Enforce a **Single Table Inheritance (STI)** strategy for the `media_item` table to cleanly map our polymorphic concept without complex joins or sparse table layouts. Use a strict text discriminant column to delineate resource types. Common properties live as native database columns, while polymorphic, type-specific elements reside inside a queryable JSON object column.

* **media_item:**
  * `id` (internal UUID, Primary Key)
  * `type` (TEXT discriminant: `movie` | `tv` | `anime` | `manga`)
  * `external_ids` (TEXT, stored as a JSON map, e.g. `{ "tmdb": 12121, "anilist": 1535, "mal": 1535, "mangadex": "..." }`)
  * `title`, `alt_titles` (TEXT)
  * `overview`, `poster_path`, `backdrop_path` (TEXT, nullable)
  * `genres` (TEXT, comma-separated or JSON array)
  * `status` (TEXT)
  * `source_provider` (TEXT: `tmdb` | `mangadex` | `local`)
  * `metadata` (TEXT, structured queryable JSON block containing type-specific properties that do not require relational indexing)
  * `cached_at`, `stale_after` (DATETIME - used for background cache-invalidation; stale cache must render immediately to guarantee offline speed)

* **Child structures:**
  * **episode / chapter** (polymorphic by parent type): `id` (UUID), `media_item_id` (FK), `number` (REAL), `season_or_volume` (REAL, nullable), `title` (TEXT), `air_or_release_date` (DATETIME, nullable), `thumbnail` (TEXT, nullable)
  * **progress:** `media_item_id` (FK), `episode_or_chapter_id` (FK), `position` (INTEGER - track seconds for video or page number for manga), `completed` (BOOLEAN), `updated_at` (DATETIME)
  * **collection / list:** `id` (UUID), `name` (TEXT), `created_at` (DATETIME) -> managed via a many-to-many join table to `media_item`
  * **extension:** `id` (TEXT, unique slug), `name` (TEXT), `version` (TEXT), `manifest_url` (TEXT), `resource_types` (TEXT, JSON array), `enabled` (BOOLEAN), `last_updated` (DATETIME)
  * **download:** `media_item_id` (FK), `episode_or_chapter_id` (FK), `local_file_path` (TEXT), `status` (TEXT), `size` (INTEGER)

### 2. Metadata strategy
* **Movies/TV/anime → TMDB**, using a token the user pastes in during onboarding (BYOK). Store it via the OS keychain (see Phase 2). Cache every response in SQLite with a TTL; the UI must never block on a live TMDB call for content already cached.
* **Manga → MangaDex public API**, no key. Respect MangaDex's usage policy: credit MangaDex and the scanlation group per chapter, no ads anywhere in the app.
* **Anime ID reconciliation:** TMDB's season/episode numbering does not reliably match how anime is actually released (absolute numbering, split-cours, filler, OVAs folded inconsistently). Bundle or periodically sync a snapshot of one of the ID-mapping datasets referenced above to bridge extension-sourced anime IDs (AniList/MAL/AniDB) to TMDB IDs, including any season/episode offset corrections the dataset provides. This mapping is a local lookup table, refreshed on a schedule the user controls — not a live dependency.

### 3. Extension system (the core architectural investment)
* **Manifest-driven.** Each extension ships a `manifest.json`: id, name, version, types (which of movie/tv/anime/manga it covers), resources (which of catalog, meta, stream, chapters, subtitles it implements), entry script reference, and permissions it needs (network only — no filesystem/process access).
* **Resource protocol mirrors Stremio's shape, extended with a manga resource:**
  * `catalog` — listing/search results
  * `meta` — detailed info for one item
  * `stream` — resolved video stream(s) for an episode/movie
  * `chapters` — ordered chapter list for manga; each chapter resolves to an ordered list of page image URLs
  * `subtitles` — optional, for video
* **Sandboxed execution.** Extension scripts run inside an embedded JS engine (`rquickjs`), not the webview and not a general Node/Deno runtime. Enforce Nuvio's rule: extension code must return plain Promises from a small, host-provided API surface (a restricted fetch-like function). 
  * *Sandbox Runtime Constraint:* The `rquickjs` environment must not spawn an unbounded macro-task loop. The host-provided sandboxed `fetch` token must be bound directly to a native Rust `tokio` async request future. When the JS context yields a Promise via a basic `.then()` architecture, the native Rust core resolves the future. Explicitly disallow native JS `async/await` keyword parsing inside the extension scripts to eliminate the necessity of managing a complex, multi-threaded JavaScript event loop inside the native Rust runtime. This strictly bounds what an extension can do.
* **Two update paths, kept separate:**
  * The app binary updates via `tauri-plugin-updater`.
  * Extensions update via a separate remote JSON index (a list of extension manifests + versions) that the app polls independently. Updating a broken source should never require shipping a new app version.
* **Local source extension (built-in, always available):** scans a user-chosen folder using the Suwayomi-style convention — one folder per title, one subfolder or CBZ/ZIP per chapter (manga) or per episode file (video), with an optional `details.json` for title/author/genre metadata when present. This is what lets downloads and user-owned files reappear as first-class library entries with no scraping involved.

### 4. Anti-bot fallback chain, tried in order and never bundled by default:
1. Plain `reqwest` request.
2. If a JS challenge is detected, a hidden Tauri webview window solves it and hands cookies/tokens back to the Rust HTTP client.
3. If still blocked, defer to a user-supplied external solver endpoint (e.g. a self-hosted FlareSolverr instance) configured in settings — never bundle a headless Chromium binary with the app.

### 5. Secure storage
Use the `keyring` Rust crate to store the TMDB token in the platform-native secure store (macOS Keychain, Windows Credential Manager, Linux Secret Service). Do not use `tauri-plugin-stronghold` for this — Stronghold is a full encrypted vault requiring a master password, which is the wrong shape for a single token and just moves the "where do I store the password" problem up a level.

Everything else (settings, cache, library) lives in the plain local SQLite database — no need to encrypt data that isn't a credential.

### 6. Player & reader
* **Video:** `mpv`, run as a Tauri sidecar process, controlled over mpv's native JSON IPC (`--input-ipc-server`) for play/pause/seek/track-switching/subtitle control. This gets proper ASS/SSA subtitle rendering and audio-track switching that a webview `<video>` + HLS.js setup can't match. Keep an HLS.js-in-webview fallback only for sources mpv can't handle.
  * *Sidecar Invocation Constraint:* When initializing the `mpv` sidecar command via `tauri_plugin_shell::ShellExt`, use **only** the configured short generic string identifier (`"mpv"`). The agent must never attempt to programmatically append or hardcode host target triplets (e.g., `-x86_64-pc-windows-msvc`) to the binary name within the Rust source code. Ensure cross-platform compilation properties are handled outside of source files via the target maps in `tauri.conf.json`.
* **Manga:** paginated reader and continuous/webtoon-scroll reader modes, adjustable reading direction (LTR/RTL), chapter prefetching, and page-level caching.
  * *UI Canvas Virtualization:* The continuous/webtoon scroll reader component on the React frontend must utilize a strict UI virtualization layer (such as `@tanstack/react-virtual` or `react-window`). Images outside of the immediate viewport must be unmounted dynamically or replaced with lightweight layout placeholders to prevent DOM memory bloat and layout thrashing inside the webview engine.

### 7. Downloads
* **Video:** `reqwest` streaming download, with `ffmpeg` as a Tauri sidecar for HLS→MP4 muxing when needed.
  * *Sidecar Invocation Constraint:* When initializing the `ffmpeg` sidecar command via `tauri_plugin_shell::ShellExt`, use **only** the configured short generic string identifier (`"ffmpeg"`). Never programmatically append or hardcode host target triplets to the binary name within the Rust source code.
* **Manga:** page images downloaded and packaged as CBZ (or a plain folder), written out in the same layout the "local source" extension already knows how to read — so a completed download is immediately a library item with no separate code path.
* A single download queue/manager handles both, with pause/resume and a user-configurable storage location.

### 8. Explicitly out of scope (unless a later phase revisits this)
* User accounts / login of any kind.
* Any backend server component (no Express, no Redis, no hosted API).
* Bundled headless Chromium/Puppeteer.
* Live external sync (AniList/Trakt) — the app is account-free by default; this could be a genuinely optional, clearly-labeled future add-on, not a default dependency.
* Any hardcoded scraper for a specific third-party site (see "Important limitation" above).

---

## Anti-hallucination rules for the coding agent
1. **Stay inside the current phase.** Do not implement functionality from a later phase even if it seems convenient or related. If something from a later phase is a hard prerequisite, stop and say so instead of building ahead.
2. **Don't invent crate APIs, TMDB/MangaDex endpoint shapes, or CLI flags from memory if uncertain** — verify first (docs lookup or web search), and say explicitly when something was verified versus assumed.
3. **Don't fabricate scraper targets, site names, or bypass techniques** — see "Important limitation" above.
4. **If a dependency's exact version/API has likely changed since training data**, say so and check current docs rather than guessing.
5. **Prefer leaving a clearly-marked stub or TODO with a described interface** over guessing at an implementation you're not confident in.
6. **Ask before making an architectural decision not already specified in this document** (e.g. exact SQLite schema column types, exact IPC message shapes) rather than silently picking one and moving on.
7. **Every phase ends with the stated acceptance criteria being genuinely testable/verified** — not just "code written."

---

## Phases of Execution

### Phase 0 — Project scaffolding
**/goal:** Stand up an empty, compiling, running Tauri v2 project with the module structure and runtime permission definitions this whole build will live in — no feature logic yet.

* **Scope:**
  * Initialize the project setup using React + TypeScript + Vite frontend.
  * Explicitly configure and scaffold the initial `src-tauri/capabilities/default.json` capability file, granting explicit runtime permission for core frontend-to-backend IPC commands and staging permissions for `tauri-plugin-shell` (needed for the sidecars later).
  * `src-tauri` module skeleton: `db/`, `secure/`, `metadata/`, `extensions/`, `player/`, `downloader/`, `commands/` — empty modules with placeholder types/functions that compile.
  * Core dependencies added to `Cargo.toml`: `tokio`, `reqwest`, `serde`/`serde_json`, `sqlx` (sqlite feature), `keyring`, `rquickjs`, `tauri-plugin-shell`, `tauri-plugin-updater`.
  * Basic window chrome, no real UI yet beyond a placeholder screen.
* **Out of scope:** no database schema yet, no network calls, no extension logic, no player.
* **Acceptance criteria:** `tauri dev` runs on the current platform; the app window opens; the Rust workspace compiles with the module skeleton in place; runtime capabilities compile without permissions blockages; no unused-dependency warnings for anything not yet wired up (remove until needed, or explicitly note it's staged for a later phase).

### Phase 1 — Local data layer & domain model
**/goal:** Implement the unified Single Table Inheritance (STI) `media_item` schema and supporting tables from the "Domain model" section, with a working repository layer exposed to the frontend via Tauri commands.

* **Scope:** 
  * SQLite migrations for `media_item` (with its text type discriminant and structured `metadata` JSON text column), `episode_or_chapter`, `progress`, `collection`, `extension`, `download`, plus a settings key-value table for non-secret preferences.
  * Rust repository/query layer over `sqlx`.
  * Tauri commands for basic CRUD (create/list/get/update) on `media_item` and `progress`.
  * A minimal frontend screen that lists whatever's in the local library (empty at this point) to prove the IPC round trip works.
* **Out of scope:** no TMDB/MangaDex integration yet — seed test data manually or via a fixture script if needed to verify the UI round-trip.
* **Acceptance criteria:** app can be fully closed and reopened with data intact; library browsing works with the network disabled; schema matches the specified STI model exactly, leveraging the JSON metadata block cleanly.

### Phase 2 — Secure key storage & TMDB integration
**/goal:** Let the user securely store a TMDB token and fetch/cache real movie/TV metadata through it.

* **Scope:** 
  * `secure/` module wrapping the `keyring` crate for set/get/delete of the TMDB token (never Stronghold, never plaintext).
  * Onboarding UI screen to paste the token, with a validation call against a TMDB endpoint before saving.
  * `metadata/tmdb.rs` client covering search, details, images, credits.
  * Every TMDB response gets cached into `media_item`/related tables with a TTL; repeated views/searches read from cache first. Basic rate-limit/backoff handling.
* **Out of scope:** no anime ID-reconciliation yet (treat TMDB anime entries as regular TV entries for now), no manga.
* **Acceptance criteria:** token round-trips through the OS keychain (verify it survives an app restart and is retrievable via the platform's native credential tool, not just your own code); searching/browsing movies and TV populates and persists local cache; browsing previously-viewed titles works with network disabled.

### Phase 3 — Manga metadata (MangaDex)
**/goal:** Add manga search/details/chapter-listing via the MangaDex public API, no key required.

* **Scope:** 
  * `metadata/mangadex.rs` client for search, manga details, and chapter feed/page-URL resolution.
  * Manga results populate `media_item` with `type = manga`, `source_provider = mangadex`.
  * Attribution UI element crediting MangaDex and the scanlation group per chapter, per their usage policy.
* **Out of scope:** no reading UI yet (that's Phase 8) — this phase is metadata + chapter listing only.
* **Acceptance criteria:** manga search/details/chapter-list work with no key configured; cached manga metadata browses offline like movies/TV do.

### Phase 4 — Anime/TV cross-ID mapping bridge
**/goal:** Build the local lookup table that reconciles AniList/MAL/AniDB IDs against TMDB IDs, including episode offset corrections.

* **Scope:** 
  * Ingest a snapshot of one of the referenced ID-mapping datasets (pick one explicitly and document why) into a local lookup table.
  * Expose a Rust function that, given an AniList/MAL/AniDB ID (as will later come from extensions), resolves the corresponding TMDB ID and any season/episode offset.
  * Add a scheduled/manual refresh path for this snapshot.
* **Out of scope:** no extension system yet to actually feed it IDs — test this phase with fixture inputs.
* **Acceptance criteria:** given a handful of known tricky cases (split-cours show, a show with absolute vs. seasonal numbering), the lookup returns correct TMDB mappings; refreshing the snapshot works without requiring an app update.

### Phase 5 — Extension host & sandbox
**/goal:** Build the generic, sandboxed extension host and manifest system described in "Extension system" — the plugin infrastructure itself, not any specific content-source extension.

* **Scope:** 
  * Manifest schema + loader; `rquickjs`-based sandboxed runtime enforcing the host-provided tokio-fetch promise mapping. Ensure native JS `async/await` keyword tokens are disallowed during evaluation to maintain strict host event-loop isolation.
  * Resource dispatch for catalog/meta/stream/chapters/subtitles; local extension registry in SQLite; remote manifest-index polling for extension updates (separate from the app updater).
  * The built-in local source extension implementing the Suwayomi-style folder/CBZ + `details.json` convention.
* **Out of scope:** do not write any extension targeting a specific third-party streaming or manga site (see "Important limitation"). Test the host using the local-source extension and/or a trivial fixture extension that serves fake in-memory data.
* **Acceptance criteria:** a fixture extension can be installed, enabled, and queried through all implemented resource types; a scraper attempting async/await syntax parsing or ambient filesystem access is cleanly rejected by the sandbox execution layer; the local-source extension correctly surfaces a manually-created test folder as library content; extension updates apply without requiring a full application reinstall.

### Phase 6 — Anti-bot fallback chain
**/goal:** Implement the three-tier fallback described in "Extension system" for extensions that hit JS-challenge-protected sources, as infrastructure the extension host can invoke — not tied to any specific site.

* **Scope:** plain `reqwest` path; hidden-webview JS-challenge solver path that returns cookies/tokens to the Rust HTTP client; settings UI for an optional user-supplied external solver endpoint. Clear UI messaging when a source fails through all three tiers.
* **Out of scope:** no bundled Chromium/Puppeteer, ever.
* **Acceptance criteria:** the fallback chain is invokable by extension code through the host API in a generic way; failure at each tier surfaces a distinct, user-visible error state.

### Phase 7 — Video player
**/goal:** Real mpv-backed playback, controlled from Rust.

* **Scope:** 
  * `mpv` as a Tauri sidecar invoked via its generic short name identifier (`"mpv"`) with zero platform triplets in source code.
  * JSON IPC control channel for play/pause/seek/track-switch; ASS/SSA subtitle rendering; audio-track switching.
  * Progress reporting back into the progress table on an interval and on pause/close.
  * `HLS.js`-in-webview fallback path for streams mpv can't handle, clearly marked as a fallback.
* **Out of scope:** downloads (Phase 9).
* **Acceptance criteria:** playback works end-to-end from a stream resource resolved by the fixture/local-source extension; subtitles render correctly for an ASS test file; progress persists and resumes correctly after quitting mid-episode.

### Phase 8 — Manga reader
**/goal:** Reading UI for manga chapters resolved via the chapters resource type.

* **Scope:** 
  * Paginated reader mode, continuous/webtoon scroll mode.
  * Integrate a DOM virtualization engine (`@tanstack/react-virtual` or `react-window`) within the continuous scroll stream canvas to isolate memory layout profiles from the platform webview.
  * Reading-direction setting, chapter prefetch and page caching, progress tracking by page/chapter into the progress table.
* **Acceptance criteria:** a manga sourced from MangaDex and one sourced from the local-source extension both read correctly through the same UI; progress resumes at the correct page after restart; loading a massive multi-page webtoon chapter shows clean layout pooling with virtualized element mounts.

### Phase 9 — Downloads
**/goal:** Offline download support for both video and manga, using the local-source layout as the storage convention.

* **Scope:** 
  * Download queue/manager.
  * `reqwest` streaming + `ffmpeg` sidecar muxing for video (invoking `"ffmpeg"` cleanly by abstract target mappings).
  * Page-image download + CBZ/folder packaging for manga; pause/resume; configurable storage location.
  * Completed downloads automatically surfaced by the local-source extension with no separate library code path.
* **Acceptance criteria:** a downloaded episode and a downloaded chapter both appear as ordinary library items when offline; pausing and resuming a download doesn't corrupt output; deleting a download removes it from the library.

### Phase 10 — Library, progress, and collections polish
**/goal:** Round out library-management UX: continue watching/reading, mark as watched/read, custom collections, and a local export/import of the whole library.

* **Scope:** continue-watching/reading rows on a home screen; manual mark-as-complete; user-defined collections (many-to-many); a JSON export/import of the entire local library (this is the local-first "own your data" escape hatch — not a sync mechanism).
* **Out of scope:** any live external sync (AniList/Trakt) stays out of scope per the principles section unless explicitly requested as new work later.
* **Acceptance criteria:** export → wipe local DB → import round-trips the full library and progress state exactly.

### Phase 11 — App-level polish & update mechanism
**/goal:** Wire up the two independent update channels, capabilities checks, and finish settings/onboarding.

* **Scope:** 
  * `tauri-plugin-updater` wired to a real release channel for the app binary.
  * The separate extension-manifest update check from Phase 5 exposed in a settings UI with per-extension update/enable/disable.
  * TMDB key management screen (add/replace/remove, backed by the Phase 2 keychain wrapper).
  * First-run legal/disclaimer screen stating the app does not host content and the user is responsible for their own use of any installed extensions.
* **Acceptance criteria:** app update and extension update can each be triggered and verified independently of the other; removing the TMDB key from settings actually clears it from the OS keychain, not just the UI state.

### Phase 12 — Packaging & QA pass
**/goal:** Ship-ready builds for Windows/macOS/Linux with a local-first verification pass.

* **Scope:** Tauri bundler configuration for all three targets; an explicit offline QA pass (airplane mode: confirm library browsing, cached metadata, downloaded content, and playback of downloaded content all work with zero network); confirm no telemetry or unexpected network calls beyond the declared providers (TMDB, MangaDex, extension manifest index, extension-declared endpoints) — a network log review, not just a code read-through.
* **Acceptance criteria:** installers/binaries build clean for all three platforms; the offline QA checklist passes in full; a network capture during a full offline-library session shows zero unexpected outbound requests.

# FEATURE INJECTION: Scalable Multi-Theme Architecture, Routing & UI Overhaul

Your backend, native Rust IPC commands, and local SQLite data layers are verified and functional. Your new objective is to perform a comprehensive UI/UX overhaul of the React frontend, implementing a scalable multi-theme architecture, proper navigation routing, and designing the core layouts.

You must strictly adhere to the `.agents/project-rules.md` file. Specifically: **Zero hardcoded styling, and strict adherence to Tailwind CSS variables.** Build components using raw Tailwind CSS, `clsx`, `tailwind-merge`, and Headless UI / Radix primitives (the `shadcn/ui` pattern).

## Step 1: Tailwind Multi-Theme System Configuration
Implement a data-attribute-driven theme system. 
1. **Update `tailwind.config.ts`:** Map core colors to CSS variables (e.g., `background: "hsl(var(--background))"`).
2. **Global CSS (`src/index.css`):** Create the default theme (`:root`) and define the `[data-theme="dracula"]`, `[data-theme="nord"]`, and `[data-theme="rose"]` attributes using raw HSL values for deep-dark, glassmorphic aesthetics.
3. **Theme Switcher Context:** Create a `ThemeProvider` context in React that manages the theme state (persisted to SQLite) and applies the `data-theme` attribute to the document root.

## Step 2: Implement Core Navigation (CRITICAL)
Currently, all components are dumped onto a single screen. You must fix this:
1. Implement a client-side router (e.g., `react-router-dom` or a robust state-based tab system).
2. Create a persistent **Left Navigation Sidebar**. This sidebar must have distinct tabs/links for: **Library**, **Discover**, **Extensions**, and **Settings**.
3. The main content area to the right of the sidebar will render the active page.

## Step 3: Tab-by-Tab Layout Execution
Execute the following layouts for each main section.

### 1. Search & Discovery (The Command Palette)
* **Execution:** Build a global, centralized Command Palette modal triggered via `Ctrl+K` or a search button in the Discover tab. When opened, blur the background app (`backdrop-blur-md bg-background/80`). 

### 2. Local Library & Dashboard
* **Execution:** 
  * **Top Row:** A horizontal scrolling "Continue Watching/Reading" section with 16:9 thumbnails and a primary-colored progress bar.
  * **Grid View:** A dense grid of posters. Apply `hover:scale-105` and show a primary-colored "Play/Read" icon strictly on hover.

### 3. Anime, Movie, & TV Details Page
* **Execution:** 
  * **Hero Banner:** Edge-to-edge backdrop image with a gradient overlay.
  * **Metadata Split:** Poster overlaps the banner on the left. Title, description, and pill-shaped tags (`bg-secondary text-secondary-foreground rounded-full px-3 py-1`) on the right.
  * **Episodes List:** Clean vertical scroll area below the fold.

### 4. Manga Reader
* **Execution:** 
  * **Canvas:** Pitch black background (`bg-black`).
  * **Overlays:** Glassmorphic Top/Bottom nav bars that fade out when clicking the center.
  * **Controls:** Right-side slide-out drawer for reader settings (Webtoon vs. Paginated, LTR vs. RTL).

### 5. Settings & Extensions Tab
* **Execution:** 
  * **Appearance Pane:** Add a UI element utilizing the `useTheme` hook to toggle between themes.
  * **Extensions Grid:** Display installed extensions as modular cards with toggle switches.
  * **Security:** Mask the TMDB API key input. Include a dynamic status indicator for the OS Keychain.

### 6. Media Player Overlay (Video)
* **Execution:** Since the native `mpv` sidecar handles rendering, build the React UI as a transparent overlay layer strictly for controls (bottom bar, subtitle toggle), disappearing after 3 seconds of inactivity.

## Step 4: Verification
Run `npm run build` frequently. Update `AGENT_STATE.md` with a new `[ ] Phase 13: UI Overhaul` checkbox, and check it off only when the routing is in place and all layouts are styled and mapped to dynamic CSS variables.