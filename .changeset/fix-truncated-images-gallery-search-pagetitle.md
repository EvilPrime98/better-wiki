---
'better-wiki': patch
---

Fix `getPageByTitle`, `getImages`, `getGallery`, and `searchCategories` silently truncating results, the same class of bug fixed for `getPage` in 3edfc30. Each issued a MediaWiki API call using a fixed/`max` `*limit` parameter with no continuation loop, so wikis with more items than that cap (categories, embedded images, gallery images, or search matches) got a partial, truncated result with no signal that data was dropped. All four now paginate via their respective continuation token (`clcontinue`, `gimcontinue`, `imcontinue`, `sroffset`) until MediaWiki's `continue` field is exhausted, mirroring the existing pattern already used by `membersForCategory` and `getCategoriesForPages`.
