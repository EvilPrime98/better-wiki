# better-wiki

[![npm version](https://img.shields.io/npm/v/better-wiki.svg)](https://www.npmjs.com/package/better-wiki)
[![CI](https://github.com/EvilPrime98/better-wiki/actions/workflows/ci.yml/badge.svg)](https://github.com/EvilPrime98/better-wiki/actions/workflows/ci.yml)

A typed, cache-aware client for [MediaWiki](https://www.mediawiki.org/wiki/API:Main_page) /
[Fandom](https://www.fandom.com/) wikis. Wraps the `api.php` endpoint with typed responses,
in-memory caching, and resilient HTTP.

## Features

- Typed responses — every method returns a typed result.
- Built-in caching — identical requests are served from an in-memory cache (TTL configurable).
- Resilient HTTP — sends a `User-Agent`, aborts slow requests, and retries with backoff.
- ESM, tree-shakeable — ships ES modules with declaration maps.

## Installation

```bash
npm install better-wiki
```

Requires Node.js 18+ (for the global `fetch`/`AbortController`), or any modern browser.

## Quick start

```ts
import { wiki } from 'better-wiki';

const client = wiki('https://dc.fandom.com');

// Search pages
const pages = await client.getPage('Absolute Superman');
const page = pages[0];

// Infobox and images
const infobox = await page.getInfobox();
const images = await page.getImages(300); // optional width to scale URLs

// Lookup by title or ID
const exact = await client.getPageByTitle('Absolute Superman Vol 1 1');
const byId  = await client.getPageById(123456);

// Categories
const members = await client.getPagesByCategory('Category:DC Comics characters');

// Raw wikitext or structured infobox key/value map
const wikitext   = await client.getPageContent(page.id);
const structured = await client.getPageContent(page.id, { structured: true });
```

## Configuration

`wiki(url, options)` accepts an options object (all fields optional):

| Option      | Type      | Default             | Description                                                     |
| ----------- | --------- | ------------------- | --------------------------------------------------------------- |
| `CACHE_TTL` | `number`  | `300000` (5 min)    | How long, in ms, an API response stays cached.                  |
| `userAgent` | `string`  | `better-wiki (...)` | `User-Agent` header sent with every request.                    |
| `timeout`   | `number`  | `15000`             | Abort a request after this many ms.                             |
| `retries`   | `number`  | `2`                 | Number of retries (with backoff) on a failed/timed-out request. |
| `publisher` | `string`  | `''`                | Publisher name included in series-related data.                 |

```ts
const client = wiki('https://dc.fandom.com', {
  CACHE_TTL: 60_000,
  userAgent: 'my-app/1.0 (contact@example.com)',
});
```

## API

### `wiki(url, options?)` → `Wiki`

Factory function — returns a `Wiki` client for the given wiki URL.

### Client methods

| Method | Returns |
| --- | --- |
| `getPage(query, flags?)` | `WikiPage[]` — full-text search results |
| `getPageById(pageId, flags?)` | `WikiPage \| null` |
| `getPageByTitle(title, flags?)` | `WikiPage \| null` |
| `getPagesByCategory(category)` | `WikiPage[]` |
| `getPageContent(pageId)` | `string \| undefined` — raw wikitext |
| `getPageContent(pageId, { structured: true })` | `Record<string, string>` — parsed infobox |
| `getCategoryMembers(categoryTitle)` | `Array<{ pageid, ns, title }>` |
| `searchCategories(query)` | `string[]` |
| `getCategoriesFromPage(pageId)` | `Array<{ ns, title }>` |
| `clearCache()` | `void` |

Pass `flags: { category: string[] }` to any page-fetching method to filter results to pages
belonging to all listed categories.

### `WikiPage` instance methods

| Method | Returns |
| --- | --- |
| `getInfobox()` | `Record<string, string>` — infobox key/value pairs |
| `getImages(width?)` | `string[]` — image URLs, optionally scaled |
| `getGallery(width?)` | `string[]` — gallery image URLs |
| `getPageContent()` | `string \| undefined` — raw wikitext |
| `getStructuredContent()` | `Record<string, string>` — first infobox template, parsed |

## Development

```bash
pnpm install
pnpm test         # run the unit tests (mocking fetch)
pnpm run lint     # eslint + prettier
pnpm run build    # emit dist/
```

## License

MIT
