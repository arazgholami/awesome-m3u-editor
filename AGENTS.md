# Awesome M3U Editor

Private, browser-only editor for M3U/M3U8 IPTV playlists. No build step, no server, no npm. Open `index.html` (or the GitHub Pages live site). Playlists stay in the tab and in `localStorage`; they are never uploaded.

## Files

| File | Role |
|------|------|
| `index.html` | Markup, toolbar, details form, loading overlay, bulk-rename modal |
| `script.js` | All app state, M3U parse/generate, UI actions |
| `styles.css` | Layout, list selection, status badges, loading overlay, modal tweaks |
| `README.md` | User-facing docs |

Vanilla JS + Bootstrap 5.1 + SortableJS + Bootstrap Icons, all from CDN. Keep that stack. Do not add a bundler, framework, or backend.

## Data model

In-memory state in `script.js`:

- `m3uData` — channel objects, playlist order
- `groupOrder` — group names, display order
- `playlistHeader` — first `#EXTM3U` line (EPG URLs live here)
- Selection: `selectedGroup`, `selectedGroups`, `selectedChannels`, `activeChannelId`

A channel (`ensureItem`) has: `_id`, `name`, `url`, `duration`, `tvgId`, `tvgName`, `tvgLogo`, `groupTitle`, catchup fields, `additionalAttributes` (unknown provider attrs, preserved), `status*`, `extraLines` (non-EXTINF comment lines between the inf line and the URL).

Empty/missing `group-title` becomes `No Group`.

Persist with `saveToLocalStorage()` after every successful edit. Re-render with `renderGroups()` / `renderItems()`. Enabling toolbar buttons belongs in `updateActionState()`.

## M3U I/O

- Parse: `parseM3U` → `{ header, items, groups }`. Parsing must not touch editor state (a bad file must not wipe the current playlist).
- Apply: `applyParsedPlaylist` replaces the current playlist.
- Multi-file: `#fileInput` is `multiple`. `handleFileUpload` reads every selected file, `mergeParsedPlaylists` concatenates channels, unions groups in first-seen order, and merges header EPG URL attributes (`url-tvg`, `x-tvg-url`, `tvg-url`). The merged playlist replaces whatever is in the editor, same as a single-file open.
- Generate: `generateM3U` / `downloadM3U` writes `#EXTINF` plus preserved extra lines.

Do not drop unknown `#EXTINF` attributes. Do not guess stream liveness when a check returns CORS.

## Channel rename

- One selected channel, or double-click: inline rename (`startItemRename` / `saveItemRename`). Changes `item.name` only, not `tvgName`.
- Several selected channels, Rename button: bulk modal (`openBulkRenameModal`). Operations compose in this order: find/replace → prefix → suffix → numbering. Numbering follows `getSelectedChannelItems()` order. Preview must use `textContent`, not `innerHTML`.

## UI conventions

- Square controls (`border-radius: 0`), compact `form-control-sm` / `btn-sm`.
- Multi-select: Ctrl/Cmd toggle, Shift range, drag selected rows via SortableJS.
- Status checks: selected channels only, 5 at a time, from the browser. CORS is a real status, not a failure to paper over.
- Loading overlay (`#loadingOverlay`) for playlist import. Keep the tab from looking frozen on large files.

## Version

Release id is `v2.1-YYYYMMDD`. It appears in:

- Cache-bust query strings on every local asset and CDN URL in `index.html`
- The header meta line `v2.1 YYYYMMDD`

On a user-visible release, set YYYYMMDD to that day's date in every one of those places.

## How to verify

This is a static UI. After load/parse/rename/download changes:

1. Serve the folder (for example `python3 -m http.server`) or open `index.html`.
2. Load one `.m3u`, then several at once, and confirm the editor shows the merged groups/channels.
3. Select several channels, Rename, apply prefix/suffix/replace/numbers, confirm names and the downloaded playlist.
4. Confirm single-channel double-click rename still works, and that a bad/empty file does not wipe the current playlist.
