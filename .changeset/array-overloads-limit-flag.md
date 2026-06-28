---
'better-wiki': minor
---

Add array overloads to `getPageById`, `getComicById`, `getVolumeById`, and `getCategoryMembers`; add `limit` flag to `getPage` and `getCategoryMembers`; `getCategoryMembers(string[])` now returns the intersection (members of the first category that belong to all remaining ones).
