---
'better-wiki': minor
---

Fix `getComic`/`getVolume`/`getCharacter` on `dc-fandom` and `marvel-fandom` plugin clients rejecting a non-literal `boolean` passed to `multiple` (e.g. `getComic(title, { multiple })` where `multiple: boolean` comes from a variable rather than an inline `true`/`false`). TypeScript's overload resolution only matched the literal `true`/`false` shapes, so forwarding a `boolean`-typed value produced `TS2769: No overload matches this call`. A third overload accepting `multiple?: boolean` (returning the union of both result types) now covers this case, while calls using a literal `true`/`false`/omitted `multiple` keep their existing precise return type.
