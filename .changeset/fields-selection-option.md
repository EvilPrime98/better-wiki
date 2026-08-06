---
'better-wiki': minor
---

Added an optional `fields` flag to `getComic`, `getComicById`, `getVolume`, `getVolumeById`, `getCharacter`, `getCharacterById`, `getCharacterAppearances`, and the `getComics`/`getAppearances` result accessors, letting consumers request only the properties they need. When provided, unrequested fields are skipped entirely rather than computed and discarded, reducing internal parsing work for large results. Omitting the flag preserves today's full-object behavior.
