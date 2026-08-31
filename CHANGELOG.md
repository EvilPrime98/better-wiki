# better-wiki

## 0.21.5

### Patch Changes

- a196078: Normalize `WikiComic.releaseDate` in the `dc-fandom` plugin. `releaseMonth` is now a zero-padded numeric string (`"03"`) instead of the raw infobox month name (`"March"`), and `releaseDay` is zero-padded to two digits, matching the shape the `marvel-fandom` plugin already returns. An unrecognized month value (for example a season such as `"Spring"`) yields an empty string. This also fixes month-level ordering in `byReleaseDate`, which previously coerced the month name to `NaN` and collapsed every comic to the same month.

## 0.21.4

### Patch Changes

- df94f22: Speed up `getCategoryMembers` for callers that only need the first N results (e.g. `.slice(0, limit)`). It now accepts a `limit` flag: for a single category, pagination stops as soon as enough members are collected instead of always walking the entire category via `cmcontinue`. For multiple categories, the first category is fetched and category-checked in growing batches (same wave pattern used to speed up category-filtered `getPage` in a prior release) until `limit` filtered matches are found, instead of pre-fetching and category-checking the entire first category up front.

  Behavior note: when `limit` is supplied for a single category, `getCategoryMembers` may issue smaller `cmlimit` requests than the previous fixed `500` — this only affects how many members are requested per page, not which members are returned. Calls without `limit` are unaffected.

- c707015: Fix a `TypeError` in the `dc-fandom` plugin when `sorted: true` was combined with a `fields` list that omitted `releaseDate`. `byReleaseDate` now tolerates a missing `releaseDate` (or missing/non-numeric parts), treating it as epoch `0` so undated comics sort first instead of throwing. Additionally, every `sorted: true` code path (`getComic({ multiple: true })`, `WikiVolume.getComics()`, `getCharacterAppearances`, and a character's `getAppearances()`) now selects `releaseDate` internally when sorting so the order stays meaningful, then strips it from the results if it wasn't in the caller's `fields` — the returned objects still contain only the requested keys.

## 0.21.3

### Patch Changes

- 5be8b3b: Clarify `getCategoryMembers` JSDoc: when passing multiple category titles, they are read left to right, so the first category should be the one that narrows the result set the most for efficient queries. No behavior change.
- 4069b60: Speed up `getPage` (and `getComic`/`getVolume`/`getCharacter`, which call it internally) when searching with `category`/`categoriesOr` flags. Previously, filtering search results by category meant fetching each candidate page's entire category list (often 40-90 entries) in a separate request, then paginating through search results one page at a time until enough matches accumulated. Category checks are now restricted (via MediaWiki's `clcategories` param) to just the categories being filtered on and folded into the same request as the search itself, and once filtering is active, subsequent search pages are fetched concurrently in growing batches instead of one at a time. On a representative query this cut `getComic('batman', { multiple: true })` from ~11s to ~3-4s.

  Behavior note: as a result of fetching only the filtered categories, `WikiPage.categories` on results from a `category`/`categoriesOr`-filtered `getPage` call now contains only the categories that matched the filter, rather than the page's full category list. Unfiltered `getPage` calls are unaffected.

  Since MediaWiki still caps categories at 500 total per request shared across every page in a batch (the same limit that caused the truncation fixed in a prior release), a `clcontinue` on the response is now detected and treated as a signal to re-fetch that batch's categories through the complete, paginated path rather than trust a possibly-truncated inline result — this only adds requests back in the rare case a very large `limit` combined with several filter categories pushes past that cap.

## 0.21.2

### Patch Changes

- 2a20348: Fix the published ESM in `dist/` being unimportable on plain Node (`ERR_MODULE_NOT_FOUND`). Relative import/export specifiers were emitted extensionless (e.g. `from './better-wiki'`), which Node's ESM resolver rejects — the package worked under Bun (which tolerates extensionless specifiers) but crashed on first `import` under Node, including on serverless platforms. `tsconfig.json` now uses `"module": "NodeNext"` / `"moduleResolution": "NodeNext"`, all relative specifiers in `src/` carry explicit `.js` extensions, and a `check:esm` script runs in CI after the build step to catch any regression of this class on plain Node.
- 2222793: Fix `getPageByTitle`, `getImages`, `getGallery`, and `searchCategories` silently truncating results, the same class of bug fixed for `getPage` in 3edfc30. Each issued a MediaWiki API call using a fixed/`max` `*limit` parameter with no continuation loop, so wikis with more items than that cap (categories, embedded images, gallery images, or search matches) got a partial, truncated result with no signal that data was dropped. All four now paginate via their respective continuation token (`clcontinue`, `gimcontinue`, `imcontinue`, `sroffset`) until MediaWiki's `continue` field is exhausted, mirroring the existing pattern already used by `membersForCategory` and `getCategoriesForPages`.

## 0.21.1

### Patch Changes

- 3edfc30: Fix `getPage` silently truncating category data on broad searches. Categories were previously requested inline with the initial search query (`cllimit: 'max'`), which caps the response at 500 categories shared across _all_ returned pages combined — so pages with truncated (but non-empty) category lists were never detected or refetched. Category lookups now always go through the dedicated `getCategoriesForPages` helper, which paginates via `clcontinue` per page batch and always returns the complete category list.

## 0.21.0

### Minor Changes

- 74819a4: Fix `getComic(query, { multiple: true })` (and `getVolume`/`getCharacter`) on the `dc-fandom` and `marvel-fandom` plugin clients returning far fewer results than exist for broad/generic queries. The underlying `getPage` search fetched only 20 raw relevance-ranked results before category filtering was applied, so a broad single-word query (e.g. `"superman"`) could lose almost all real matches to the filter, while a longer, more specific query survived mostly intact — masking the bug. `getComic`, `getVolume`, and `getCharacter` now accept a `limit` flag (like the base `getPage`), and default it to 50 when `multiple: true` is requested without an explicit `limit`, raising the raw search window enough to survive category filtering on broad queries. An explicit `limit` always overrides the default.

## 0.20.0

### Minor Changes

- 649bd67: Fix `getComic`/`getVolume`/`getCharacter` on `dc-fandom` and `marvel-fandom` plugin clients rejecting a non-literal `boolean` passed to `multiple` (e.g. `getComic(title, { multiple })` where `multiple: boolean` comes from a variable rather than an inline `true`/`false`). TypeScript's overload resolution only matched the literal `true`/`false` shapes, so forwarding a `boolean`-typed value produced `TS2769: No overload matches this call`. A third overload accepting `multiple?: boolean` (returning the union of both result types) now covers this case, while calls using a literal `true`/`false`/omitted `multiple` keep their existing precise return type.

## 0.19.0

### Minor Changes

- 6f37e73: Export `WikiPlugin`, a type representing a wiki client extended by any registered plugin. Lets consumers type collections of plugin clients (e.g. `Map<string, WikiPlugin>`) without instantiating a client solely for type inference.

## 0.18.0

### Minor Changes

- 29fe29c: Fix `dc-fandom`/`marvel-fandom` comics resolving `cover` from MediaWiki's auto-picked `page.thumbnail`, which doesn't reliably pick the actual cover (e.g. it can resolve to a gallery-embedded video's thumbnail instead). `cover` now resolves from the infobox's own cover field (`Image` for `dc-fandom`, `Image1` for `marvel-fandom`) via a new `Wiki.getFileUrl(fileName, width?)` client method, falling back to `page.thumbnail` when the infobox field is missing or unresolvable.

## 0.17.0

### Minor Changes

- e4ca4e0: Add `marvel-fandom` plugin, mirroring `dc-fandom`'s comic/volume/character lookups against `https://marvel.fandom.com`, adapted for Marvel Fandom's infobox schema (combined `ReleaseDate` field, `Event1`, and title-derived volume/issue fallback).

## 0.16.0

### Minor Changes

- dea76cd: Added an `allowCache` option to `WikiOptions` (default: `true`) that, when set to `false`, disables the client's in-memory response cache entirely.
- 8ab5df2: Added an optional `fields` flag to `getComic`, `getComicById`, `getVolume`, `getVolumeById`, `getCharacter`, `getCharacterById`, `getCharacterAppearances`, and the `getComics`/`getAppearances` result accessors, letting consumers request only the properties they need. When provided, unrequested fields are skipped entirely rather than computed and discarded, reducing internal parsing work for large results. Omitting the flag preserves today's full-object behavior.

## 0.15.0

### Minor Changes

- 9560639: `WikiPage`, `WikiComic`, `WikiVolume`, and `WikiCharacter` now carry a `sourceWiki` field with the base URL of the wiki the object was fetched from, so results merged from multiple `wiki()` clients can be traced back to their origin.

## 0.14.1

### Patch Changes

- afb739c: `WikiVolume.getComics` and `resolveVolumeComics` now accept and forward `thumbnailSize`, `includeCollections`, and `category`, in addition to `sorted`, matching the flags supported by `getComic`.

## 0.14.0

### Minor Changes

- 88daf3e: Add `WikiVolume.getComics({ sorted? })`, resolving a volume's `issueList` into full `WikiComic` objects.

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
