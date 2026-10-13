/* Structural validation: loads every chapter file the way the browser would,
   then checks the things that silently break the page. */
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "chapters");
const files = fs.readdirSync(dir).filter(f => /^ch\d\d-.*\.js$/.test(f)).sort();

const LX = { chapters: [], glossary: {} };
LX.push = function (ch) { LX.chapters.push(ch); };
global.LX = LX;

let bad = 0;
for (const f of files) {
  try {
    new Function("LX", fs.readFileSync(path.join(dir, f), "utf8"))(LX);
  } catch (e) {
    console.log("LOAD FAIL " + f + ": " + e.message);
    bad++;
  }
}

const KNOWN = new Set(["prose", "callout", "diagram", "code", "table", "cards", "kv", "steps"]);
const seen = new Map();
let diagrams = 0, blocks = 0, words = 0;

LX.chapters.forEach(ch => {
  if (seen.has(ch.id)) { console.log("DUPLICATE id: " + ch.id); bad++; }
  seen.set(ch.id, true);
  if (!ch.title) { console.log("NO TITLE: " + ch.id); bad++; }
  (ch.sections || []).forEach(s => {
    blocks++;
    if (!KNOWN.has(s.type)) { console.log("UNKNOWN block type '" + s.type + "' in " + ch.id); bad++; }
    if (s.type === "diagram") {
      diagrams++;
      const svg = s.svg || "";
      if (!/^<svg/.test(svg.trim())) { console.log("BAD svg start in " + ch.id + " fig " + diagrams); bad++; }
      if (!/viewBox=/.test(svg)) { console.log("NO viewBox in " + ch.id); bad++; }
      if (/marker-end="url\(#([^"]+)\)"/.test(svg)) {
        const used = [...svg.matchAll(/marker-end="url\(#([^)]+)\)"/g)].map(m => m[1]);
        const known = new Set(["lm-arrow", "lm-arrow-accent", "lm-arrow-ok", "lm-arrow-warn", "lm-arrow-bad", "lm-dot"]);
        used.forEach(u => { if (!known.has(u)) { console.log("UNKNOWN marker #" + u + " in " + ch.id); bad++; } });
      }
      if (/<svg[^>]*\swidth=/.test(svg)) { console.log("svg has width attr in " + ch.id + " (lightbox conflict)"); bad++; }
      // a backslash inside a TAG breaks attribute parsing; inside text content it is harmless
      if (/<[^>]*\\[a-z-]*=/.test(svg) || /="[^"]*\\[^"]*"/.test(svg)) {
        console.log("BACKSLASH inside an SVG tag in " + ch.id + " — breaks attribute parsing"); bad++;
      }
      words += svg.replace(/<[^>]+>/g, " ").split(/\s+/).length;
    }
    words += JSON.stringify(s).replace(/<[^>]*>/g, " ").split(/\s+/).length;
  });
  words += JSON.stringify(ch.takeaways || []).split(/\s+/).length;
  Object.assign(LX.glossary, ch.glossary || {});
});

// anchors used by jump links must exist
LX.chapters.forEach(ch => {
  (ch.sections || []).forEach(s => {
    if (s.type === "diagram") {
      const m = [...(s.svg || "").matchAll(/data-jump="([^"]+)"/g)].map(x => x[1]);
      m.forEach(id => { if (!seen.has(id)) { console.log("DEAD jump link -> #" + id + " in " + ch.id); bad++; } });
    }
  });
});

// every file referenced by index.html should exist
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
[...html.matchAll(/src="assets\/chapters\/([^"]+)"/g)].forEach(m => {
  if (!fs.existsSync(path.join(dir, m[1]))) { console.log("index.html references MISSING " + m[1]); bad++; }
});
fs.readdirSync(dir).filter(f => /^ch\d\d-.*\.js$/.test(f)).forEach(f => {
  if (!html.includes(f)) { console.log("chapter file NOT referenced by index.html: " + f); bad++; }
});

// CJK sweep across everything we ship
const all = [path.join(__dirname, "..", "index.html"), path.join(__dirname, "..", "assets", "style.css"),
  path.join(__dirname, "..", "assets", "app.js"), ...files.map(f => path.join(dir, f))];
const cjk = /[\u4e00-\u9fff\u3040-\u30ff]/;
all.forEach(f => { if (cjk.test(fs.readFileSync(f, "utf8"))) { console.log("CJK CHARACTERS in " + path.basename(f)); bad++; } });

console.log("\n---");
console.log("chapters : " + LX.chapters.length + " / " + files.length + " files");
console.log("blocks   : " + blocks + "   diagrams: " + diagrams + "   glossary terms: " + Object.keys(LX.glossary).length);
console.log("approx words: " + Math.round(words / 100) * 100);
console.log("ids      : " + LX.chapters.map(c => c.id).join(", "));
console.log(bad === 0 ? "\nRESULT: all checks passed" : "\nRESULT: " + bad + " problem(s)");
process.exit(bad === 0 ? 0 : 1);