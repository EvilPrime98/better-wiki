---
'better-wiki': patch
---

Normalize `WikiComic.releaseDate` in the `dc-fandom` plugin. `releaseMonth` is now a zero-padded numeric string (`"03"`) instead of the raw infobox month name (`"March"`), and `releaseDay` is zero-padded to two digits, matching the shape the `marvel-fandom` plugin already returns. An unrecognized month value (for example a season such as `"Spring"`) yields an empty string. This also fixes month-level ordering in `byReleaseDate`, which previously coerced the month name to `NaN` and collapsed every comic to the same month.
