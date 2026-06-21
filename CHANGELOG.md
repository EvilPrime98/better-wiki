# better-wiki

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
