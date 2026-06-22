---
'better-wiki': minor
---

Add first-party plugin system with dc-fandom plugin.

`wiki({ plugin: 'dc-fandom' })` returns a `Wiki` client extended with `getComic`, `getComicById`, `getVolume`, and `getVolumeById` — typed methods for fetching DC Fandom comic and volume data. Plugin types (`WikiComic`, `WikiVolume`, `WikiCredits`, etc.) are now exported from the package root.
