# Chapter authoring contract — Linux, from the inside

You are authoring **one file**: `assets/chapters/chNN-slug.js` inside the project at
`/Users/alexgris/.mavis/workspace/linux-map/`.

Read `assets/chapters/ch02-kernel.js` first. It is the reference implementation of this
contract and the quality bar. Match its depth, its density, and its tone.

## What this project is

A single-page, offline, interactive HTML map of how Linux works: kernel, processes,
isolation, systemd, packages, building from source, networking, DNS, services, storage,
containers/containerd, Kubernetes, security, troubleshooting. 18 chapters. It renders in
the browser from plain JS data files. Your chapter is rendered by an existing engine.

**Your job is content only.** Do not edit `index.html`, `assets/style.css`,
`assets/app.js`, or any other chapter file. Do not create extra files.

## File shape

```js
/* chNN — Title */
(function () {
  LX.push({
    id: "slug",                 // must match the filename stem, used for the anchor
    title: "Human title",
    tagline: "One sentence, the mental model in a line.",
    sections: [ /* blocks, in order */ ],
    takeaways: [ "…", "…" ],    // 5-8 items, each a real statement, not a platitude
    glossary: {                 // 10-16 terms that this chapter uses
      "Term": "one-line definition",
      "sysfs": "…"
    }
  });
})();
```

`LX` is a global provided by `index.html`. No imports, no exports, no `require`.

## Block types (use several kinds; the engine knows exactly these)

```js
{ type: "prose", h: "Section heading", note: "callout", noteKind: "tip|warn|danger|fact|boss",
  noteTitle: "Short bold title for the callout", p: ["<p> html string", "…"], ul: ["…"], ol: ["…"] }

{ type: "callout", kind: "tip|warn|danger|fact|boss", title: "Short title", text: "html string" }

{ type: "diagram", h: "Title of the figure", caption: "What to look at, and what it means in practice.", svg: `<svg viewBox="0 0 1100 520">…</svg>` }

{ type: "code", lang: "bash|nginx|conf|yaml|json|diff|go|c", what: "What this command answers",
  code: "multi\nline\nstring" }

{ type: "table", cols: ["Column", "…"], rows: [["<code>cell</code>", "…"], …] }

{ type: "cards", items: [ { title: "Name", tag: "KERNEL", tone: "violet|ok|warn|bad|pink", text: "html" } ] }

{ type: "kv", items: [ { k: "/proc", v: "html" } ] }

{ type: "steps", items: [ { t: "Step title", d: "what happens" } ] }
```

## SVG rules — read carefully, this is where chapters break

- Every diagram: `<svg viewBox="0 0 1100 H">` — width 1100, choose your own height.
  **Do not set `width`/`height` attributes.** CSS makes it responsive; the lightbox
  re-implements zoom/pan itself.
- Wrap in a template literal (`` `…` ``). Inside it you may use `"` freely.
- **Available marker ids for arrowheads:** `lm-arrow`, `lm-arrow-accent`, `lm-arrow-ok`,
  `lm-arrow-warn`, `lm-arrow-bad`, `lm-dot`. Gradients: `lm-grad-accent`, `lm-grad-violet`,
  `lm-grad-ok`.
- **Available SVG classes (already styled — use them, do not invent colours):**

| class | use |
|---|---|
| `box` | neutral panel |
| `box-a` `box-v` `box-ok` `box-w` `box-b` `box-p` | accent, violet, ok, warn, bad, pink |
| `ln` `ln-a` `ln-v` `ln-ok` `ln-w` `ln-b` | lines; add class `dash` for dashed |
| `t-title` `t-sm` `t-xs` `t-sans` `t-mono` | text sizes/styles |
| `t-accent` `t-violet` `t-ok` `t-warn` `t-bad` `t-dim` | text colours |

  Inline `font-size="14.5"` / `fill="var(--accent)"` are fine when a class is too coarse.
- Fonts are monospace by default (`svg text`). Use `class="t-sans"` for prose labels.
- **Text ≥ 13 in viewBox units** (diagrams render ~880 px wide, so it scales down slightly).
  Use `font-size="15"` or `16` for anything that must stay legible.
- **SVG has no text wrapping.** Break lines yourself with separate `<text>` elements, or
  `<tspan x="…" dy="20">` inside one `<text>`.
- Set `text-anchor="middle"` for centred labels, `text-anchor="end"` for right-aligned.
- Give `<svg role="img" aria-label="…">` for accessibility.
- A diagram must be *drawn*: boxes, arrows, ordering, grouping. Not a list in a box.

## Content rules

1. **English only. Zero CJK characters anywhere in the file.** No Chinese, Japanese or
   Korean in comments, strings, identifiers or diagrams.
2. **No backticks or `${` inside content strings.** Use `<code>foo</code>` for inline code.
   If a diagram must show a shell prompt, use `$ nginx -t`.
3. **Quoting trap.** Any prose string that contains `"` (for example an HTML attribute like
   `<span class="x">` or `<abbr title="y">`) must use **single quotes** as its JS delimiter.
   Mixing `"…"` around a string that itself contains `"` is a syntax error. When in doubt,
   use a single-quoted string, or a template literal for anything long.
4. Escape `&` as `&amp;` and `<` as `&lt;` inside **prose HTML strings only** (SVG markup
   is inserted raw and must be well-formed).
5. **Be specific and correct.** Real paths, real flag names, real defaults, real error
   numbers. If a value differs across versions/distros, say so inline rather than hedging
   vaguely. Example of the right altitude:
   *"sshd default `MaxAuthTries` is 6 on Ubuntu 22.04+, was 3 on older images — always
   check `sshd_config` with `sshd -T`, which prints the effective values, not the file."*
6. **Explain the mechanism, not just the command.** The reader is a software/security
   engineer building a mental model. Every command should answer "what is actually
   happening in the kernel/process manager when this runs?"
7. **No filler.** No "In today's modern world…", no restating the heading as the first
   sentence, no summarising the chapter you are in. No AI tells.
8. Baseline is **Debian/Ubuntu with systemd**. Say explicitly when macOS/Arch/Fedora/
   Alpine/BusyBox differ. Where cgroups v1 vs v2 matters, show both.
9. This machine, for concrete examples (verified — do not contradict it):
   Ubuntu 18.04.6, kernel 4.15.0-213, systemd 237, **cgroups v1**, iptables 1.6 legacy,
   systemd-resolved on 127.0.0.53 (Tailscale search domain), nginx 1.14, BIND 9.11.3
   authoritative-only, ufw 0.36, 2 GB RAM / 19 GB disk, SSH key-only + Tailscale-only,
   static sites in `/var/www/html` published by `rsync` from local git repos.
   Real services on it: nginx (4 static sites), named (ns.alexandrugris.ro, authoritative
   only), sshd, systemd-resolved, ufw. Mention it where it makes an example concrete.
10. Length: **900-1400 lines per chapter.** That is roughly 6-10 diagrams and 4-8 code
   blocks. Long is fine. Thin is not.

## Before you finish (run these, show output)

```bash
cd /Users/alexgris/.mavis/workspace/linux-map
node --check assets/chapters/chNN-slug.js
grep -cP '[\x{4e00}-\x{9fff}\x{3040}-\x{30ff}]' assets/chapters/chNN-slug.js || echo "CJK: none"
```

`node --check` must print nothing. The grep must report 0 (or print `CJK: none`).

## Report back

Three lines maximum: files written, `node --check` status, diagram count.