---
'better-wiki': minor
---

Extend thumbnail support to `getPageById`, `getPageByTitle`, and `getPagesByCategory`.

All three methods now accept `flags.thumbnailSize` and populate the `WikiPage.thumbnail` field from the API response, consistent with `getPage`.
