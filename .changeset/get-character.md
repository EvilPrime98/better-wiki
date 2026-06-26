---
'better-wiki': minor
---

Add `getCharacter`, `getCharacterById`, and a `sorted` flag for multiple `getComic` results.

- `dcFandomPlugin` exposes `getCharacter(query, flags?)` and `getCharacterById(pageId, flags?)`, returning a typed `WikiCharacter` (bio fields, parsed `history` sections, powers/abilities/equipment lists, optional `quotation`).
- Each `WikiCharacter` carries `getAppearances({ sorted? })`, fetching the character's Appearances comics with optional chronological sort.
- `getComic(query, { multiple: true })` now accepts `sorted` to return comics ordered by release date.
