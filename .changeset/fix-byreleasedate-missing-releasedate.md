---
'better-wiki': patch
---

Fix a `TypeError` in the `dc-fandom` plugin when `sorted: true` was combined with a `fields` list that omitted `releaseDate`. `byReleaseDate` now tolerates a missing `releaseDate` (or missing/non-numeric parts), treating it as epoch `0` so undated comics sort first instead of throwing. Additionally, every `sorted: true` code path (`getComic({ multiple: true })`, `WikiVolume.getComics()`, `getCharacterAppearances`, and a character's `getAppearances()`) now selects `releaseDate` internally when sorting so the order stays meaningful, then strips it from the results if it wasn't in the caller's `fields` — the returned objects still contain only the requested keys.
