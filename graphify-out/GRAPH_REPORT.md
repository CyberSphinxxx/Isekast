# Graph Report - Isekast  (2026-07-03)

## Corpus Check
- 62 files · ~52,472 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 524 nodes · 621 edges · 47 communities (39 shown, 8 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2e61d2b5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 40|Community 40]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `String` - 15 edges
3. `Result` - 14 edges
4. `Phases of Execution` - 14 edges
5. `definitions` - 11 edges
6. `definitions` - 11 edges
7. `What You Must Do When Invoked` - 11 edges
8. `String` - 10 edges
9. `/graphify` - 10 edges
10. `MediaItem` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Settings()` --calls--> `useTheme()`  [EXTRACTED]
  src/pages/Settings.tsx → src/components/ThemeProvider.tsx

## Import Cycles
- 1-file cycle: `src-tauri/src/db/mod.rs -> src-tauri/src/db/mod.rs`
- 1-file cycle: `src-tauri/src/downloader/mod.rs -> src-tauri/src/downloader/mod.rs`
- 1-file cycle: `src-tauri/src/metadata/mangadex.rs -> src-tauri/src/metadata/mangadex.rs`

## Communities (47 total, 8 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (41): description, properties, required, type, Capability, Identifier, default, description (+33 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (41): description, properties, required, type, Capability, Identifier, default, description (+33 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (19): CommandPalette(), Layout(), MangaReaderProps, initialState, Theme, ThemeProvider(), ThemeProviderContext, ThemeProviderProps (+11 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (34): dependencies, clsx, hls.js, lucide-react, @radix-ui/react-dialog, @radix-ui/react-scroll-area, @radix-ui/react-slot, @radix-ui/react-tabs (+26 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (34): anyOf, anyOf, description, description, properties, required, type, definitions (+26 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (34): anyOf, anyOf, description, description, properties, required, type, definitions (+26 more)

### Community 6 - "Community 6"
Cohesion: 0.06
Nodes (30): 1. Domain model (must implement exactly this shape), 2. Metadata strategy, 3. Extension system (the core architectural investment), 4. Anti-bot fallback chain, tried in order and never bundled by default:, 5. Secure storage, 6. Player & reader, 7. Downloads, 8. Explicitly out of scope (unless a later phase revisits this) (+22 more)

### Community 7 - "Community 7"
Cohesion: 0.25
Nodes (25): AntibotState, delete_tmdb_token(), download_media(), get_media_items(), get_media_progress(), get_popular_manga(), get_tmdb_token_status(), get_trending_anime() (+17 more)

### Community 8 - "Community 8"
Cohesion: 0.08
Nodes (23): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+15 more)

### Community 9 - "Community 9"
Cohesion: 0.10
Nodes (20): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+12 more)

### Community 10 - "Community 10"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+10 more)

### Community 11 - "Community 11"
Cohesion: 0.35
Nodes (7): Database, MediaItem, MediaProgress, Option, Result, String, Vec

### Community 12 - "Community 12"
Cohesion: 0.24
Nodes (12): HashMap, MangaDexAttributes, MangaDexManga, get_popular_manga(), MangaDexAttributes, MangaDexManga, MangaDexSearchResponse, search() (+4 more)

### Community 13 - "Community 13"
Cohesion: 0.23
Nodes (11): AniListData, AniListMedia, AniListData, AniListMedia, AniListResponse, get_anilist_mapping(), GraphQLQuery, Option (+3 more)

### Community 14 - "Community 14"
Cohesion: 0.27
Nodes (10): Arc, DashMap, AntibotState, download_to_disk(), fetch_with_webview(), Sender, AppHandle, Result (+2 more)

### Community 15 - "Community 15"
Cohesion: 0.18
Nodes (11): 1. Search & Discovery (The Command Palette), 2. Local Library & Dashboard, 3. Anime, Movie, & TV Details Page, 4. Manga Reader, 5. Settings & Extensions Tab, 6. Media Player Overlay (Video), FEATURE INJECTION: Scalable Multi-Theme Architecture, Routing & UI Overhaul, Step 1: Tailwind Multi-Theme System Configuration (+3 more)

### Community 16 - "Community 16"
Cohesion: 0.33
Nodes (10): get_trending(), get_trending_anime(), search(), TmdbResult, TmdbSearchResponse, Option, Result, String (+2 more)

### Community 17 - "Community 17"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 18 - "Community 18"
Cohesion: 0.29
Nodes (6): Database, SqlitePool, AppHandle, Result, Self, String

### Community 19 - "Community 19"
Cohesion: 0.46
Nodes (7): delete_tmdb_token(), get_tmdb_token(), set_tmdb_token(), AppHandle, Option, Result, String

### Community 20 - "Community 20"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 21 - "Community 21"
Cohesion: 0.33
Nodes (5): 1. Architectural Hard Boundaries, 2. Technical Stack & Rust Rules, 3. Developer Quality of Life (QoL) & UI Best Practices, 4. Anti-Hallucination Guardrails, SYSTEM LAWS: Isekast

### Community 22 - "Community 22"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 23 - "Community 23"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 24 - "Community 24"
Cohesion: 0.50
Nodes (3): execute_scraper(), Result, String

### Community 25 - "Community 25"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 26 - "Community 26"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 27 - "Community 27"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

## Knowledge Gaps
- **280 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+275 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `definitions` connect `Community 4` to `Community 0`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `definitions` connect `Community 5` to `Community 1`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _280 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05121951219512195 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05121951219512195 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07681365576102418 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._