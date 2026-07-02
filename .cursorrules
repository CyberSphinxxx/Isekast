# SYSTEM LAWS: Isekast

You are building Isekast, a Tauri v2 application. You must strictly adhere to the following architectural and stylistic laws on every turn. If a user request contradicts these laws, you must refuse the request and explain why.

## 1. Architectural Hard Boundaries
* **NO BACKEND SERVER:** You are forbidden from creating Node.js, Express, Python, or Go web servers. All backend logic must reside in Rust (`src-tauri`).
* **NO CLOUD DATABASE:** All data, progress, and caching MUST be written to a local SQLite file via `sqlx`. Do not use Firebase, Supabase, or Redis.
* **NO BUNDLED BROWSERS:** You are forbidden from importing or bundling Puppeteer, Playwright, or headless Chromium. 
* **NO HARDCODED SCRAPERS:** You must never write code targeting a specific streaming or manga piracy site. All content resolution is handled via the Sandboxed Extension System.

## 2. Technical Stack & Rust Rules
* **Frontend:** React, TypeScript, Vite, Tailwind CSS.
* **Backend:** Rust, Tauri v2.
* **Commands:** The frontend communicates with Rust EXCLUSIVELY via Tauri `invoke()`. Do not use `fetch()` or `axios` to talk to local Rust services.
* **Database:** Enforce Single Table Inheritance (STI) for the `media_item` table. Use a `type` string discriminant.
* **Capabilities:** Tauri v2 requires explicit capabilities. If you add a command or a sidecar, you MUST update `src-tauri/capabilities/default.json`.
* **Sidecars:** When invoking `mpv` or `ffmpeg` via `tauri-plugin-shell`, use ONLY the abstract short name (`"mpv"`). Never hardcode OS triplets (e.g., `-x86_64-pc-windows-msvc`) in Rust code.
* **Rust Error Handling:** Never `unwrap()` or `expect()` in production code. Always return a `Result<T, String>` to the Tauri frontend so the UI can handle the error gracefully.

## 3. Developer Quality of Life (QoL) & UI Best Practices
* **Zero Hardcoded Styling:** You are forbidden from using arbitrary hex codes, hardcoded pixel values, or inline styles (e.g., `style={{ color: '#ff0000' }}`). 
* **Strict Theme System:** All styling must map to a centralized theme using Tailwind CSS utility classes and CSS variables defined in `tailwind.config.ts` and `index.css`. (e.g., use `bg-background-primary`, `text-accent`, `p-4`).
* **Component Architecture:** Maintain a strict separation of concerns. Keep UI components "dumb" (presentation only) and handle state/business logic in custom hooks or container components.
* **Strict Typing:** No `any` types in TypeScript. Define strict interfaces for all API responses, IPC payloads, and component props.
* **Responsive & Accessible:** Ensure all UI elements are fully keyboard navigable and responsive to window resizing.

## 4. Anti-Hallucination Guardrails
* **Verify, Don't Guess:** If you are unsure of a Rust crate's API or a Tauri v2 specific syntax, you must read the official documentation or search the web before writing the code.
* **Stop on Failure:** If a terminal command (like `cargo check` or `npm run build`) fails 3 times in a row, DO NOT keep guessing. Stop execution and ask the human for help.
* **No Speculative Files:** Only create files and write code that are strictly required for the current phase defined in `AGENT_STATE.md`.
