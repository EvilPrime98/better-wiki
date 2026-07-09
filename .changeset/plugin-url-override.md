---
'better-wiki': minor
---

Allow overriding a plugin's target wiki URL via `wiki({ plugin: 'dc-fandom', url: '...' })`. Previously the URL was hardcoded per-plugin with no way to point it elsewhere. Without `url`, behavior is unchanged (falls back to the plugin's default wiki). Plugin parsing logic is coupled to its default wiki's schema (infobox field names, category names), so results against a different wiki may be partial or empty rather than erroring — documented in the `wiki()` JSDoc, `dcFandomPlugin`'s JSDoc, and the README.
