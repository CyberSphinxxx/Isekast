/**
 * Isekast Source Extension Boilerplate
 * 
 * IMPORTANT SANDBOX RULES:
 * 1. NO ASYNC/AWAIT: The rquickjs sandbox event loop has limitations with async/await syntax.
 *    You MUST use standard Promise chains (.then().catch()) for all asynchronous operations.
 * 2. NO DOM APIs: This script runs in a pure JS engine (QuickJS) in the Rust backend, not in a browser.
 *    There is no `window`, `document`, or DOM parser.
 * 3. NETWORK SHIM: A custom `fetch` function is injected into the global scope by the Rust backend.
 *    It returns a Promise resolving to a Response object (with .text() and .json() methods).
 *    Use this to make HTTP requests. Since there's no DOM, you must use Regex or string manipulation
 *    to extract data from HTML responses.
 * 
 * Example Fetch Usage:
 *   fetch("https://example.com/api/data")
 *     .then(res => res.json())
 *     .then(data => { console.log(data); })
 *     .catch(err => { console.error(err); });
 */

const manifest = {
    id: "com.isekast.template",
    name: "Template Source Provider",
    version: "1.0.0",
    description: "A boilerplate template for building Isekast media scrapers.",
    resources: ["stream", "manga"],
    types: ["anime", "manga", "movie", "series"],
    idPrefixes: ["tmdb:", "anilist:"]
};

/**
 * The main extension entry point.
 * This function is invoked by the Rust backend.
 * It must return an object containing the router for handling requests.
 */
function defineExtension() {
    return {
        /**
         * Resolves video streams for anime/movies.
         * @param {string} type - "anime", "movie", or "series"
         * @param {string} id - The media ID (e.g., "tmdb:12345" or "anilist:12345")
         * @returns {Promise} Resolves to a Stremio-compatible streams object.
         */
        stream: function(type, id) {
            return new Promise(function(resolve, reject) {
                // Mock Implementation: Returning a public test HLS video
                console.log("Resolving mock stream for: " + type + " - " + id);
                
                var streams = [
                    {
                        name: "TemplateSource",
                        title: "Big Buck Bunny (1080p)",
                        url: "http://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
                        behaviorHints: {
                            notWebReady: true
                        }
                    }
                ];
                
                resolve({ streams: streams });
            });
        },

        /**
         * Resolves image pages for manga chapters.
         * @param {string} type - Always "manga"
         * @param {string} id - The manga chapter ID.
         * @returns {Promise} Resolves to an object containing an array of image URLs.
         */
        manga: function(type, id) {
            return new Promise(function(resolve, reject) {
                // Mock Implementation: Returning a static array of mock image URLs
                console.log("Resolving mock manga pages for chapter: " + id);
                
                var pages = [
                    "https://via.placeholder.com/800x1200.png?text=Page+1",
                    "https://via.placeholder.com/800x1200.png?text=Page+2",
                    "https://via.placeholder.com/800x1200.png?text=Page+3"
                ];
                
                resolve({ pages: pages });
            });
        }
    };
}

// Export the manifest and the extension definition
module.exports = {
    manifest: manifest,
    defineExtension: defineExtension
};
