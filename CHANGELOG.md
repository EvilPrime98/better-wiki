# better-wiki

## 0.10.0

### Minor Changes

- c36788d: Standardize the `flags` object across `better-wiki` and the `dc-fandom` plugin. `WikiPageFlags` and `WikiFandomFlags` are replaced by a single exported `WikiFlags` interface; each method now picks only the flags it actually supports:

  - `getVolumeById` now takes `flags?: Pick<WikiFlags, 'thumbnailSize'>` instead of a raw `thumbnailSize` number (breaking).
  - `getCategoryMembers` no longer accepts a `flags` argument — its `limit` flag was never implemented (breaking).
  - `getComic` / `getCharacter`'s `categoriesIn` flag is renamed to `category`, matching the core `Wiki` flags (breaking).
  - Methods that ignored flags they accepted (e.g. `getPageById`, `getComicById`, `getCharacterById` previously widened to the full flags interface) are now typed to only the flags they use.

## 0.9.1

### Patch Changes

- 2abb6f9: Export all public dc-fandom plugin types from the package entry point: `WikiCharacter`, `WikiCharacterHistorySection`, and `WikiFandomFlags` are now importable directly from `'better-wiki'`.

## 0.9.0

### Minor Changes

- 47513ff: Add array overloads to `getPageById`, `getComicById`, `getVolumeById`, and `getCategoryMembers`; add `limit` flag to `getPage` and `getCategoryMembers`; `getCategoryMembers(string[])` now returns the intersection (members of the first category that belong to all remaining ones).

## 0.8.0

### Minor Changes

- 113ab25: Add `getCharacter`, `getCharacterById`, and a `sorted` flag for multiple `getComic` results.

  - `dcFandomPlugin` exposes `getCharacter(query, flags?)` and `getCharacterById(pageId, flags?)`, returning a typed `WikiCharacter` (bio fields, parsed `history` sections, powers/abilities/equipment lists, optional `quotation`).
  - Each `WikiCharacter` carries `getAppearances({ sorted? })`, fetching the character's Appearances comics with optional chronological sort.
  - `getComic(query, { multiple: true })` now accepts `sorted` to return comics ordered by release date.

## 0.7.0

### Minor Changes

- edf5eb5: Add getCategoryMembers pagination, getCharacterAppearances, and getComic category flags.

  - `getCategoryMembers` now follows MediaWiki continuation tokens, returning all members across pages instead of only the first 500.
  - `dcFandomPlugin` exposes `getCharacterAppearances(characterTitle, { sorted })` — fetches all comics from a character's Appearances category, with optional chronological sort.
  - `getComic` accepts two new flags: `includeCollections` (also matches `Category:Collected Editions`) and `categoriesIn` (AND-filters results to pages in all listed categories).
  - `WikiPageFlags` fields now carry JSDoc describing `category` (AND), `categoriesOr` (OR), and `thumbnailSize` semantics.

## 0.6.0

### Minor Changes

- edf5eb5: Add `categoriesOr` flag for OR-based category filtering, migrate dc-fandom scorer to fuse.js.

  - `WikiPageFlags` now accepts `categoriesOr: string[]` — filters pages matching **any** of the listed categories (OR). The existing `category` flag retains AND semantics.
  - Removes `category` from `getPageById` flags (filtering a page you already have by ID is a no-op).
  - `getComic` now matches `Category:Collected Editions` in addition to `Category:Comics`.
  - `getComic` and `getVolume` overloads now expose `thumbnailSize` in their typed signatures.
  - Replaces hand-rolled fuzzy scorer in dc-fandom with fuse.js, preserving year, recency-bias, and number-suffix boosters.

## 0.5.0

### Minor Changes

- c449590: Add first-party plugin system with dc-fandom plugin.

  `wiki({ plugin: 'dc-fandom' })` returns a `Wiki` client extended with `getComic`, `getComicById`, `getVolume`, and `getVolumeById` — typed methods for fetching DC Fandom comic and volume data. Plugin types (`WikiComic`, `WikiVolume`, `WikiCredits`, etc.) are now exported from the package root.

## 0.4.0

### Minor Changes

- aa951e5: Extend thumbnail support to `getPageById`, `getPageByTitle`, and `getPagesByCategory`.

  All three methods now accept `flags.thumbnailSize` and populate the `WikiPage.thumbnail` field from the API response, consistent with `getPage`.

## 0.3.0

### Minor Changes

- aa951e5: Extend thumbnail support to `getPageById`, `getPageByTitle`, and `getPagesByCategory`.

  All three methods now accept `flags.thumbnailSize` and populate the `WikiPage.thumbnail` field from the API response, consistent with `getPage`.

## 0.2.0

### Minor Changes

- dbb76e0: Add thumbnail support: new `getThumbnailById(pageId, width?)` method on the `Wiki` client, `thumbnail` field on `WikiPage` and `WikiSearchGeneratorPageItem`, and `thumbnailSize` flag on `WikiPageFlags`.

## 0.1.0

### Minor Changes

- Initial release — typed, cache-aware MediaWiki/Fandom client with resilient HTTP and ESM output.

## Unreleased
