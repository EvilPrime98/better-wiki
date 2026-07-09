---
'better-wiki': minor
---

Add a `thumbnail` field to `WikiCharacter`, populated from the resolved page thumbnail URL (same mechanism already used by `WikiComic.cover` and `WikiVolume.thumbnail`). The existing `image` field is unchanged and still reflects the raw infobox `Image` value. Pass `flags.thumbnailSize` to `getCharacter`/`getCharacterById` to scale the thumbnail URL; it is populated at a default width otherwise.
