---
'better-wiki': patch
---

Speed up `getCategoryMembers` for callers that only need the first N results (e.g. `.slice(0, limit)`). It now accepts a `limit` flag: for a single category, pagination stops as soon as enough members are collected instead of always walking the entire category via `cmcontinue`. For multiple categories, the first category is fetched and category-checked in growing batches (same wave pattern used to speed up category-filtered `getPage` in a prior release) until `limit` filtered matches are found, instead of pre-fetching and category-checking the entire first category up front.

Behavior note: when `limit` is supplied for a single category, `getCategoryMembers` may issue smaller `cmlimit` requests than the previous fixed `500` — this only affects how many members are requested per page, not which members are returned. Calls without `limit` are unaffected.
