# better-wiki

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
