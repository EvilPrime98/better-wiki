---
'better-wiki': patch
---

Fix `getPage` silently truncating category data on broad searches. Categories were previously requested inline with the initial search query (`cllimit: 'max'`), which caps the response at 500 categories shared across _all_ returned pages combined — so pages with truncated (but non-empty) category lists were never detected or refetched. Category lookups now always go through the dedicated `getCategoriesForPages` helper, which paginates via `clcontinue` per page batch and always returns the complete category list.
