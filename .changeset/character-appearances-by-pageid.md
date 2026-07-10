---
'better-wiki': minor
---

`getCharacterAppearances` now also accepts a MediaWiki page ID as its first argument, resolving the page's title before looking up its `Category:<title>/Appearances` members. Previously only a `characterTitle: string` was accepted, requiring callers with just a page ID to resolve the title themselves first — matching the existing `getComicById`/`getVolumeById`/`getPageById` pattern of supporting both a string and a pageId lookup.
