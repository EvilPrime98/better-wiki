---
'better-wiki': patch
---

Fix `getComic(query)` (single-result overload) to return `null` when no matching page is found, instead of a fully-defaulted `WikiComic` object with `pageId: -1` and empty fields. This aligns behavior with the method's documented `WikiComic | null` return type and matches the existing zero-match guard already used in `getCharacter` and `getVolume`.

Consumers that previously detected "no match" by checking `pageId === -1` should switch to checking for `null`.
