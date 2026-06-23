---
'better-wiki': minor
---

Add getCategoryMembers pagination, getCharacterAppearances, and getComic category flags.

- `getCategoryMembers` now follows MediaWiki continuation tokens, returning all members across pages instead of only the first 500.
- `dcFandomPlugin` exposes `getCharacterAppearances(characterTitle, { sorted })` — fetches all comics from a character's Appearances category, with optional chronological sort.
- `getComic` accepts two new flags: `includeCollections` (also matches `Category:Collected Editions`) and `categoriesIn` (AND-filters results to pages in all listed categories).
- `WikiPageFlags` fields now carry JSDoc describing `category` (AND), `categoriesOr` (OR), and `thumbnailSize` semantics.
