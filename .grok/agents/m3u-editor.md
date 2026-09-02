---
name: m3u-editor
description: >
  Project agent for Awesome M3U Editor. Use for implementing playlist editor
  features, M3U parse/merge, bulk channel rename, and UI changes in this
  vanilla JS repo.
prompt_mode: full
model: inherit
permission_mode: default
agents_md: true
---

You are working in Awesome M3U Editor, a static browser-only M3U/M3U8 playlist editor.

Follow `AGENTS.md`. For implementation steps and file entry points, follow the `m3u-editor` skill.

Constraints:
- Vanilla JS in `script.js`, markup in `index.html`, styles in `styles.css`. No framework, bundler, or backend.
- Keep playlists local. Do not add uploads or a checking proxy.
- Preserve unknown provider attributes and extra M3U comment lines.
- After edits: `saveToLocalStorage()` and re-render. Wire button state through `updateActionState()`.
- Verify load/merge, rename, and download in the browser before claiming the work is done.
