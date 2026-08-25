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
const byId = await client.getPageById(123456);

// Categories
const members = await client.getPagesByCategory('Category:DC Comics characters');

// Raw wikitext or structured infobox key/value map
const wikitext = await client.getPageContent(page.id);
const structured = await client.getPageContent(page.id, { structured: true });
```

## Configuration

`wiki(url, options)` accepts an options object (all fields optional):

| Option       | Type      | Default             | Description                                                                          |
| ------------ | --------- | ------------------- | ------------------------------------------------------------------------------------ |
| `CACHE_TTL`  | `number`  | `300000` (5 min)    | How long, in ms, an API response stays cached. Ignored when `allowCache` is `false`. |
| `allowCache` | `boolean` | `true`              | When `false`, disables the in-memory response cache entirely.                        |
| `userAgent`  | `string`  | `better-wiki (...)` | `User-Agent` header sent with every request.                                         |
| `timeout`    | `number`  | `15000`             | Abort a request after this many ms.                                                  |
| `retries`    | `number`  | `2`                 | Number of retries (with backoff) on a failed/timed-out request.                      |
| `publisher`  | `string`  | `''`                | Publisher name included in series-related data.                                      |

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

| Method                                         | Returns                                                                                                                                                          |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getPage(query, flags?)`                       | `WikiPage[]` — full-text search results                                                                                                                          |
| `getPageById(pageId, flags?)`                  | `WikiPage \| null`                                                                                                                                               |
| `getPageById(pageIds[], flags?)`               | `WikiPage[]` — batch lookup by IDs                                                                                                                               |
| `getPageByTitle(title, flags?)`                | `WikiPage \| null`                                                                                                                                               |
| `getPagesByCategory(category, flags?)`         | `WikiPage[]`                                                                                                                                                     |
| `getPageContent(pageId)`                       | `string \| undefined` — raw wikitext                                                                                                                             |
| `getPageContent(pageId, { structured: true })` | `Record<string, string>` — parsed infobox                                                                                                                        |
| `getCategoryMembers(categoryTitle, flags?)`    | `WikiCategoryMemberItem[]` — `flags.limit` stops pagination once enough members are fetched                                                                      |
| `getCategoryMembers(titles[], flags?)`         | `WikiCategoryMemberItem[]` — intersection across titles, read left to right; put the most-narrowing category first. `flags.limit` caps the filtered result count |
| `searchCategories(query)`                      | `string[]`                                                                                                                                                       |
| `getCategoriesFromPage(pageId)`                | `Array<{ ns, title }>`                                                                                                                                           |
| `getThumbnailById(pageId, width?)`             | `string` — thumbnail URL, optionally scaled to `width` px                                                                                                        |
| `getFileUrl(fileName, width?)`                 | `string` — resolves a wiki filename (e.g. `Image1.jpg`, no `File:` prefix) to its URL, optionally scaled to `width` px                                           |
| `clearCache()`                                 | `void`                                                                                                                                                           |

Pass `flags` to any page-fetching method to filter or augment results:

| Flag            | Type       | Description                                                               |
| --------------- | ---------- | ------------------------------------------------------------------------- |
| `category`      | `string[]` | Filter results to pages belonging to **all** listed categories (AND).     |
| `categoriesOr`  | `string[]` | Filter results to pages belonging to **any** listed category (OR).        |
| `thumbnailSize` | `number`   | Scale thumbnail URLs to this width (px) when building `WikiPage` results. |
| `limit`         | `number`   | Cap the number of results returned (default: 20 for `getPage`).           |

> When `category`/`categoriesOr` is passed to `getPage` (including indirectly, via plugin
> methods like `getComic`), each result's `categories` field is restricted to just the
> categories that matched the filter, not the page's full category list — this keeps
> filtered searches fast. Call `getCategoriesFromPage` for a page's complete category list.

### `WikiPage` properties

| Property       | Type       | Description                                            |
| -------------- | ---------- | ------------------------------------------------------ |
| `id`           | `number`   | MediaWiki page ID.                                     |
| `title`        | `string`   | Page title.                                            |
| `thumbnail`    | `string`   | Thumbnail URL (empty string if the page has no image). |
| `categories`   | `string[]` | Category titles the page belongs to (see note above).  |
| `canonicalUrl` | `string`   | Canonical URL of the page.                             |
| `sourceWiki`   | `string`   | Base URL of the wiki this page was fetched from.       |

### `WikiSearchGeneratorPageItem` properties

Raw page shape returned by the search generator (before `WikiPage` is constructed).

| Property       | Type                                   | Description                                                 |
| -------------- | -------------------------------------- | ----------------------------------------------------------- |
| `pageid`       | `number`                               | MediaWiki page ID.                                          |
| `ns`           | `number`                               | MediaWiki namespace ID.                                     |
| `title`        | `string`                               | Page title.                                                 |
| `index`        | `number`                               | Position in the search result set.                          |
| `thumbnail`    | `string`                               | Thumbnail URL (optional — absent if the page has no image). |
| `categories`   | `Array<{ ns: number; title: string }>` | Categories the page belongs to.                             |
| `canonicalUrl` | `string`                               | Canonical URL of the page.                                  |

### `WikiPage` instance methods

| Method                   | Returns                                                   |
| ------------------------ | --------------------------------------------------------- |
| `getInfobox()`           | `Record<string, string>` — infobox key/value pairs        |
| `getImages(width?)`      | `string[]` — image URLs, optionally scaled                |
| `getGallery(width?)`     | `string[]` — gallery image URLs                           |
| `getPageContent()`       | `string \| undefined` — raw wikitext                      |
| `getStructuredContent()` | `Record<string, string>` — first infobox template, parsed |

## Plugins

Plugins extend the base `Wiki` client with domain-specific methods. Pass `{ plugin }` instead of a URL — the plugin supplies the target wiki URL automatically.

```ts
import { wiki } from 'better-wiki';

const dc = wiki({ plugin: 'dc-fandom' });

// Fetch a comic by search query (picks the best match)
const comic = await dc.getComic('Batman #700 (2010)');
console.log(comic.credits.writers, comic.appearing.featuredCharacters);

// Fetch by page ID
const comicById = await dc.getComicById(123456);

// Fetch a volume
const volume = await dc.getVolume('Batman Vol 1');
const volumeById = await dc.getVolumeById(789);

// Multiple results
const allMatches = await dc.getComic('Batman', { multiple: true });
```

All base `Wiki` methods (`getPage`, `clearCache`, etc.) remain available on the returned client.

### Using a plugin against a different wiki

Pass `url` alongside `plugin` to point the plugin's methods at any MediaWiki instance instead of its default wiki:

```ts
const otherWiki = wiki({ plugin: 'dc-fandom', url: 'https://some-other.fandom.com' });
```

**Not all wikis are compatible with all plugins.** A plugin's parsing logic is written against its default wiki's specific infobox field names and category names (e.g. `dc-fandom` expects `Image`, `RealName`, `Category:Comics`, etc. on `dc.fandom.com`). Pointing a plugin at a wiki with a different schema will not throw, but its methods may return partial or empty results if that wiki's pages don't follow the same conventions.

### `dc-fandom` plugin

Targets `https://dc.fandom.com`. Adds:

| Method                                        | Returns                 | Description                                                          |
| --------------------------------------------- | ----------------------- | -------------------------------------------------------------------- |
| `getComic(query, flags?)`                     | `WikiComic \| null`     | Best-match comic by search query                                     |
| `getComic(query, { multiple: true })`         | `WikiComic[]`           | All matching comics                                                  |
| `getComicById(pageId, flags?)`                | `WikiComic \| null`     | Comic by MediaWiki page ID                                           |
| `getComicById(pageIds[], flags?)`             | `WikiComic[]`           | Batch comic lookup by IDs                                            |
| `getVolume(query, flags?)`                    | `WikiVolume \| null`    | Best-match volume by search query                                    |
| `getVolume(query, { multiple: true })`        | `WikiVolume[]`          | All matching volumes                                                 |
| `getVolumeById(pageId, flags?)`               | `WikiVolume \| null`    | Volume by MediaWiki page ID                                          |
| `getVolumeById(pageIds[], flags?)`            | `WikiVolume[]`          | Batch volume lookup by IDs                                           |
| `getCharacter(query, flags?)`                 | `WikiCharacter \| null` | Best-match character by search query                                 |
| `getCharacter(query, { multiple: true })`     | `WikiCharacter[]`       | All matching characters                                              |
| `getCharacterById(pageId, flags?)`            | `WikiCharacter \| null` | Character by MediaWiki page ID                                       |
| `getCharacterAppearances(title, { sorted })`  | `WikiComic[]`           | All comics in `Category:<title>/Appearances`                         |
| `getCharacterAppearances(pageId, { sorted })` | `WikiComic[]`           | Same, resolving the character's title from a MediaWiki page ID first |

A `WikiCharacter` carries bio fields (`realName`, `aliases`, `alignment`, …), parsed `history` sections, list fields (`powers`, `abilities`, `equipment`, …), an optional `quotation`, a `getAppearances({ sorted? })` method returning its Appearances comics, and `sourceWiki` — the base URL of the wiki it was fetched from.

A `WikiVolume` carries series metadata (`startDate`, `endDate`, `creators`, `storyArcs`, …), its raw `issueList` (title strings), a `getComics({ thumbnailSize?, includeCollections?, category?, sorted? })` method that resolves `issueList` into full `WikiComic` objects, forwarding those flags to the underlying `getComic` lookups, and `sourceWiki` — the base URL of the wiki it was fetched from.

A `WikiComic` likewise carries `sourceWiki` — the base URL of the wiki it was fetched from, useful when merging results across multiple `wiki()` clients.

`getComic` accepts additional flags:

| Flag                 | Type       | Description                                                                                                                                                                                                                                                                                                                            |
| -------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `thumbnailSize`      | `number`   | Scale cover thumbnail URLs to this width (px).                                                                                                                                                                                                                                                                                         |
| `includeCollections` | `boolean`  | Also match pages in `Category:Collected Editions` (default: comics only).                                                                                                                                                                                                                                                              |
| `category`           | `string[]` | AND-filter: result must belong to **all** listed categories in addition to the OR set.                                                                                                                                                                                                                                                 |
| `sorted`             | `boolean`  | With `multiple: true`, return comics ordered by release date (oldest first).                                                                                                                                                                                                                                                           |
| `limit`              | `number`   | Raise the number of raw search results considered before category filtering. With `multiple: true` and no explicit `limit`, defaults to 50 (up from the base 20) — broad/generic queries can otherwise lose real matches to filtering after only 20 raw hits. `getVolume` and `getCharacter` accept the same `limit` flag and default. |

Pass `flags.thumbnailSize` (number, px) to scale cover thumbnail URLs.

#### Selecting fields

Every `dc-fandom` lookup method (`getComic`, `getComicById`, `getVolume`, `getVolumeById`,
`getCharacter`, `getCharacterById`, `getCharacterAppearances`, plus a volume's `getComics()`
and a character's `getAppearances()`) accepts an optional `fields` flag, typed to the keys of
the method's result type (e.g. `(keyof WikiComic)[]` for comic lookups). When omitted, the
full object is returned as before (non-breaking default). When provided, only the requested
keys are computed and present on the result — unrequested keys are skipped entirely rather
than computed and discarded, so requesting a small field set also avoids the parsing work for
everything else. Methods on the result (`getComics`, `getAppearances`) are always present
regardless of `fields`, since they're accessors rather than data.

```ts
const comic = await dc.getComic('Batman #700 (2010)', { fields: ['cover', 'credits'] });
comic!.cover; // present
comic!.credits; // present
comic!.title; // undefined — not requested
```

All returned types (`WikiComic`, `WikiVolume`, `WikiCredits`, `WikiAppearingSection`, etc.) are exported from the package root for use in your own type annotations.

### `marvel-fandom` plugin

Targets `https://marvel.fandom.com`. Mirrors the `dc-fandom` plugin's method surface (`getComic`, `getComicById`, `getVolume`, `getVolumeById`, `getCharacter`, `getCharacterById`, `getCharacterAppearances`) and flags, adapted to Marvel Fandom's infobox conventions:

- `ReleaseDate` is a single combined field (e.g. `"June 6, 2018"`), parsed into `releaseDate.releaseDay/releaseMonth/releaseYear` instead of separate `Day`/`Month`/`Year` fields.
- `event` is read from `Event1` rather than `Event`.
- When a comic's infobox has no standalone `Volume`/`Issue` fields, they're parsed from the page title instead (e.g. `"Immortal Hulk Vol 1 1"`).

```ts
const marvel = wiki({ plugin: 'marvel-fandom' });
const comic = await marvel.getComic('Immortal Hulk #1 (2018)');
```

## Development

```bash
pnpm install
pnpm test         # run the unit tests (mocking fetch)
pnpm run lint     # eslint + prettier
pnpm run build    # emit dist/
```

## License

MIT
