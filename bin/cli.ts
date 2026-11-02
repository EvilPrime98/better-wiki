#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { wiki } from '../src/index.js';
import type { PluginName, Wiki, WikiOptions } from '../src/index.js';

type Flags = Record<string, unknown>;
type Method = (...args: unknown[]) => Promise<unknown>;
type PluginMethods = Record<
  | 'getComic'
  | 'getComicById'
  | 'getVolume'
  | 'getVolumeById'
  | 'getCharacter'
  | 'getCharacterById'
  | 'getCharacterAppearances',
  Method
>;
type Client = Wiki & Partial<PluginMethods>;
type Handler = (c: Client, a: string[], f: Flags) => Promise<unknown>;

const PLUGIN_NAMES = ['dc-fandom', 'marvel-fandom'] as const satisfies readonly PluginName[];

const HELP = `better-wiki - query MediaWiki/Fandom wikis from the command line.

Usage:
  better-wiki [options] <command> [arguments]

Connection (--plugin and/or --url is required):
  -p, --plugin <name>        Built-in plugin: ${PLUGIN_NAMES.join(' | ')}
  -u, --url <url>            Wiki base URL (overrides the plugin's default URL)
      --cache-ttl <ms>       Response cache TTL (default 300000)
      --no-cache             Disable the response cache
      --user-agent <string>  User-Agent header
      --timeout <ms>         Per-request timeout (default 15000)
      --retries <n>          Retries on failure (default 2)
      --publisher <name>     Publisher reported in series data
      --debug                Log diagnostics to stderr

Output:
      --compact              Print minified JSON instead of pretty-printed
  -h, --help                 Show help
  -v, --version              Show version

Base commands (any wiki):
  page <query>               Search pages            [--category --categories-or --thumbnail-size --limit]
  page-by-id <id...>         Fetch pages by ID       [--thumbnail-size]
  page-by-title <title>      Fetch page by title     [--category --thumbnail-size]
  category-pages <category>  All pages in category   [--thumbnail-size]
  thumbnail <id>             Page thumbnail URL      [--width]
  file-url <fileName>        File URL                [--width]
  content <id>               Raw wikitext            [--structured]
  category-members <cat...>  Category members        [--limit]  (several = intersection)
  search-categories <query>  Search category titles
  page-categories <id>       Categories of a page
  infobox <id>               Page infobox (parse API)
  structured-content <id>    Page infobox template as key/value map
  images <id>                Image URLs in a page    [--width]
  gallery <id>               Image URLs in /Gallery  [--width]

Plugin commands (require --plugin):
  comic <query>              [--multiple --limit --category --include-collections --sorted --thumbnail-size --fields]
  comic-by-id <id...>        [--thumbnail-size --fields]
  volume <query>             [--multiple --limit --thumbnail-size --fields]
  volume-by-id <id...>       [--thumbnail-size --fields]
  character <query>          [--multiple --limit --category --thumbnail-size --fields]
  character-by-id <id...>    [--thumbnail-size --fields]
  character-appearances <titleOrId>  [--sorted --fields]

Flags:
      --category <c>         Required category (repeatable)
      --categories-or <c>    At-least-one category (repeatable)
      --thumbnail-size <px>  Image width in pixels
      --limit <n>            Max results
      --multiple             Return all matches
      --include-collections  Also match Category:Collected Editions
      --sorted               Sort by release date
      --fields <a,b,c>       Only compute these fields (dc-fandom only)
      --structured           Return infobox key/value map instead of wikitext
      --width <px>           Image width for thumbnail/file-url/images/gallery

Examples:
  better-wiki -p dc-fandom comic "Action Comics #1000 (2018)"
  better-wiki -p marvel-fandom character "Peter Parker" --multiple --limit 5
  better-wiki -u https://starwars.fandom.com page "Luke Skywalker"
  better-wiki -p dc-fandom character-appearances "Batman (Bruce Wayne)" --sorted --fields title,releaseDate
`;

class UsageError extends Error {}

function readVersion(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 5; i++) {
    const file = join(dir, 'package.json');
    if (existsSync(file)) {
      const pkg = JSON.parse(readFileSync(file, 'utf8')) as { name?: string; version?: string };
      if (pkg.name === 'better-wiki' && pkg.version) return pkg.version;
    }
    dir = dirname(dir);
  }
  return 'unknown';
}

const num = (v: unknown, name: string): number | undefined => {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n))
    throw new UsageError(`--${name} must be a number, got ${JSON.stringify(v)}`);
  return n;
};

const id = (v: string): number => {
  const n = Number(v);
  if (!Number.isInteger(n)) throw new UsageError(`Expected a numeric page ID, got "${v}"`);
  return n;
};

const ids = (a: string[]): number | number[] => (a.length === 1 ? id(a[0]!) : a.map(id));

const need = (args: string[], count: number, usage: string): void => {
  if (args.length < count) throw new UsageError(`Usage: better-wiki ${usage}`);
};

/** Builds a flags object from the given CLI flags, omitting unset ones (exactOptionalPropertyTypes). */
function buildFlags(f: Flags, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const has = (k: string) => keys.includes(k);

  if (has('thumbnailSize')) {
    const n = num(f['thumbnail-size'], 'thumbnail-size');
    if (n !== undefined) out['thumbnailSize'] = n;
  }
  if (has('limit')) {
    const n = num(f['limit'], 'limit');
    if (n !== undefined) out['limit'] = n;
  }
  if (has('category') && (f['category'] as string[] | undefined)?.length)
    out['category'] = f['category'];
  if (has('categoriesOr') && (f['categories-or'] as string[] | undefined)?.length)
    out['categoriesOr'] = f['categories-or'];
  if (has('multiple') && f['multiple'] === true) out['multiple'] = true;
  if (has('includeCollections') && f['include-collections'] === true)
    out['includeCollections'] = true;
  if (has('sorted') && f['sorted'] === true) out['sorted'] = true;
  if (has('fields') && typeof f['fields'] === 'string')
    out['fields'] = f['fields']
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  return out;
}

const plugin = (c: Client, name: keyof PluginMethods): Method => {
  const m = c[name];
  if (!m) throw new UsageError(`"${name}" requires --plugin (${PLUGIN_NAMES.join(' | ')}).`);
  return m;
};

const pageOrThrow = async (c: Client, pageId: number) => {
  const page = await c.getPageById(pageId);
  if (!page) throw new Error(`Page ${pageId} not found.`);
  return page;
};

const COMMANDS: Record<string, Handler> = {
  page: async (c, a, f) => {
    need(a, 1, 'page <query>');
    return c.getPage(
      a.join(' '),
      buildFlags(f, ['category', 'categoriesOr', 'thumbnailSize', 'limit']),
    );
  },
  'page-by-id': async (c, a, f) => {
    need(a, 1, 'page-by-id <id...>');
    const target = ids(a);
    const flags = buildFlags(f, ['thumbnailSize']);
    return typeof target === 'number' ? c.getPageById(target, flags) : c.getPageById(target, flags);
  },
  'page-by-title': async (c, a, f) => {
    need(a, 1, 'page-by-title <title>');
    return c.getPageByTitle(a.join(' '), buildFlags(f, ['category', 'thumbnailSize']));
  },
  'category-pages': async (c, a, f) => {
    need(a, 1, 'category-pages <category>');
    return c.getPagesByCategory(a.join(' '), buildFlags(f, ['thumbnailSize']));
  },
  thumbnail: async (c, a, f) => {
    need(a, 1, 'thumbnail <id> [--width px]');
    return c.getThumbnailById(id(a[0]!), num(f['width'], 'width'));
  },
  'file-url': async (c, a, f) => {
    need(a, 1, 'file-url <fileName> [--width px]');
    return c.getFileUrl(a.join(' '), num(f['width'], 'width'));
  },
  content: async (c, a, f) => {
    need(a, 1, 'content <id> [--structured]');
    return f['structured'] === true
      ? c.getPageContent(id(a[0]!), { structured: true })
      : c.getPageContent(id(a[0]!));
  },
  'category-members': async (c, a, f) => {
    need(a, 1, 'category-members <category...> [--limit n]');
    const flags = buildFlags(f, ['limit']);
    return a.length === 1 ? c.getCategoryMembers(a[0]!, flags) : c.getCategoryMembers(a, flags);
  },
  'search-categories': async (c, a) => {
    need(a, 1, 'search-categories <query>');
    return c.searchCategories(a.join(' '));
  },
  'page-categories': async (c, a) => {
    need(a, 1, 'page-categories <id>');
    return c.getCategoriesFromPage(id(a[0]!));
  },
  infobox: async (c, a) => {
    need(a, 1, 'infobox <id>');
    return (await pageOrThrow(c, id(a[0]!))).getInfobox();
  },
  'structured-content': async (c, a) => {
    need(a, 1, 'structured-content <id>');
    return (await pageOrThrow(c, id(a[0]!))).getStructuredContent();
  },
  images: async (c, a, f) => {
    need(a, 1, 'images <id> [--width px]');
    return (await pageOrThrow(c, id(a[0]!))).getImages(num(f['width'], 'width'));
  },
  gallery: async (c, a, f) => {
    need(a, 1, 'gallery <id> [--width px]');
    return (await pageOrThrow(c, id(a[0]!))).getGallery(num(f['width'], 'width'));
  },
};

const pluginCommands = (name: string | undefined): Record<string, Handler> => {
  /** `fields` is only implemented by dc-fandom; fail loudly instead of silently ignoring it. */
  const guard = (f: Flags): void => {
    if (f['fields'] !== undefined && name !== 'dc-fandom')
      throw new UsageError('--fields is only supported by the dc-fandom plugin.');
  };

  return {
    comic: async (c, a, f) => {
      need(a, 1, 'comic <query>');
      guard(f);
      return plugin(c, 'getComic')(
        a.join(' '),
        buildFlags(f, [
          'thumbnailSize',
          'includeCollections',
          'category',
          'sorted',
          'multiple',
          'limit',
          'fields',
        ]),
      );
    },
    'comic-by-id': async (c, a, f) => {
      need(a, 1, 'comic-by-id <id...>');
      guard(f);
      return plugin(c, 'getComicById')(ids(a), buildFlags(f, ['thumbnailSize', 'fields']));
    },
    volume: async (c, a, f) => {
      need(a, 1, 'volume <query>');
      guard(f);
      return plugin(c, 'getVolume')(
        a.join(' '),
        buildFlags(f, ['thumbnailSize', 'multiple', 'limit', 'fields']),
      );
    },
    'volume-by-id': async (c, a, f) => {
      need(a, 1, 'volume-by-id <id...>');
      guard(f);
      return plugin(c, 'getVolumeById')(ids(a), buildFlags(f, ['thumbnailSize', 'fields']));
    },
    character: async (c, a, f) => {
      need(a, 1, 'character <query>');
      guard(f);
      return plugin(c, 'getCharacter')(
        a.join(' '),
        buildFlags(f, ['thumbnailSize', 'category', 'multiple', 'limit', 'fields']),
      );
    },
    'character-by-id': async (c, a, f) => {
      need(a, 1, 'character-by-id <id...>');
      guard(f);
      return plugin(c, 'getCharacterById')(ids(a), buildFlags(f, ['thumbnailSize', 'fields']));
    },
    'character-appearances': async (c, a, f) => {
      need(a, 1, 'character-appearances <titleOrId>');
      guard(f);
      const target = a.length === 1 && /^\d+$/.test(a[0]!) ? Number(a[0]) : a.join(' ');
      return plugin(c, 'getCharacterAppearances')(target, buildFlags(f, ['sorted', 'fields']));
    },
  };
};

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    strict: true,
    options: {
      plugin: { type: 'string', short: 'p' },
      url: { type: 'string', short: 'u' },
      'cache-ttl': { type: 'string' },
      'no-cache': { type: 'boolean' },
      'user-agent': { type: 'string' },
      timeout: { type: 'string' },
      retries: { type: 'string' },
      publisher: { type: 'string' },
      debug: { type: 'boolean' },
      compact: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
      category: { type: 'string', multiple: true },
      'categories-or': { type: 'string', multiple: true },
      'thumbnail-size': { type: 'string' },
      limit: { type: 'string' },
      multiple: { type: 'boolean' },
      'include-collections': { type: 'boolean' },
      sorted: { type: 'boolean' },
      fields: { type: 'string' },
      structured: { type: 'boolean' },
      width: { type: 'string' },
    },
  });

  if (values.version) {
    console.log(readVersion());
    return;
  }
  const [command, ...args] = positionals;
  if (values.help || !command || command === 'help') {
    console.log(HELP);
    return;
  }

  const options: WikiOptions = {};
  const ttl = num(values['cache-ttl'], 'cache-ttl');
  if (ttl !== undefined) options.CACHE_TTL = ttl;
  if (values['no-cache']) options.allowCache = false;
  if (values['user-agent']) options.userAgent = values['user-agent'];
  const timeout = num(values.timeout, 'timeout');
  if (timeout !== undefined) options.timeout = timeout;
  const retries = num(values.retries, 'retries');
  if (retries !== undefined) options.retries = retries;
  if (values.publisher !== undefined) options.publisher = values.publisher;
  if (values.debug) options.debug = true;

  const pluginName = values.plugin;
  if (pluginName !== undefined && !(PLUGIN_NAMES as readonly string[]).includes(pluginName))
    throw new UsageError(`Unknown plugin "${pluginName}". Available: ${PLUGIN_NAMES.join(', ')}.`);

  const handler = { ...COMMANDS, ...pluginCommands(pluginName) }[command];
  if (!handler) throw new UsageError(`Unknown command "${command}". Run with --help.`);

  let client: Client;
  if (pluginName !== undefined) {
    client = wiki({
      ...options,
      plugin: pluginName as PluginName,
      ...(values.url ? { url: values.url } : {}),
    }) as unknown as Client;
  } else if (values.url) {
    client = wiki(values.url, options);
  } else {
    throw new UsageError('Provide --plugin <name> or --url <wikiUrl>.');
  }

  const result = await handler(client, args, values as Flags);
  console.log(JSON.stringify(result ?? null, null, values.compact ? 0 : 2));
}

main().catch((err: unknown) => {
  const code = (err as { code?: string }).code;
  const usage = err instanceof UsageError || code?.startsWith('ERR_PARSE_ARGS');
  console.error(`better-wiki: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = usage ? 2 : 1;
});
