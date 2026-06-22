---
'better-wiki': minor
---

Add `categoriesOr` flag for OR-based category filtering, migrate dc-fandom scorer to fuse.js.

- `WikiPageFlags` now accepts `categoriesOr: string[]` — filters pages matching **any** of the listed categories (OR). The existing `category` flag retains AND semantics.
- Removes `category` from `getPageById` flags (filtering a page you already have by ID is a no-op).
- `getComic` now matches `Category:Collected Editions` in addition to `Category:Comics`.
- `getComic` and `getVolume` overloads now expose `thumbnailSize` in their typed signatures.
- Replaces hand-rolled fuzzy scorer in dc-fandom with fuse.js, preserving year, recency-bias, and number-suffix boosters.
