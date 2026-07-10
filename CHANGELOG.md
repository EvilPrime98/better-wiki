# better-wiki

## 0.13.0

### Minor Changes

- 8fc4682: `getCharacterAppearances` now also accepts a MediaWiki page ID as its first argument, resolving the page's title before looking up its `Category:<title>/Appearances` members. Previously only a `characterTitle: string` was accepted, requiring callers with just a page ID to resolve the title themselves first — matching the existing `getComicById`/`getVolumeById`/`getPageById` pattern of supporting both a string and a pageId lookup.

## 0.12.0

### Minor Changes

- 61468b2: Allow overriding a plugin's target wiki URL via `wiki({ plugin: 'dc-fandom', url: '...' })`. Previously the URL was hardcoded per-plugin with no way to point it elsewhere. Without `url`, behavior is unchanged (falls back to the plugin's default wiki). Plugin parsing logic is coupled to its default wiki's schema (infobox field names, category names), so results against a different wiki may be partial or empty rather than erroring — documented in the `wiki()` JSDoc, `dcFandomPlugin`'s JSDoc, and the README.

## 0.11.0

### Minor Changes

- 1b8d5bf: Add a `thumbnail` field to `WikiCharacter`, populated from the resolved page thumbnail URL (same mechanism already used by `WikiComic.cover` and `WikiVolume.thumbnail`). The existing `image` field is unchanged and still reflects the raw infobox `Image` value. Pass `flags.thumbnailSize` to `getCharacter`/`getCharacterById` to scale the thumbnail URL; it is populated at a default width otherwise.

### Patch Changes

- 4f9583e: Fix `getComic(query)` (single-result overload) to return `null` when no matching page is found, instead of a fully-defaulted `WikiComic` object with `pageId: -1` and empty fields. This aligns behavior with the method's documented `WikiComic | null` return type and matches the existing zero-match guard already used in `getCharacter` and `getVolume`.

  Consumers that previously detected "no match" by checking `pageId === -1` should switch to checking for `null`.

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
