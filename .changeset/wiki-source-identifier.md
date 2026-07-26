---
'better-wiki': minor
---

`WikiPage`, `WikiComic`, `WikiVolume`, and `WikiCharacter` now carry a `sourceWiki` field with the base URL of the wiki the object was fetched from, so results merged from multiple `wiki()` clients can be traced back to their origin.
