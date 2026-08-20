---
'better-wiki': minor
---

Fix `getComic(query, { multiple: true })` (and `getVolume`/`getCharacter`) on the `dc-fandom` and `marvel-fandom` plugin clients returning far fewer results than exist for broad/generic queries. The underlying `getPage` search fetched only 20 raw relevance-ranked results before category filtering was applied, so a broad single-word query (e.g. `"superman"`) could lose almost all real matches to the filter, while a longer, more specific query survived mostly intact — masking the bug. `getComic`, `getVolume`, and `getCharacter` now accept a `limit` flag (like the base `getPage`), and default it to 50 when `multiple: true` is requested without an explicit `limit`, raising the raw search window enough to survive category filtering on broad queries. An explicit `limit` always overrides the default.
