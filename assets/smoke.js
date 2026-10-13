/* Render smoke test: loads the real page in Chromium, captures console errors,
   checks the DOM came out right, and screenshots the top of the document. */
const { chromium } = require("/Users/alexgris/.local/lib/node_modules/playwright");
const path = require("path");

(async () => {
  const file = "file://" + path.join(__dirname, "..", "index.html");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  const errors = [];
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("requestfailed", r => errors.push("request failed: " + r.url().split("/").pop()));

  await page.goto(file, { waitUntil: "load" });
  await page.waitForTimeout(700);

  const stats = await page.evaluate(() => ({
    chapters: document.querySelectorAll("section.chapter").length,
    tocLinks: document.querySelectorAll("#toc a").length,
    figures: document.querySelectorAll("figure.fig").length,
    svgs: document.querySelectorAll("figure.fig svg").length,
    codeBlocks: document.querySelectorAll(".code").length,
    tables: document.querySelectorAll("table").length,
    callouts: document.querySelectorAll(".callout").length,
    cards: document.querySelectorAll(".card").length,
    glossary: Object.keys(window.LX.glossary || {}).length,
    // any SVG that failed to lay out (zero width) is a layout bug
    zeroSvgs: [...document.querySelectorAll("figure.fig svg")].filter(s => s.getBoundingClientRect().width < 50).length,
    // any diagram whose text overflows its viewBox badly
    docHeight: document.body.scrollHeight,
    brokenAnchors: [...document.querySelectorAll("svg g.jump")].length
  }));

  // exercise the interactive bits
  await page.click("#themeBtn");
  await page.waitForTimeout(150);
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.click("#themeBtn");

  await page.fill("#search", "cgroup");
  await page.waitForTimeout(300);
  const searchResults = await page.evaluate(() => {
    const r = document.getElementById("searchResults");
    return { hidden: r.hidden, hits: r.querySelectorAll(".sr-item").length };
  });

  await page.click(".fig-bar .zoom");
  await page.waitForTimeout(250);
  const lightbox = await page.evaluate(() => !document.getElementById("lightbox").hidden);
  await page.screenshot({ path: path.join(__dirname, "..", "previews", "preview-lightbox.png") });
  await page.click("#lightboxClose");

  await page.click("#glossaryBtn");
  await page.waitForTimeout(200);
  const glossaryShown = await page.evaluate(() => document.querySelectorAll(".gloss-item").length);
  await page.click("#drawerClose");

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(__dirname, "..", "previews", "preview-top.png") });
  const anchor = await page.evaluate(() => {
    const s = [...document.querySelectorAll("section.chapter")];
    return s.length ? s[Math.min(4, s.length - 1)].id : null;
  });
  if (anchor) {
    await page.evaluate(id => document.getElementById(id).scrollIntoView(), anchor);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(__dirname, "..", "previews", "preview-chapter.png") });
  }

  await browser.close();

  console.log(JSON.stringify({ ...stats, theme, searchResults, lightbox, glossaryShown }, null, 2));
  console.log(errors.length ? "\nERRORS:\n" + errors.join("\n") : "\nno console/page errors");
})();