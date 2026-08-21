---
'better-wiki': patch
---

Speed up `getPage` (and `getComic`/`getVolume`/`getCharacter`, which call it internally) when searching with `category`/`categoriesOr` flags. Previously, filtering search results by category meant fetching each candidate page's entire category list (often 40-90 entries) in a separate request, then paginating through search results one page at a time until enough matches accumulated. Category checks are now restricted (via MediaWiki's `clcategories` param) to just the categories being filtered on and folded into the same request as the search itself, and once filtering is active, subsequent search pages are fetched concurrently in growing batches instead of one at a time. On a representative query this cut `getComic('batman', { multiple: true })` from ~11s to ~3-4s.

Behavior note: as a result of fetching only the filtered categories, `WikiPage.categories` on results from a `category`/`categoriesOr`-filtered `getPage` call now contains only the categories that matched the filter, rather than the page's full category list. Unfiltered `getPage` calls are unaffected.

Since MediaWiki still caps categories at 500 total per request shared across every page in a batch (the same limit that caused the truncation fixed in a prior release), a `clcontinue` on the response is now detected and treated as a signal to re-fetch that batch's categories through the complete, paginated path rather than trust a possibly-truncated inline result — this only adds requests back in the rare case a very large `limit` combined with several filter categories pushes past that cap.
