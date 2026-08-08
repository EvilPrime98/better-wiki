---
"better-wiki": minor
---

Fix `dc-fandom`/`marvel-fandom` comics resolving `cover` from MediaWiki's auto-picked `page.thumbnail`, which doesn't reliably pick the actual cover (e.g. it can resolve to a gallery-embedded video's thumbnail instead). `cover` now resolves from the infobox's own cover field (`Image` for `dc-fandom`, `Image1` for `marvel-fandom`) via a new `Wiki.getFileUrl(fileName, width?)` client method, falling back to `page.thumbnail` when the infobox field is missing or unresolvable.
