# Delivery, Packaging, and CSP

Read this reference when configuring fonts, favicons, external assets, strict-CSP static hosting, standalone single-file HTML delivery, multi-file web apps, or print-ready documents.

## Match packaging to the real delivery target

| Delivery target | Asset and bundling rules |
| --- | --- |
| **Multi-file web app** (React, Next.js, Vite, Astro, Svelte) | Use the project's existing build pipeline, design tokens, and component primitives. Bundle fonts and icons locally where supported; avoid injecting rogue CDNs into an app that already bundles assets. Verify both dev server and production build (`npm run build` / typecheck) when the project has one. |
| **Standalone single-file HTML** (emailed/shared brief, local artifact, static upload) | Keep CSS, JS, inline SVG icons, inline SVG favicon, and datasets inside one self-contained `.html` file. Never `fetch()` relative local JSON files that break when opened elsewhere. Keep system fallback stacks crisp in case external font hosts are offline, or inline subset WOFF2 fonts if full offline typography is required. |
| **Strict-CSP hosted page** (sandboxed viewers, static page hosts, internal portals) | Check the target host's exact `Content-Security-Policy` (`script-src`, `style-src`, `img-src`, `font-src`) before choosing inline vs. external assets. Inline `<script>` only runs if the host allows `'unsafe-inline'` or a matching nonce/hash; under `script-src 'self'` without those, serve JS from an external `'self'` or allowlisted CDN script with verified `sha384` SRI. Test locally under the host's exact CSP header. |
| **Printable / archival HTML document** | Add a complete `@media print` stylesheet (details below) so Chrome/Safari "Save as PDF" produces a crisp, readable document without blank scroll-reveal sections or broken dark fills. |

## Strict-CSP and SRI discipline

When external CDN resources (for example, `@fontsource/*` stylesheets or animation utilities on `cdn.jsdelivr.net`) are allowed by the host's CSP:

1. **Resolve the latest release first, then pin that exact immutable version** (for example, check `npm view @fontsource/inter version` and pin `@fontsource/inter@<version>/400.css` — never ship `@latest`, bare ranges, or stale copied version numbers).
2. **Always pair external `<link>` and `<script>` tags with verified SRI and CORS attributes:**

   ```bash
   # Resolve the current version and compute the exact sha384 integrity hash from the real fetched file
   VERSION=$(npm view @fontsource/inter version)
   curl -fsSL "https://cdn.jsdelivr.net/npm/@fontsource/inter@${VERSION}/400.css" \
     | openssl dgst -sha384 -binary \
     | openssl base64 -A
   ```

   Use `integrity="sha384-<hash>" crossorigin="anonymous"`. Never guess, truncate, or copy an unverified hash from memory — a single mismatched byte causes the browser to silently block the stylesheet or script.
3. **Prefer self-contained code over heavy libraries:** Native SVG charts, Canvas 2D simulators, WebGL2 shaders, `IntersectionObserver`, and CSS transitions need zero external scripts and never break on CDN or CSP restrictions.
4. **Match `script-src` and `style-src` for inline vs. external code:** Moving off inline HTML `onclick="..."` attributes is necessary (even nonce/hash CSPs block inline event attributes unless `'unsafe-hashes'` or `'unsafe-inline'` is present), **not sufficient** by itself. Under `script-src 'self'` without `'unsafe-inline'`, a host-injected `'nonce-...'`, or a matching `'sha256-...'` script hash, browsers block inline `<script>` blocks too. Either externalize JS to a `script-src`-allowed file (such as `'self'` `/app.js`) or use the host's supported nonce/hash mechanism — and apply the same rule to `<style>` under `style-src`. Always bind listeners with `addEventListener` inside an authorized script, and avoid `eval()`, `new Function()`, and dynamic script injection.
5. **Check `img-src` and `font-src`:** Verify whether the host allows `data:` for inline SVG favicons (`img-src 'self' data:`) and font files (`font-src` matching your font CDN or `data:` for embedded WOFF2); if `data:` is disallowed in `img-src`, serve `/favicon.svg` from `'self'`.

## Font loading hygiene

- Load only the specific weights and italic styles the page actually renders (typically regular `400`, medium `500`, semibold `600`, plus italic where display typography uses it).
- Use `font-display: swap` on `@font-face` rules so text renders immediately with zero invisible-text flash.
- Pair every web font with a sensible fallback stack:
  - Display serif: `"Instrument Serif", Georgia, "Times New Roman", serif`
  - UI sans: `"Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
  - Monospace: `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
- For single-file Vite/React bundles or fully offline pages, embedding subset WOFF2 `@font-face` data URIs eliminates external font dependencies completely (keep total file size mindful of host upload limits).

## Essential document head and favicon checklist

Include a clean, complete `<head>` on every HTML page or app shell:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <title>Clear, specific page title</title>
    <meta name="description" content="One-sentence factual summary." />
    <link
      rel="icon"
      type="image/svg+xml"
      href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E...%3C/svg%3E"
    />
  </head>
```

- Set `<meta name="color-scheme">` to match the actual theme (`light`, `dark`, or `light dark`) so native scrollbars, form controls, and browser chrome harmonize with the canvas.
- Use the inline `data:image/svg+xml` `<link rel="icon">` only when `img-src` permits `data:`; on same-origin-only CSP hosts and multi-file web apps, serve `/favicon.svg` (plus a fallback `/favicon.ico` or `32×32` PNG, `apple-touch-icon`, and `<meta name="theme-color">`) and remove leftover template favicons from `public/`.

## Print-ready HTML document rules (`@media print`)

When an artifact is a brief, report, memo, or document that readers might print or export to PDF:

```css
@media print {
  :root {
    color-scheme: light;
    --bg: #ffffff;
    --surface: #ffffff;
    --ink: #111827;
    --ink-muted: #4b5563;
    --border: #d1d5db;
  }
  body {
    background: #ffffff !important;
    color: #111827 !important;
  }
  header,
  nav,
  .no-print,
  canvas.ambient-bg {
    display: none !important;
  }
  /* Prevent scroll-reveal elements from printing invisible */
  [data-reveal],
  .reveal {
    opacity: 1 !important;
    transform: none !important;
  }
  figure,
  table,
  .card,
  .chart-panel {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  h1,
  h2,
  h3 {
    break-after: avoid;
    page-break-after: avoid;
  }
}
```

Ensure static data summaries or key charts remain legible in print (for example, dark-theme SVG text should reference CSS variables that flip cleanly to dark ink under `@media print`).
