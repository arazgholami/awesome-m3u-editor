---
name: m3u-editor
description: >
  Implement and improve Awesome M3U Editor (vanilla JS IPTV playlist editor).
  Use when changing playlist load/merge, channel/group editing, bulk rename,
  status checks, M3U parse/generate, or the editor UI. Also use for /m3u-editor
  and when bumping the v2.1-YYYYMMDD release id.
---

# Improve Awesome M3U Editor

Read `AGENTS.md` first. It is the source of truth for architecture, data model, and conventions. Then make the smallest change that fits the existing vanilla JS patterns.

## Where to put work

| Change | Place |
|--------|--------|
| Markup, toolbars, modals | `index.html` |
| State, parse, actions | `script.js` |
| Visual tweaks | `styles.css` |
| User-facing feature list | `README.md` |

There is no test runner and no bundler. Do not add one unless asked.

## Implementation pattern

1. Match neighboring code: `function` declarations, `const` DOM refs at the top of `script.js`, Bootstrap 5 markup.
2. After any successful playlist mutation: `saveToLocalStorage()`, then `renderGroups()` and/or `renderItems()`.
3. Toolbar enable/disable goes in `updateActionState()` only.
4. Parse into a standalone object; apply to editor state only after the file(s) yield channels. A failed or empty load must leave the current playlist untouched.
5. Preserve unknown `#EXTINF` attributes and extra `#` lines. Do not invent a server for status checks.

## Feature entry points

- **Open/merge files:** `handleFileUpload` → `parseM3U` → `mergeParsedPlaylists` (when more than one file) → `applyParsedPlaylist`
- **Header EPG merge:** `mergePlaylistHeaders` — union URL attrs, first-wins for other attrs
- **Single rename:** `startItemRename` / `saveItemRename` (button when one channel is selected, or double-click)
- **Bulk rename:** `startSelectedItemRename` opens `openBulkRenameModal` when several channels are selected. Name transform is `buildBulkRenamedName` (replace → prefix → suffix → numbers). Preview via `textContent`.
- **Download:** `generateM3U` / `downloadM3U`

## Release id

When the user asks to ship or to update the version date, replace `v2.1-YYYYMMDD` (query strings) and `v2.1 YYYYMMDD` (header meta) in `index.html` with today's date. Keep the `2.1` product number unless asked to bump it.

## Verify before finishing

Exercise the changed path in the browser (or Chrome headless against a local static server):

- Load one file and several files; confirm merge order and that empty/bad files do not wipe the editor
- Single rename still inline; multi-select Rename uses the modal and writes `item.name` only
- Download the playlist and check `#EXTINF` names/groups/header
- If layout changed, check a narrow viewport too
