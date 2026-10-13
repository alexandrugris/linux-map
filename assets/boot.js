/* Bootstraps the chapter registry.
   This lives in a file rather than an inline <script> because the site sends
   Content-Security-Policy: script-src 'self' — inline scripts are blocked. */
window.LX = window.LX || { chapters: [], glossary: {} };
LX.push = function (ch) { LX.chapters.push(ch); };