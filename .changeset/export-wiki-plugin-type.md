---
'better-wiki': minor
---

Export `WikiPlugin`, a type representing a wiki client extended by any registered plugin. Lets consumers type collections of plugin clients (e.g. `Map<string, WikiPlugin>`) without instantiating a client solely for type inference.
