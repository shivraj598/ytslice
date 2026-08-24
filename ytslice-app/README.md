# ytslice

Paste a YouTube link, drag the handles to the moment you want, and pull it out as a **video clip** or **MP3** — trimmed entirely in your browser. One video can be sliced as many times as you like, at whatever quality YouTube actually offers (720p, 1080p, and beyond).

Built as a static Vite + React app with a thin pair of Cloudflare Pages Functions, so the whole thing runs on **Cloudflare Pages** with no server to manage.

## How it works

```
browser                          Cloudflare Pages
┌────────────────────┐           ┌───────────────────────────┐
│ React UI           │  /api/info│ functions/api/info.ts      │
│  set in/out points ├──────────▶│  Invidious → Piped → oEmbed│
│                    │           │  returns signed stream URLs│
│ ffmpeg.wasm        │  /api/    │ functions/api/proxy.ts     │
│  trim + mux + mp3  ├──proxy───▶│  HMAC-verified CORS stream │
│  (in your browser) │◀──bytes───┤  proxy (forwards Range)    │
└─────────┬──────────┘           └───────────────────────────┘
          │ showSaveFilePicker / <a download>
          ▼  you pick the folder
   clip.mp4 / clip.mp3 on your computer
```

- **Extraction** (`/api/info`) tries several public Invidious instances, then Piped, then falls back to oEmbed for title/thumbnail. It rewrites each stream URL to an instance-proxied form (fetchable from any IP) and wraps it in an HMAC-signed `/api/proxy` URL.
- **The proxy** (`/api/proxy`) only fetches URLs it signed itself (so it's not an open proxy), forwards `Range` requests, and returns the bytes with permissive CORS + CORP headers.
- **Slicing** happens client-side with [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) (single-threaded core, loaded from a CDN at runtime — nothing heavy is bundled). Progressive streams are trimmed directly; adaptive 1080p+ video is muxed with a separate audio track (`-c copy`, with a re-encode fallback). MP3 uses `libmp3lame`.
- **Saving** uses the File System Access API (`showSaveFilePicker`) so you choose the destination folder, with an `<a download>` fallback on browsers that don't support it.

> **Reality check:** extraction depends on public Invidious/Piped instances, which rate-limit and go up and down. Reliability is best-effort. Use the **"Try it with a demo video"** link to explore the full editing flow without hitting the network.

## Develop

```bash
npm install
npm run dev
```

The Vite dev server does **not** run the Pages Functions, so live extraction/downloads only work once deployed (or under `wrangler pages dev`). The demo video works locally.

```bash
npm run build     # tsc -b && vite build  →  dist/
npm run preview   # serve the production build
```

## Deploy to Cloudflare Pages

**Dashboard → Workers & Pages → Create → Pages → Connect to Git**, then set:

| Setting | Value |
| --- | --- |
| Root directory | `ytslice-app` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Functions | auto-detected from `functions/` |

Or from the CLI:

```bash
npm run build
npx wrangler pages deploy dist
```

### Optional environment variables

Set these in **Pages → Settings → Variables** (all optional — sane defaults are baked in):

| Variable | Purpose |
| --- | --- |
| `PROXY_SECRET` | Secret used to HMAC-sign proxy URLs. Set a random value in production. |
| `INVIDIOUS_INSTANCES` | Comma-separated Invidious base URLs to try (overrides the defaults). |
| `PIPED_INSTANCES` | Comma-separated Piped API base URLs to try (overrides the defaults). |

To run the Functions locally with Wrangler:

```bash
npm run build
npx wrangler pages dev dist
```

## Stack

Vite · React 19 · TypeScript · ffmpeg.wasm · Cloudflare Pages Functions · hand-built shadcn-style dark UI (no component-library dependency).
