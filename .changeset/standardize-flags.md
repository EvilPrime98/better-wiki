---
'better-wiki': minor
---

Standardize the `flags` object across `better-wiki` and the `dc-fandom` plugin. `WikiPageFlags` and `WikiFandomFlags` are replaced by a single exported `WikiFlags` interface; each method now picks only the flags it actually supports:

- `getVolumeById` now takes `flags?: Pick<WikiFlags, 'thumbnailSize'>` instead of a raw `thumbnailSize` number (breaking).
- `getCategoryMembers` no longer accepts a `flags` argument — its `limit` flag was never implemented (breaking).
- `getComic` / `getCharacter`'s `categoriesIn` flag is renamed to `category`, matching the core `Wiki` flags (breaking).
- Methods that ignored flags they accepted (e.g. `getPageById`, `getComicById`, `getCharacterById` previously widened to the full flags interface) are now typed to only the flags they use.
