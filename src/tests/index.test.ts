import { describe, it, expect, expectTypeOf, vi, beforeEach, afterEach } from 'vitest';
import { VERSION, wiki } from '../better-wiki.js';
import { isGeneratorPageItem } from '../predicates.types.js';
import type { WikiPlugin } from '../index.js';

const comicWikitextResponse = (pageid: number, title: string, wikitext: string) =>
  jsonResponse({
    query: {
      pages: {
        [String(pageid)]: {
          pageid,
          title,
          revisions: [{ slots: { main: { '*': wikitext } } }],
        },
      },
    },
  });

const comicMembersResponse = (members: { pageid: number; ns: number; title: string }[]) =>
  jsonResponse({ query: { categorymembers: members } });

const comicPageInfoResponse = (
  pages: Record<string, { pageid: number; canonicalurl?: string; thumbnail?: { source: string } }>,
) => jsonResponse({ query: { pages } });

const comicCategoriesResponse = (
  pageid: number,
  title: string,
  categories: { ns: number; title: string }[] = [],
) =>
  jsonResponse({
    batchcomplete: '',
    query: { pages: { [String(pageid)]: { pageid, ns: 0, title, categories } } },
    limits: { categories: 500 },
  });

type FetchStub = ReturnType<typeof vi.fn>;

const jsonResponse = (body: unknown, ok = true, status = 200): Response =>
  ({
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
  }) as Response;

let fetchMock: FetchStub;

const lastUrl = (): string => String(fetchMock.mock.calls.at(-1)![0]);

const lastInit = (): RequestInit => fetchMock.mock.calls.at(-1)![1] as RequestInit;

const membersResponse = (members: { pageid: number; ns: number; title: string }[]) =>
  jsonResponse({ query: { categorymembers: members } });

const categoriesResponse = (
  pages: Record<
    string,
    { pageid: number; ns: number; title: string; categories: { ns: number; title: string }[] }
  >,
) => jsonResponse({ query: { pages } });

const parseResponse = () => jsonResponse({ parse: { title: '', pageId: 0, properties: [] } });

const revisionsResponse = (pageid: number, title: string, content = '') =>
  jsonResponse({
    query: {
      pages: {
        [String(pageid)]: {
          pageid,
          title,
          revisions: [{ slots: { main: { '*': content } } }],
        },
      },
    },
  });

const pageInfoResponse = (
  pages: Record<string, { pageid: number; canonicalurl?: string; thumbnail?: { source: string } }>,
) => jsonResponse({ query: { pages } });

const categoriesFromPageResponse = (
  pageid: number,
  title: string,
  categories: { ns: number; title: string }[] = [],
) =>
  jsonResponse({
    batchcomplete: '',
    query: { pages: { [String(pageid)]: { pageid, ns: 0, title, categories } } },
    limits: { categories: 500 },
  });

const pageByIdResponse = (
  pageid: number,
  title: string,
  categories: { ns: number; title: string }[] = [],
  thumbnail?: string,
) =>
  jsonResponse({
    query: {
      pages: {
        [String(pageid)]: {
          pageid,
          ns: 0,
          title,
          index: 0,
          categories,
          ...(thumbnail ? { thumbnail: { source: thumbnail } } : {}),
        },
      },
    },
  });

const pageByTitleResponse = (
  title: string,
  pageid = 42,
  categories: { ns: number; title: string }[] = [],
  thumbnail?: string,
) =>
  jsonResponse({
    query: {
      pages: {
        [String(pageid)]: {
          pageid,
          ns: 0,
          title,
          canonicalUrl: `https://dc.fandom.com/wiki/${title}`,
          categories,
          ...(thumbnail ? { thumbnail: { source: thumbnail } } : {}),
        },
      },
    },
  });

const searchPageResponse = (
  pages: Record<string, { pageid: number; ns: number; title: string; index: number }>,
) => jsonResponse({ batchcomplete: '', query: { pages } });

const thumbnailApiResponse = (pageid: number, thumbnailSource?: string) =>
  jsonResponse({
    batchcomplete: '',
    query: {
      pages: {
        [String(pageid)]: {
          pageid,
          ns: 0,
          title: 'Batman',
          ...(thumbnailSource
            ? { thumbnail: { source: thumbnailSource, width: 400, height: 600 } }
            : {}),
        },
      },
    },
  });

const BASE_THUMBNAIL =
  'https://static.wikia.nocookie.net/dc/images/batman.jpg/revision/latest/scale-to-width-down/400/batman.jpg';

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('VERSION', () => {
  it('is exported as a semver string', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('request building', () => {
  it('targets the wiki api.php with format=json and origin=*', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ query: { search: [] } }));
    await wiki('https://dc.fandom.com').searchCategories('batman');
    const url = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(url.origin + url.pathname).toBe('https://dc.fandom.com/api.php');
    expect(url.searchParams.get('format')).toBe('json');
    expect(url.searchParams.get('origin')).toBe('*');
  });

  it('sends a User-Agent header', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ query: { search: [] } }));
    await wiki('https://dc.fandom.com', { userAgent: 'my-app/1.0' }).searchCategories('x');
    expect((lastInit().headers as Record<string, string>)['User-Agent']).toBe('my-app/1.0');
  });

  it('searchCategories targets namespace 14', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ query: { search: [] } }));
    await wiki('https://dc.fandom.com').searchCategories('characters');
    const url = new URL(lastUrl());
    expect(url.searchParams.get('srnamespace')).toBe('14');
  });

  it('getCategoryMembers passes the category title', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ query: { categorymembers: [] } }));
    await wiki('https://dc.fandom.com').getCategoryMembers('Category:Characters');
    const url = new URL(lastUrl());
    expect(url.searchParams.get('cmtitle')).toBe('Category:Characters');
    expect(url.searchParams.get('list')).toBe('categorymembers');
  });
});

describe('caching', () => {
  it('serves repeated identical requests from cache', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ query: { search: [] } }));
    const client = wiki('https://dc.fandom.com');
    await client.searchCategories('batman');
    await client.searchCategories('batman');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not cache when TTL has elapsed', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ query: { search: [] } }));
    const client = wiki('https://dc.fandom.com', { CACHE_TTL: 0 });
    await client.searchCategories('batman');
    await client.searchCategories('batman');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('clearCache forces a re-fetch', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ query: { search: [] } }));
    const client = wiki('https://dc.fandom.com');
    await client.searchCategories('batman');
    client.clearCache();
    await client.searchCategories('batman');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not cache when allowCache is false', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ query: { search: [] } }));
    const client = wiki('https://dc.fandom.com', { allowCache: false });
    await client.searchCategories('batman');
    await client.searchCategories('batman');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('still caches by default when allowCache is omitted', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ query: { search: [] } }));
    const client = wiki('https://dc.fandom.com');
    await client.searchCategories('batman');
    await client.searchCategories('batman');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('retries', () => {
  it('retries a failed request and succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(null, false, 500))
      .mockResolvedValueOnce(jsonResponse({ query: { search: [] } }));
    const client = wiki('https://dc.fandom.com', { retries: 1 });
    const result = await client.searchCategories('batman');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual([]);
  });

  it('gives up after exhausting retries', async () => {
    fetchMock.mockResolvedValue(jsonResponse(null, false, 500));
    const client = wiki('https://dc.fandom.com', { retries: 1 });
    await expect(client.searchCategories('batman')).rejects.toThrow(/API request failed/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('searchCategories', () => {
  it('returns empty array when no matches', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ query: { search: [] } }));
    const result = await wiki('https://dc.fandom.com').searchCategories('nope');
    expect(result).toEqual([]);
  });

  it('returns category titles', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        query: {
          search: [
            { title: 'Category:Characters', pageid: 1 },
            { title: 'Category:Villains', pageid: 2 },
          ],
        },
      }),
    );
    const result = await wiki('https://dc.fandom.com').searchCategories('characters');
    expect(result).toEqual(['Category:Characters', 'Category:Villains']);
  });

  it('follows sroffset continue tokens and merges results from all pages', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          continue: { sroffset: 500, continue: 'gsroffset||' },
          query: { search: [{ title: 'Category:Characters', pageid: 1 }] },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          query: { search: [{ title: 'Category:Villains', pageid: 2 }] },
        }),
      );

    const result = await wiki('https://dc.fandom.com').searchCategories('characters');
    expect(result).toEqual(['Category:Characters', 'Category:Villains']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const continuationUrl = new URL(fetchMock.mock.calls[1]![0] as string);
    expect(continuationUrl.searchParams.get('sroffset')).toBe('500');
  });
});

describe('getCategoryMembers', () => {
  it('returns empty array when category is empty', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ query: { categorymembers: [] } }));
    const result = await wiki('https://dc.fandom.com').getCategoryMembers('Category:Empty');
    expect(result).toEqual([]);
  });

  it('returns pageid, ns, title for each member', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        query: {
          categorymembers: [{ pageid: 42, ns: 0, title: 'Batman' }],
        },
      }),
    );
    const result = await wiki('https://dc.fandom.com').getCategoryMembers('Category:Characters');
    expect(result).toEqual([{ pageid: 42, ns: 0, title: 'Batman' }]);
  });
});

describe('getPagesByCategory', () => {
  it('returns empty array when category has no members', async () => {
    fetchMock.mockResolvedValueOnce(membersResponse([]));
    const result = await wiki('https://dc.fandom.com').getPagesByCategory('Category:Empty');
    expect(result).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('passes the category title as cmtitle', async () => {
    fetchMock.mockResolvedValueOnce(membersResponse([]));
    await wiki('https://dc.fandom.com').getPagesByCategory('Category:Characters');
    const url = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(url.searchParams.get('cmtitle')).toBe('Category:Characters');
    expect(url.searchParams.get('list')).toBe('categorymembers');
  });

  it('returns a WikiPage with correct id, title, categories, and pageContent', async () => {
    fetchMock
      .mockResolvedValueOnce(membersResponse([{ pageid: 1, ns: 0, title: 'Batman' }]))
      .mockResolvedValueOnce(pageInfoResponse({ '1': { pageid: 1, canonicalurl: '' } }))
      .mockResolvedValueOnce(
        categoriesFromPageResponse(1, 'Batman', [{ ns: 14, title: 'Category:Characters' }]),
      );

    const [page] = await wiki('https://dc.fandom.com').getPagesByCategory('Category:Characters');
    expect(page!.id).toBe(1);
    expect(page!.title).toBe('Batman');
    expect(page!.categories).toEqual(['Category:Characters']);
    expect(typeof page!.getPageContent).toBe('function');
  });

  it('exposes getImages and getGallery as functions', async () => {
    fetchMock
      .mockResolvedValueOnce(membersResponse([{ pageid: 1, ns: 0, title: 'Batman' }]))
      .mockResolvedValueOnce(pageInfoResponse({ '1': { pageid: 1, canonicalurl: '' } }))
      .mockResolvedValueOnce(categoriesFromPageResponse(1, 'Batman'));

    const [page] = await wiki('https://dc.fandom.com').getPagesByCategory('Category:X');
    expect(typeof page!.getImages).toBe('function');
    expect(typeof page!.getGallery).toBe('function');
  });

  it('getImages follows gimcontinue tokens and merges images from all pages', async () => {
    fetchMock
      .mockResolvedValueOnce(membersResponse([{ pageid: 1, ns: 0, title: 'Batman' }]))
      .mockResolvedValueOnce(pageInfoResponse({ '1': { pageid: 1, canonicalurl: '' } }))
      .mockResolvedValueOnce(categoriesFromPageResponse(1, 'Batman'))
      .mockResolvedValueOnce(
        jsonResponse({
          batchcomplete: '',
          continue: { gimcontinue: '100', continue: '||' },
          limits: { images: 10 },
          query: {
            pages: {
              '10': {
                pageId: 10,
                ns: 6,
                title: 'File:A.jpg',
                imagerepository: 'local',
                imageinfo: [
                  { url: 'https://example.com/a.jpg', descriptionurl: '', descriptionshorturl: '' },
                ],
              },
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          batchcomplete: '',
          limits: { images: 10 },
          query: {
            pages: {
              '11': {
                pageId: 11,
                ns: 6,
                title: 'File:B.jpg',
                imagerepository: 'local',
                imageinfo: [
                  { url: 'https://example.com/b.jpg', descriptionurl: '', descriptionshorturl: '' },
                ],
              },
            },
          },
        }),
      );

    const [page] = await wiki('https://dc.fandom.com').getPagesByCategory('Category:X');
    const images = await page!.getImages();
    expect(images).toEqual(['https://example.com/a.jpg', 'https://example.com/b.jpg']);
    const continuationUrl = new URL(fetchMock.mock.calls[4]![0] as string);
    expect(continuationUrl.searchParams.get('gimcontinue')).toBe('100');
  });

  it('getGallery follows imcontinue tokens and merges the gallery listing from all pages', async () => {
    fetchMock
      .mockResolvedValueOnce(membersResponse([{ pageid: 1, ns: 0, title: 'Batman' }]))
      .mockResolvedValueOnce(pageInfoResponse({ '1': { pageid: 1, canonicalurl: '' } }))
      .mockResolvedValueOnce(categoriesFromPageResponse(1, 'Batman'))
      .mockResolvedValueOnce(
        jsonResponse({
          batchcomplete: '',
          continue: { imcontinue: '200', continue: '||' },
          limits: { images: 10 },
          query: {
            pages: {
              '1': {
                pageId: 1,
                ns: 0,
                title: 'Batman/Gallery',
                images: [{ ns: 6, title: 'File:A.jpg' }],
              },
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          batchcomplete: '',
          limits: { images: 10 },
          query: {
            pages: {
              '1': {
                pageId: 1,
                ns: 0,
                title: 'Batman/Gallery',
                images: [{ ns: 6, title: 'File:B.jpg' }],
              },
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          batchcomplete: '',
          limits: { images: 10 },
          query: {
            pages: {
              '10': {
                pageId: 10,
                ns: 6,
                title: 'File:A.jpg',
                imagerepository: 'local',
                imageinfo: [
                  { url: 'https://example.com/a.jpg', descriptionurl: '', descriptionshorturl: '' },
                ],
              },
              '11': {
                pageId: 11,
                ns: 6,
                title: 'File:B.jpg',
                imagerepository: 'local',
                imageinfo: [
                  { url: 'https://example.com/b.jpg', descriptionurl: '', descriptionshorturl: '' },
                ],
              },
            },
          },
        }),
      );

    const [page] = await wiki('https://dc.fandom.com').getPagesByCategory('Category:X');
    const gallery = await page!.getGallery();
    expect(gallery.sort()).toEqual(['https://example.com/a.jpg', 'https://example.com/b.jpg']);
    const continuationUrl = new URL(fetchMock.mock.calls[4]![0] as string);
    expect(continuationUrl.searchParams.get('imcontinue')).toBe('200');
  });

  it('sends one batch info|pageimages request and separate getCategoriesFromPage calls per member', async () => {
    fetchMock
      .mockResolvedValueOnce(
        membersResponse([
          { pageid: 1, ns: 0, title: 'Batman' },
          { pageid: 2, ns: 0, title: 'Superman' },
        ]),
      )
      .mockResolvedValueOnce(
        pageInfoResponse({
          '1': { pageid: 1, canonicalurl: '' },
          '2': { pageid: 2, canonicalurl: '' },
        }),
      )
      .mockResolvedValueOnce(categoriesFromPageResponse(1, 'Batman'))
      .mockResolvedValueOnce(categoriesFromPageResponse(2, 'Superman'));

    const result = await wiki('https://dc.fandom.com').getPagesByCategory('Category:Characters');
    expect(result).toHaveLength(2);

    const urls = fetchMock.mock.calls.map((c) => new URL(c[0] as string));
    const batchCall = urls.find((u) => u.searchParams.get('prop') === 'info|pageimages');
    expect(batchCall).toBeDefined();
    expect(batchCall!.searchParams.get('pageids')).toBe('1|2');

    const categoryCalls = urls.filter((u) => u.searchParams.get('prop') === 'categories');
    expect(categoryCalls).toHaveLength(2);
  });

  it('returns pages in member order', async () => {
    fetchMock
      .mockResolvedValueOnce(
        membersResponse([
          { pageid: 10, ns: 0, title: 'Alpha' },
          { pageid: 20, ns: 0, title: 'Beta' },
        ]),
      )
      .mockResolvedValueOnce(
        pageInfoResponse({
          '10': { pageid: 10, canonicalurl: '' },
          '20': { pageid: 20, canonicalurl: '' },
        }),
      )
      .mockResolvedValueOnce(categoriesFromPageResponse(10, 'Alpha'))
      .mockResolvedValueOnce(categoriesFromPageResponse(20, 'Beta'));

    const result = await wiki('https://dc.fandom.com').getPagesByCategory('Category:X');
    expect(result.map((p) => p.id)).toEqual([10, 20]);
  });

  it('populates thumbnail from the batch response', async () => {
    const src =
      'https://static.wikia.nocookie.net/dc/images/batman.jpg/revision/latest/scale-to-width-down/400/batman.jpg';
    fetchMock
      .mockResolvedValueOnce(membersResponse([{ pageid: 1, ns: 0, title: 'Batman' }]))
      .mockResolvedValueOnce(pageInfoResponse({ '1': { pageid: 1, thumbnail: { source: src } } }))
      .mockResolvedValueOnce(categoriesFromPageResponse(1, 'Batman'));

    const [page] = await wiki('https://dc.fandom.com').getPagesByCategory('Category:X');
    expect(page!.thumbnail).toBe(src.replace('/scale-to-width-down/400', ''));
  });

  it('scales thumbnail URL when thumbnailSize flag is passed', async () => {
    const src =
      'https://static.wikia.nocookie.net/dc/images/batman.jpg/revision/latest/scale-to-width-down/400/batman.jpg';
    fetchMock
      .mockResolvedValueOnce(membersResponse([{ pageid: 1, ns: 0, title: 'Batman' }]))
      .mockResolvedValueOnce(pageInfoResponse({ '1': { pageid: 1, thumbnail: { source: src } } }))
      .mockResolvedValueOnce(categoriesFromPageResponse(1, 'Batman'));

    const [page] = await wiki('https://dc.fandom.com').getPagesByCategory('Category:X', {
      thumbnailSize: 200,
    });
    expect(page!.thumbnail).toBe(src.replace('scale-to-width-down/400', 'scale-to-width-down/200'));
  });
});

describe('getPageContent', () => {
  it('returns the raw wikitext string', async () => {
    fetchMock.mockResolvedValue(revisionsResponse(42, 'Batman', '| Vol = 1\n| Issue = 7'));
    const content = await wiki('https://dc.fandom.com').getPageContent(42);
    expect(content).toBe('| Vol = 1\n| Issue = 7');
  });

  it('returns a parsed key-value map when structured: true', async () => {
    const wikitext = '{{ComicInfobox\n| Name = Batman\n| City = Gotham\n}}';
    fetchMock.mockResolvedValue(revisionsResponse(42, 'Batman', wikitext));
    const result = await wiki('https://dc.fandom.com').getPageContent(42, { structured: true });
    expect(result).toMatchObject({ Name: 'Batman', City: 'Gotham' });
  });

  it('throws when the page does not exist', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        query: {
          pages: {
            '-1': {
              pageid: -1,
              title: 'Nonexistent',
              revisions: [{ slots: { main: { '*': '' } } }],
            },
          },
        },
      }),
    );
    await expect(wiki('https://dc.fandom.com').getPageContent(999)).rejects.toThrow(
      /does not exist/,
    );
  });
});

describe('getCategoriesFromPage', () => {
  it('returns an array of category title strings', async () => {
    fetchMock.mockResolvedValue(
      categoriesResponse({
        '1': {
          pageid: 1,
          ns: 0,
          title: 'Batman',
          categories: [
            { ns: 14, title: 'Category:Heroes' },
            { ns: 14, title: 'Category:DC' },
          ],
        },
      }),
    );
    const result = await wiki('https://dc.fandom.com').getCategoriesFromPage(1);
    expect(result).toEqual([
      { ns: 14, title: 'Category:Heroes' },
      { ns: 14, title: 'Category:DC' },
    ]);
  });
});

describe('getPageById', () => {
  it('returns null when page is absent from response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ query: { pages: {} } }));
    expect(await wiki('https://dc.fandom.com').getPageById(999)).toBeNull();
  });

  it('returns a WikiPage with correct id and title', async () => {
    fetchMock.mockResolvedValue(pageByIdResponse(42, 'Batman'));
    const page = await wiki('https://dc.fandom.com').getPageById(42);
    expect(page!.id).toBe(42);
    expect(page!.title).toBe('Batman');
    expect(page!.thumbnail).toBe('');
    expect(page!.sourceWiki).toBe('https://dc.fandom.com');
  });

  it('populates thumbnail from API response', async () => {
    fetchMock.mockResolvedValue(pageByIdResponse(42, 'Batman', [], BASE_THUMBNAIL));
    const page = await wiki('https://dc.fandom.com').getPageById(42);
    expect(page!.thumbnail).toBe(BASE_THUMBNAIL.replace('/scale-to-width-down/400', ''));
  });

  it('scales thumbnail URL when thumbnailSize flag is passed', async () => {
    fetchMock.mockResolvedValue(pageByIdResponse(42, 'Batman', [], BASE_THUMBNAIL));
    const page = await wiki('https://dc.fandom.com').getPageById(42, { thumbnailSize: 200 });
    expect(page!.thumbnail).toBe(
      BASE_THUMBNAIL.replace('scale-to-width-down/400', 'scale-to-width-down/200'),
    );
  });
});

describe('getPageByTitle', () => {
  it('returns null when page is not found', async () => {
    fetchMock.mockResolvedValue(pageByTitleResponse('Batman', -1));
    expect(await wiki('https://dc.fandom.com').getPageByTitle('Batman')).toBeNull();
  });

  it('returns a WikiPage with correct id and title', async () => {
    fetchMock.mockResolvedValue(pageByTitleResponse('Batman'));
    const page = await wiki('https://dc.fandom.com').getPageByTitle('Batman');
    expect(page!.id).toBe(42);
    expect(page!.title).toBe('Batman');
    expect(page!.thumbnail).toBe('');
  });

  it('returns null when required category is absent', async () => {
    fetchMock.mockResolvedValue(
      pageByTitleResponse('Batman', 42, [{ ns: 14, title: 'Category:Heroes' }]),
    );
    expect(
      await wiki('https://dc.fandom.com').getPageByTitle('Batman', {
        category: ['Category:Villains'],
      }),
    ).toBeNull();
  });

  it('populates thumbnail from API response', async () => {
    fetchMock.mockResolvedValue(pageByTitleResponse('Batman', 42, [], BASE_THUMBNAIL));
    const page = await wiki('https://dc.fandom.com').getPageByTitle('Batman');
    expect(page!.thumbnail).toBe(BASE_THUMBNAIL.replace('/scale-to-width-down/400', ''));
  });

  it('scales thumbnail URL when thumbnailSize flag is passed', async () => {
    fetchMock.mockResolvedValue(pageByTitleResponse('Batman', 42, [], BASE_THUMBNAIL));
    const page = await wiki('https://dc.fandom.com').getPageByTitle('Batman', {
      thumbnailSize: 200,
    });
    expect(page!.thumbnail).toBe(
      BASE_THUMBNAIL.replace('scale-to-width-down/400', 'scale-to-width-down/200'),
    );
  });

  it('follows clcontinue tokens and merges categories from all pages', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          continue: { clcontinue: '42|next', continue: '||' },
          query: {
            pages: {
              '42': {
                pageid: 42,
                ns: 0,
                title: 'Batman',
                canonicalUrl: 'https://dc.fandom.com/wiki/Batman',
                categories: [{ ns: 14, title: 'Category:Heroes' }],
              },
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          query: {
            pages: {
              '42': {
                pageid: 42,
                ns: 0,
                title: 'Batman',
                canonicalUrl: 'https://dc.fandom.com/wiki/Batman',
                categories: [{ ns: 14, title: 'Category:Villains' }],
              },
            },
          },
        }),
      );

    const page = await wiki('https://dc.fandom.com').getPageByTitle('Batman');
    expect(page!.categories).toEqual(['Category:Heroes', 'Category:Villains']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondUrl = new URL(fetchMock.mock.calls[1]![0] as string);
    expect(secondUrl.searchParams.get('clcontinue')).toBe('42|next');
  });
});

describe('getThumbnailById', () => {
  it('returns the URL scaled to the requested width', async () => {
    fetchMock.mockResolvedValue(thumbnailApiResponse(42, BASE_THUMBNAIL));
    const url = await wiki('https://dc.fandom.com').getThumbnailById(42, 200);
    expect(url).toBe(BASE_THUMBNAIL.replace('scale-to-width-down/400', 'scale-to-width-down/200'));
  });

  it('strips the existing scale when no width is provided', async () => {
    fetchMock.mockResolvedValue(thumbnailApiResponse(42, BASE_THUMBNAIL));
    const url = await wiki('https://dc.fandom.com').getThumbnailById(42);
    expect(url).not.toContain('scale-to-width-down');
  });

  it('returns empty string when the page has no thumbnail', async () => {
    fetchMock.mockResolvedValue(thumbnailApiResponse(42));
    const url = await wiki('https://dc.fandom.com').getThumbnailById(42);
    expect(url).toBe('');
  });

  it('requests pageimages prop with pithumbsize 400 for the given pageId', async () => {
    fetchMock.mockResolvedValue(thumbnailApiResponse(42, BASE_THUMBNAIL));
    await wiki('https://dc.fandom.com').getThumbnailById(42, 100);
    const url = new URL(lastUrl());
    expect(url.searchParams.get('prop')).toBe('pageimages');
    expect(url.searchParams.get('pithumbsize')).toBe('400');
    expect(url.searchParams.get('pageids')).toBe('42');
    expect(url.searchParams.get('piprop')).toBe('thumbnail');
  });
});

describe('isGeneratorPageItem', () => {
  it('returns true for a valid page item', () => {
    expect(isGeneratorPageItem({ pageid: 1, title: 'Batman', categories: [] })).toBe(true);
  });

  it('returns false when missing field is present', () => {
    expect(isGeneratorPageItem({ pageid: -1, title: 'X', missing: '', categories: [] })).toBe(
      false,
    );
  });

  it('returns false when categories field is absent', () => {
    expect(isGeneratorPageItem({ pageid: 1, title: 'Batman' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isGeneratorPageItem(null)).toBe(false);
  });

  it('returns false for a non-object', () => {
    expect(isGeneratorPageItem('string')).toBe(false);
  });
});

describe('wiki plugin system', () => {
  it('throws for an unknown plugin', () => {
    // @ts-expect-error intentional bad plugin name
    expect(() => wiki({ plugin: 'nonexistent' })).toThrow(/Unknown plugin/);
  });

  it('dc-fandom plugin exposes getComic and getVolume alongside base Wiki methods', () => {
    const client = wiki({ plugin: 'dc-fandom' });
    expect(typeof client.getPage).toBe('function');
    expect(typeof client.clearCache).toBe('function');
    expect(typeof client.getComic).toBe('function');
    expect(typeof client.getVolume).toBe('function');
    expect(typeof client.getComicById).toBe('function');
    expect(typeof client.getVolumeById).toBe('function');
  });

  it('dc-fandom plugin targets https://dc.fandom.com', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ query: { search: [] } }));
    await wiki({ plugin: 'dc-fandom' }).searchCategories('batman');
    const url = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(url.origin).toBe('https://dc.fandom.com');
  });

  it('a supplied url override is used for API calls instead of the plugin default', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ query: { search: [] } }));
    await wiki({ plugin: 'dc-fandom', url: 'https://some-other.fandom.com' }).searchCategories(
      'batman',
    );
    const url = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(url.origin).toBe('https://some-other.fandom.com');
  });

  it('getComicById returns null when page is not found', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ query: { pages: {} } }));
    const result = await wiki({ plugin: 'dc-fandom' }).getComicById(999);
    expect(result).toBeNull();
  });

  it('getComicById returns a WikiComic with correct title and pageId', async () => {
    const wikitext = '{{ComicInfobox\n| Volume = 1\n| Issue = 7\n| Writer1_1 = Grant Morrison\n}}';
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          query: {
            pages: {
              '42': {
                pageid: 42,
                ns: 0,
                title: 'Batman Vol 1 7',
                index: 0,
                categories: [{ ns: 14, title: 'Category:Comics' }],
              },
            },
          },
        }),
      )
      .mockResolvedValueOnce(comicWikitextResponse(42, 'Batman Vol 1 7', wikitext));

    const comic = await wiki({ plugin: 'dc-fandom' }).getComicById(42);
    expect(comic).not.toBeNull();
    expect(comic!.title).toBe('Batman Vol 1 7');
    expect(comic!.pageId).toBe(42);
    expect(comic!.volume).toBe('1');
    expect(comic!.issue).toBe('7');
    expect(comic!.credits.writers).toContain('Grant Morrison');
    expect(comic!.sourceWiki).toBe('https://dc.fandom.com');
  });

  it('getComicById reflects a supplied url override in sourceWiki', async () => {
    const wikitext = '{{ComicInfobox\n| Volume = 1\n| Issue = 7\n}}';
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          query: {
            pages: {
              '42': {
                pageid: 42,
                ns: 0,
                title: 'Batman Vol 1 7',
                index: 0,
                categories: [{ ns: 14, title: 'Category:Comics' }],
              },
            },
          },
        }),
      )
      .mockResolvedValueOnce(comicWikitextResponse(42, 'Batman Vol 1 7', wikitext));

    const comic = await wiki({
      plugin: 'dc-fandom',
      url: 'https://some-other.fandom.com',
    }).getComicById(42);
    expect(comic!.sourceWiki).toBe('https://some-other.fandom.com');
  });

  it('getComicById resolves cover from the infobox Image field, not the auto-picked page thumbnail', async () => {
    const wikitext = '{{ComicInfobox\n| Image = Batman Vol 1 7.jpg\n| Volume = 1\n| Issue = 7\n}}';
    const coverUrl =
      'https://static.wikia.nocookie.net/dc/images/b/b1/Batman_Vol_1_7.jpg/revision/latest';
    fetchMock
      .mockResolvedValueOnce(
        // page.thumbnail here is a non-cover image MediaWiki auto-picked (e.g. a gallery video thumbnail)
        pageByIdResponse(42, 'Batman Vol 1 7', [], BASE_THUMBNAIL),
      )
      .mockResolvedValueOnce(comicWikitextResponse(42, 'Batman Vol 1 7', wikitext))
      .mockResolvedValueOnce(
        jsonResponse({
          query: {
            pages: {
              '500': {
                pageid: 500,
                ns: 6,
                title: 'File:Batman Vol 1 7.jpg',
                imageinfo: [{ url: coverUrl }],
              },
            },
          },
        }),
      );

    const comic = await wiki({ plugin: 'dc-fandom' }).getComicById(42);
    expect(comic!.cover).toBe(coverUrl);
  });

  it('getComicById falls back to page.thumbnail when the infobox has no Image field', async () => {
    const wikitext = '{{ComicInfobox\n| Volume = 1\n| Issue = 7\n}}';
    fetchMock
      .mockResolvedValueOnce(pageByIdResponse(42, 'Batman Vol 1 7', [], BASE_THUMBNAIL))
      .mockResolvedValueOnce(comicWikitextResponse(42, 'Batman Vol 1 7', wikitext));

    const comic = await wiki({ plugin: 'dc-fandom' }).getComicById(42);
    expect(comic!.cover).toBe(BASE_THUMBNAIL.replace('/scale-to-width-down/400', ''));
  });

  it('getComic with multiple:true returns empty array when no pages found', async () => {
    // getPage internal calls: generator search → returns empty
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        batchcomplete: '',
        query: { pages: {} },
      }),
    );
    const result = await wiki({ plugin: 'dc-fandom' }).getComic('Unknown Comic #999', {
      multiple: true,
    });
    expect(result).toEqual([]);
  });

  it('getComic returns null when no pages found', async () => {
    // getPage internal calls: generator search → returns empty
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        batchcomplete: '',
        continue: { gsroffset: 0, continue: '' },
        query: { pages: {} },
      }),
    );
    const result = await wiki({ plugin: 'dc-fandom' }).getComic('Batman Year One.cbz');
    expect(result).toBeNull();
  });

  it('getComic returns null when pages exist but none fuzzy-match the query', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          batchcomplete: '',
          query: {
            pages: {
              '42': {
                pageid: 42,
                ns: 0,
                title: 'Batman Vol 1 7',
                index: 0,
                categories: [{ ns: 14, title: 'Category:Comics' }],
              },
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        comicWikitextResponse(
          42,
          'Batman Vol 1 7',
          '{{ComicInfobox\n| Volume = 1\n| Issue = 7\n}}',
        ),
      );

    const result = await wiki({ plugin: 'dc-fandom' }).getComic('Zzyzx Omega Quantum Nonsense');
    expect(result).toBeNull();
  });

  it('exposes getCharacter', () => {
    expect(typeof wiki({ plugin: 'dc-fandom' }).getCharacter).toBe('function');
  });
});

describe('getCategoryMembers (pagination)', () => {
  it('follows continue tokens and returns members from all pages', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          batchcomplete: '',
          continue: { cmcontinue: 'page|2', continue: '-||' },
          query: { categorymembers: [{ pageid: 1, ns: 0, title: 'Page One' }] },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          batchcomplete: '',
          query: { categorymembers: [{ pageid: 2, ns: 0, title: 'Page Two' }] },
        }),
      );

    const result = await wiki('https://dc.fandom.com').getCategoryMembers('Category:X');
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.pageid)).toEqual([1, 2]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondUrl = new URL(fetchMock.mock.calls[1]![0] as string);
    expect(secondUrl.searchParams.get('cmcontinue')).toBe('page|2');
  });

  it.skip('merges members from multiple categories, deduped by pageid', async () => {
    fetchMock
      .mockResolvedValueOnce(
        membersResponse([
          { pageid: 1, ns: 0, title: 'Shared' },
          { pageid: 2, ns: 0, title: 'Only A' },
        ]),
      )
      .mockResolvedValueOnce(
        membersResponse([
          { pageid: 1, ns: 0, title: 'Shared' },
          { pageid: 3, ns: 0, title: 'Only B' },
        ]),
      );

    const result = await wiki('https://dc.fandom.com').getCategoryMembers([
      'Category:A',
      'Category:B',
    ]);

    expect(result.map((m) => m.pageid).sort()).toEqual([1, 2, 3]);
    const cmtitles = fetchMock.mock.calls.map((c) =>
      new URL(c[0] as string).searchParams.get('cmtitle'),
    );
    expect(cmtitles).toEqual(['Category:A', 'Category:B']);
  });

  it('returns only members of the first category that are also in the second (intersection)', async () => {
    fetchMock
      .mockResolvedValueOnce(
        membersResponse([
          { pageid: 1, ns: 0, title: 'Batman' },
          { pageid: 2, ns: 0, title: 'Superman' },
        ]),
      )
      .mockResolvedValueOnce(
        categoriesResponse({
          '1': { pageid: 1, ns: 0, title: 'Batman', categories: [{ ns: 14, title: 'Category:B' }] },
          '2': { pageid: 2, ns: 0, title: 'Superman', categories: [] },
        }),
      );

    const result = await wiki('https://dc.fandom.com').getCategoryMembers([
      'Category:A',
      'Category:B',
    ]);
    expect(result.map((m) => m.pageid)).toEqual([1]);
    expect(
      fetchMock.mock.calls[0] &&
        new URL(fetchMock.mock.calls[0][0] as string).searchParams.get('cmtitle'),
    ).toBe('Category:A');
  });
});

describe('dc-fandom character.getAppearances', () => {
  it('returns comics from the character Appearances category', async () => {
    fetchMock
      .mockResolvedValueOnce(pageByIdResponse(7, 'Batman'))
      .mockResolvedValueOnce(
        comicWikitextResponse(7, 'Batman', '{{Character\n| RealName = Bruce Wayne\n}}'),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          query: { categorymembers: [{ pageid: 42, ns: 0, title: 'Batman Vol 1 1' }] },
        }),
      )
      .mockResolvedValueOnce(pageByIdResponse(42, 'Batman Vol 1 1'))
      .mockResolvedValueOnce(
        comicWikitextResponse(
          42,
          'Batman Vol 1 1',
          '{{ComicInfobox\n| Volume = 1\n| Issue = 1\n| Year = 2020\n| Month = June\n| Day = 1\n}}',
        ),
      );

    const character = await wiki({ plugin: 'dc-fandom' }).getCharacterById(7);
    const result = await character!.getAppearances({ sorted: false });
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe('Batman Vol 1 1');
    const membersUrl = new URL(fetchMock.mock.calls[2]![0] as string);
    expect(membersUrl.searchParams.get('cmtitle')).toBe('Category:Batman/Appearances');
  });

  it('sorts results chronologically when sorted: true', async () => {
    fetchMock
      .mockResolvedValueOnce(pageByIdResponse(7, 'Batman'))
      .mockResolvedValueOnce(
        comicWikitextResponse(7, 'Batman', '{{Character\n| RealName = Bruce Wayne\n}}'),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          query: {
            categorymembers: [
              { pageid: 1, ns: 0, title: 'Batman Vol 1 1' },
              { pageid: 2, ns: 0, title: 'Batman Vol 1 2' },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(pageByIdResponse(1, 'Batman Vol 1 1'))
      .mockResolvedValueOnce(pageByIdResponse(2, 'Batman Vol 1 2'))
      .mockResolvedValueOnce(
        comicWikitextResponse(
          1,
          'Batman Vol 1 1',
          '{{ComicInfobox\n| Volume = 1\n| Issue = 1\n| Year = 2020\n| Month = June\n| Day = 1\n}}',
        ),
      )
      .mockResolvedValueOnce(
        comicWikitextResponse(
          2,
          'Batman Vol 1 2',
          '{{ComicInfobox\n| Volume = 1\n| Issue = 2\n| Year = 2019\n| Month = January\n| Day = 1\n}}',
        ),
      );

    const character = await wiki({ plugin: 'dc-fandom' }).getCharacterById(7);
    const result = await character!.getAppearances({ sorted: true });
    expect(result).toHaveLength(2);
    expect(result[0]!.releaseDate.releaseYear).toBe('2019');
    expect(result[1]!.releaseDate.releaseYear).toBe('2020');
  });
});

describe('dc-fandom getCharacterAppearances (standalone)', () => {
  it('returns comics for a title without fetching the character page first', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          query: { categorymembers: [{ pageid: 42, ns: 0, title: 'Batman Vol 1 1' }] },
        }),
      )
      .mockResolvedValueOnce(pageByIdResponse(42, 'Batman Vol 1 1'))
      .mockResolvedValueOnce(
        comicWikitextResponse(
          42,
          'Batman Vol 1 1',
          '{{ComicInfobox\n| Volume = 1\n| Issue = 1\n| Year = 2020\n| Month = June\n| Day = 1\n}}',
        ),
      );

    const result = await wiki({ plugin: 'dc-fandom' }).getCharacterAppearances('Batman', {
      sorted: false,
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe('Batman Vol 1 1');
    // first call is the appearances category — no character page/structured-content fetch precedes it
    const firstUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(firstUrl.searchParams.get('cmtitle')).toBe('Category:Batman/Appearances');
  });

  it('sorts results chronologically when sorted: true', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          query: {
            categorymembers: [
              { pageid: 1, ns: 0, title: 'Batman Vol 1 1' },
              { pageid: 2, ns: 0, title: 'Batman Vol 1 2' },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(pageByIdResponse(1, 'Batman Vol 1 1'))
      .mockResolvedValueOnce(pageByIdResponse(2, 'Batman Vol 1 2'))
      .mockResolvedValueOnce(
        comicWikitextResponse(
          1,
          'Batman Vol 1 1',
          '{{ComicInfobox\n| Volume = 1\n| Issue = 1\n| Year = 2020\n| Month = June\n| Day = 1\n}}',
        ),
      )
      .mockResolvedValueOnce(
        comicWikitextResponse(
          2,
          'Batman Vol 1 2',
          '{{ComicInfobox\n| Volume = 1\n| Issue = 2\n| Year = 2019\n| Month = January\n| Day = 1\n}}',
        ),
      );

    const result = await wiki({ plugin: 'dc-fandom' }).getCharacterAppearances('Batman', {
      sorted: true,
    });
    expect(result).toHaveLength(2);
    expect(result[0]!.releaseDate.releaseYear).toBe('2019');
    expect(result[1]!.releaseDate.releaseYear).toBe('2020');
  });

  it('resolves a pageId to its title before looking up the appearances category', async () => {
    fetchMock
      .mockResolvedValueOnce(pageByIdResponse(7, 'Batman'))
      .mockResolvedValueOnce(
        jsonResponse({
          query: { categorymembers: [{ pageid: 42, ns: 0, title: 'Batman Vol 1 1' }] },
        }),
      )
      .mockResolvedValueOnce(pageByIdResponse(42, 'Batman Vol 1 1'))
      .mockResolvedValueOnce(
        comicWikitextResponse(
          42,
          'Batman Vol 1 1',
          '{{ComicInfobox\n| Volume = 1\n| Issue = 1\n| Year = 2020\n| Month = June\n| Day = 1\n}}',
        ),
      );

    const result = await wiki({ plugin: 'dc-fandom' }).getCharacterAppearances(7, {
      sorted: false,
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe('Batman Vol 1 1');
    const secondUrl = new URL(fetchMock.mock.calls[1]![0] as string);
    expect(secondUrl.searchParams.get('cmtitle')).toBe('Category:Batman/Appearances');
  });

  it('returns an empty array when the pageId does not resolve to a page', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ query: { pages: {} } }));

    const result = await wiki({ plugin: 'dc-fandom' }).getCharacterAppearances(999);
    expect(result).toEqual([]);
  });
});

describe('dc-fandom wikiCharacterBuilder parsing', () => {
  it('parses aliases, quotation, bullet lists, and history sections', async () => {
    const wikitext = [
      '{{Character',
      '| RealName = Bruce Wayne',
      '| Aliases = The Bat<br>The Dark Knight; Matches Malone',
      '| Quotation = I am vengeance.',
      '| Speaker = Batman',
      '| Powers = * Peak human conditioning',
      '* Master detective',
      '| HistoryText = == Origin ==',
      'His parents were killed.',
      '== Career ==',
      'He fights crime.',
      '}}',
    ].join('\n');

    fetchMock
      .mockResolvedValueOnce(pageByIdResponse(7, 'Batman'))
      .mockResolvedValueOnce(comicWikitextResponse(7, 'Batman', wikitext));

    const character = await wiki({ plugin: 'dc-fandom' }).getCharacterById(7);
    expect(character).not.toBeNull();
    expect(character!.realName).toBe('Bruce Wayne');
    expect(character!.aliases).toEqual(['The Bat', 'The Dark Knight', 'Matches Malone']);
    expect(character!.quotation).toEqual({ quote: 'I am vengeance.', speaker: 'Batman' });
    expect(character!.powers).toEqual(['Peak human conditioning', 'Master detective']);
    expect(character!.history).toEqual([
      { heading: 'Origin', text: 'His parents were killed.' },
      { heading: 'Career', text: 'He fights crime.' },
    ]);
    expect(character!.sourceWiki).toBe('https://dc.fandom.com');
  });

  it('omits quotation when no quote fields are present', async () => {
    fetchMock
      .mockResolvedValueOnce(pageByIdResponse(7, 'Batman'))
      .mockResolvedValueOnce(
        comicWikitextResponse(7, 'Batman', '{{Character\n| RealName = Bruce Wayne\n}}'),
      );

    const character = await wiki({ plugin: 'dc-fandom' }).getCharacterById(7);
    expect(character!.quotation).toBeUndefined();
    expect(character!.aliases).toEqual([]);
    expect(character!.history).toEqual([]);
  });

  it('populates thumbnail from the page response', async () => {
    fetchMock
      .mockResolvedValueOnce(pageByIdResponse(7, 'Batman', [], BASE_THUMBNAIL))
      .mockResolvedValueOnce(
        comicWikitextResponse(7, 'Batman', '{{Character\n| RealName = Bruce Wayne\n}}'),
      );

    const character = await wiki({ plugin: 'dc-fandom' }).getCharacterById(7);
    expect(character!.thumbnail).toBe(BASE_THUMBNAIL.replace('/scale-to-width-down/400', ''));
  });

  it('scales thumbnail URL when flags.thumbnailSize is passed', async () => {
    fetchMock
      .mockResolvedValueOnce(pageByIdResponse(7, 'Batman', [], BASE_THUMBNAIL))
      .mockResolvedValueOnce(
        comicWikitextResponse(7, 'Batman', '{{Character\n| RealName = Bruce Wayne\n}}'),
      );

    const character = await wiki({ plugin: 'dc-fandom' }).getCharacterById(7, {
      thumbnailSize: 200,
    });
    expect(character!.thumbnail).toBe(
      BASE_THUMBNAIL.replace('scale-to-width-down/400', 'scale-to-width-down/200'),
    );
  });
});

describe('dc-fandom getComic flags', () => {
  it('includeCollections: true — accepts pages in Category:Collected Editions', async () => {
    fetchMock
      .mockResolvedValueOnce(
        searchPageResponse({ '1': { pageid: 1, ns: 0, title: 'Batman Year One', index: 0 } }),
      )
      .mockResolvedValueOnce(
        categoriesResponse({
          '1': {
            pageid: 1,
            ns: 0,
            title: 'Batman Year One',
            categories: [{ ns: 14, title: 'Category:Collected Editions' }],
          },
        }),
      )
      .mockResolvedValueOnce(
        comicWikitextResponse(
          1,
          'Batman Year One',
          '{{ComicInfobox\n| Volume = 1\n| Issue = 1\n}}',
        ),
      );

    const result = await wiki({ plugin: 'dc-fandom' }).getComic('Batman Year One', {
      multiple: true,
      includeCollections: true,
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe('Batman Year One');
  });

  it('category — filters to pages present in all listed categories', async () => {
    fetchMock
      .mockResolvedValueOnce(
        searchPageResponse({
          '1': { pageid: 1, ns: 0, title: 'Batman: Year One', index: 0 },
          '2': { pageid: 2, ns: 0, title: 'Batman: Hush', index: 1 },
        }),
      )
      .mockResolvedValueOnce(
        categoriesResponse({
          '1': {
            pageid: 1,
            ns: 0,
            title: 'Batman: Year One',
            categories: [
              { ns: 14, title: 'Category:Comics' },
              { ns: 14, title: 'Category:Solo Stories' },
            ],
          },
          '2': {
            pageid: 2,
            ns: 0,
            title: 'Batman: Hush',
            categories: [{ ns: 14, title: 'Category:Comics' }],
          },
        }),
      )
      .mockResolvedValueOnce(
        comicWikitextResponse(
          1,
          'Batman: Year One',
          '{{ComicInfobox\n| Volume = 1\n| Issue = 1\n}}',
        ),
      );

    const result = await wiki({ plugin: 'dc-fandom' }).getComic('batman', {
      multiple: true,
      category: ['Category:Solo Stories'],
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe('Batman: Year One');
  });
});

describe('getComic/getVolume/getCharacter — multiple:true raised limit (issue #41)', () => {
  it('getComic: multiple:true without an explicit limit requests gsrlimit=50', async () => {
    fetchMock.mockResolvedValueOnce(searchPageResponse({}));
    await wiki({ plugin: 'dc-fandom' }).getComic('superman', { multiple: true });
    expect(new URL(lastUrl()).searchParams.get('gsrlimit')).toBe('50');
  });

  it('getComic: an explicit limit overrides the multiple:true default', async () => {
    fetchMock.mockResolvedValueOnce(searchPageResponse({}));
    await wiki({ plugin: 'dc-fandom' }).getComic('superman', { multiple: true, limit: 120 });
    expect(new URL(lastUrl()).searchParams.get('gsrlimit')).toBe('120');
  });

  it('getComic: multiple:false (default) does not raise the limit', async () => {
    fetchMock.mockResolvedValueOnce(searchPageResponse({}));
    await wiki({ plugin: 'dc-fandom' }).getComic('superman');
    expect(new URL(lastUrl()).searchParams.get('gsrlimit')).toBe('20');
  });

  it('getVolume: multiple:true without an explicit limit requests gsrlimit=50', async () => {
    fetchMock.mockResolvedValueOnce(searchPageResponse({}));
    await wiki({ plugin: 'dc-fandom' }).getVolume('batman', { multiple: true });
    expect(new URL(lastUrl()).searchParams.get('gsrlimit')).toBe('50');
  });

  it('getCharacter: multiple:true without an explicit limit requests gsrlimit=50', async () => {
    fetchMock.mockResolvedValueOnce(searchPageResponse({}));
    await wiki({ plugin: 'dc-fandom' }).getCharacter('batman', { multiple: true });
    expect(new URL(lastUrl()).searchParams.get('gsrlimit')).toBe('50');
  });
});

describe('getPageById (array overload)', () => {
  it('returns an array of WikiPages for an array of IDs', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        query: {
          pages: {
            '42': { pageid: 42, ns: 0, title: 'Batman', index: 0, categories: [] },
            '43': { pageid: 43, ns: 0, title: 'Superman', index: 1, categories: [] },
          },
        },
      }),
    );
    const pages = await wiki('https://dc.fandom.com').getPageById([42, 43]);
    expect(pages).toHaveLength(2);
    expect(pages.map((p) => p.id).sort((a, b) => a - b)).toEqual([42, 43]);
  });

  it('returns an empty array for an empty IDs array', async () => {
    const pages = await wiki('https://dc.fandom.com').getPageById([]);
    expect(pages).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('dc-fandom getComicById (array overload)', () => {
  it('returns an array of WikiComics for an array of IDs', async () => {
    const wikitext = '{{ComicInfobox\n| Volume = 1\n| Issue = 1\n}}';
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          query: {
            pages: {
              '1': {
                pageid: 1,
                ns: 0,
                title: 'Batman Vol 1 1',
                index: 0,
                categories: [{ ns: 14, title: 'Category:Comics' }],
              },
              '2': {
                pageid: 2,
                ns: 0,
                title: 'Batman Vol 1 2',
                index: 1,
                categories: [{ ns: 14, title: 'Category:Comics' }],
              },
            },
          },
        }),
      )
      .mockResolvedValue(comicWikitextResponse(0, '', wikitext));

    const comics = await wiki({ plugin: 'dc-fandom' }).getComicById([1, 2]);
    expect(comics).toHaveLength(2);
  });
});

describe('dc-fandom getVolumeById', () => {
  const volumeWikitext =
    '{{VolumeInfobox\n| Type = Ongoing\n| StartYear = 2011\n| StartMonth = September\n}}';

  it('returns null when page is not found', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ query: { pages: {} } }));
    expect(await wiki({ plugin: 'dc-fandom' }).getVolumeById(999)).toBeNull();
  });

  it('returns a WikiVolume with correct title and pageId', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          query: {
            pages: {
              '42': { pageid: 42, ns: 0, title: 'Batman Vol 4', index: 0, categories: [] },
            },
          },
        }),
      )
      .mockResolvedValueOnce(revisionsResponse(42, 'Batman Vol 4', volumeWikitext));

    const volume = await wiki({ plugin: 'dc-fandom' }).getVolumeById(42);
    expect(volume).not.toBeNull();
    expect(volume!.title).toBe('Batman Vol 4');
    expect(volume!.pageId).toBe(42);
    expect(volume!.startDate.year).toBe('2011');
    expect(volume!.sourceWiki).toBe('https://dc.fandom.com');
  });

  it('scales thumbnail URL when flags.thumbnailSize is passed', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          query: {
            pages: {
              '42': {
                pageid: 42,
                ns: 0,
                title: 'Batman Vol 4',
                index: 0,
                categories: [],
                thumbnail: { source: BASE_THUMBNAIL },
              },
            },
          },
        }),
      )
      .mockResolvedValueOnce(revisionsResponse(42, 'Batman Vol 4', volumeWikitext));

    const volume = await wiki({ plugin: 'dc-fandom' }).getVolumeById(42, { thumbnailSize: 200 });
    expect(volume!.thumbnail).toBe(
      BASE_THUMBNAIL.replace('scale-to-width-down/400', 'scale-to-width-down/200'),
    );
  });

  it('returns an array of WikiVolumes for an array of IDs', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          query: {
            pages: {
              '1': { pageid: 1, ns: 0, title: 'Batman Vol 1', index: 0, categories: [] },
              '2': { pageid: 2, ns: 0, title: 'Batman Vol 2', index: 1, categories: [] },
            },
          },
        }),
      )
      .mockResolvedValue(revisionsResponse(0, '', volumeWikitext));

    const volumes = await wiki({ plugin: 'dc-fandom' }).getVolumeById([1, 2]);
    expect(volumes).toHaveLength(2);
  });
});

describe('dc-fandom fields option', () => {
  it('getComicById with fields returns only the requested keys', async () => {
    const wikitext = '{{ComicInfobox\n| Volume = 1\n| Issue = 7\n| Writer1_1 = Grant Morrison\n}}';
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          query: {
            pages: {
              '42': {
                pageid: 42,
                ns: 0,
                title: 'Batman Vol 1 7',
                index: 0,
                categories: [{ ns: 14, title: 'Category:Comics' }],
              },
            },
          },
        }),
      )
      .mockResolvedValueOnce(comicWikitextResponse(42, 'Batman Vol 1 7', wikitext));

    const comic = await wiki({ plugin: 'dc-fandom' }).getComicById(42, {
      fields: ['title', 'issue'],
    });

    expect(comic!.title).toBe('Batman Vol 1 7');
    expect(comic!.issue).toBe('7');
    expect(comic!.volume).toBeUndefined();
    expect(comic!.credits).toBeUndefined();
    expect(comic!.pageId).toBeUndefined();
    expect(Object.keys(comic!).sort()).toEqual(['issue', 'title']);
  });

  it('getComicById without fields still returns the full object (non-breaking default)', async () => {
    const wikitext = '{{ComicInfobox\n| Volume = 1\n| Issue = 7\n}}';
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          query: {
            pages: {
              '42': {
                pageid: 42,
                ns: 0,
                title: 'Batman Vol 1 7',
                index: 0,
                categories: [{ ns: 14, title: 'Category:Comics' }],
              },
            },
          },
        }),
      )
      .mockResolvedValueOnce(comicWikitextResponse(42, 'Batman Vol 1 7', wikitext));

    const comic = await wiki({ plugin: 'dc-fandom' }).getComicById(42);

    expect(Object.keys(comic!).sort()).toEqual(
      [
        'appearing',
        'cover',
        'coverVariants',
        'credits',
        'event',
        'issue',
        'notes',
        'pageId',
        'rating',
        'releaseDate',
        'sourceWiki',
        'storyTitles',
        'synopsis',
        'title',
        'trivia',
        'volume',
      ].sort(),
    );
  });

  it('applies fields to every item when fetching an array of IDs', async () => {
    const wikitext = '{{ComicInfobox\n| Volume = 1\n| Issue = 1\n}}';
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          query: {
            pages: {
              '1': {
                pageid: 1,
                ns: 0,
                title: 'Batman Vol 1 1',
                index: 0,
                categories: [{ ns: 14, title: 'Category:Comics' }],
              },
              '2': {
                pageid: 2,
                ns: 0,
                title: 'Batman Vol 1 2',
                index: 1,
                categories: [{ ns: 14, title: 'Category:Comics' }],
              },
            },
          },
        }),
      )
      .mockResolvedValue(comicWikitextResponse(0, '', wikitext));

    const comics = await wiki({ plugin: 'dc-fandom' }).getComicById([1, 2], {
      fields: ['title'],
    });

    expect(comics).toHaveLength(2);
    for (const comic of comics) {
      expect(Object.keys(comic).sort()).toEqual(['title']);
    }
  });

  it('volume.getComics stays present and callable even when fields excludes it', async () => {
    const volumeWikitext = '{{VolumeInfobox\n| Type = Ongoing\n| StartYear = 2011\n}}';
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          query: {
            pages: {
              '42': { pageid: 42, ns: 0, title: 'Batman Vol 4', index: 0, categories: [] },
            },
          },
        }),
      )
      .mockResolvedValueOnce(revisionsResponse(42, 'Batman Vol 4', volumeWikitext));

    const volume = await wiki({ plugin: 'dc-fandom' }).getVolumeById(42, { fields: ['title'] });

    expect(Object.keys(volume!).sort()).toEqual(['getComics', 'title']);
    expect(typeof volume!.getComics).toBe('function');
  });
});

describe('dc-fandom volume.getComics', () => {
  const volumeWikitext = (issueList: string) =>
    `{{VolumeInfobox\n| Type = Ongoing\n| IssueList = ${issueList}\n}}`;

  it('resolves issueList entries into WikiComic objects', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          query: {
            pages: {
              '42': { pageid: 42, ns: 0, title: 'Batman Vol 4', index: 0, categories: [] },
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        revisionsResponse(42, 'Batman Vol 4', volumeWikitext('{{a|Batman Vol 1 1}}')),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          batchcomplete: '',
          query: {
            pages: {
              '1': {
                pageid: 1,
                ns: 0,
                title: 'Batman Vol 1 1',
                index: 0,
                categories: [{ ns: 14, title: 'Category:Comics' }],
              },
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        comicWikitextResponse(1, 'Batman Vol 1 1', '{{ComicInfobox\n| Volume = 1\n| Issue = 1\n}}'),
      );

    const volume = await wiki({ plugin: 'dc-fandom' }).getVolumeById(42);
    const result = await volume!.getComics();
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe('Batman Vol 1 1');
  });

  it('drops issue titles that do not resolve to a page', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          query: {
            pages: {
              '42': { pageid: 42, ns: 0, title: 'Batman Vol 4', index: 0, categories: [] },
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        revisionsResponse(42, 'Batman Vol 4', volumeWikitext('{{a|Nonexistent Issue}}')),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          batchcomplete: '',
          continue: { gsroffset: 0, continue: '' },
          query: { pages: {} },
        }),
      );

    const volume = await wiki({ plugin: 'dc-fandom' }).getVolumeById(42);
    const result = await volume!.getComics();
    expect(result).toEqual([]);
  });

  it('sorts results chronologically when sorted: true', async () => {
    // Both issues are resolved concurrently (Promise.all), so fetch-call order
    // between them is not guaranteed. Dispatch by URL instead of a fixed queue.
    const comicsByTitle: Record<string, { pageid: number; year: string; month: string }> = {
      'Batman Vol 1 1': { pageid: 1, year: '2020', month: 'June' },
      'Batman Vol 1 2': { pageid: 2, year: '2019', month: 'January' },
    };
    const comicsById: Record<number, string> = {
      1: 'Batman Vol 1 1',
      2: 'Batman Vol 1 2',
    };

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          query: {
            pages: {
              '42': { pageid: 42, ns: 0, title: 'Batman Vol 4', index: 0, categories: [] },
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        revisionsResponse(
          42,
          'Batman Vol 4',
          volumeWikitext('{{a|Batman Vol 1 1}}\n{{a|Batman Vol 1 2}}'),
        ),
      )
      .mockImplementation(
        dispatchByUrl as unknown as Parameters<typeof fetchMock.mockImplementation>[0],
      );

    function dispatchByUrl(input: RequestInfo | URL): Promise<Response> {
      const url = new URL(input as string);
      const search = url.searchParams.get('gsrsearch');
      if (search !== null) {
        const match = comicsByTitle[search]!;
        return Promise.resolve(
          jsonResponse({
            batchcomplete: '',
            query: {
              pages: {
                [String(match.pageid)]: {
                  pageid: match.pageid,
                  ns: 0,
                  title: search,
                  index: 0,
                  categories: [{ ns: 14, title: 'Category:Comics' }],
                },
              },
            },
          }),
        );
      }

      const pageid = Number(url.searchParams.get('pageids'));
      const title = comicsById[pageid]!;
      const info = comicsByTitle[title]!;
      return Promise.resolve(
        comicWikitextResponse(
          pageid,
          title,
          `{{ComicInfobox\n| Volume = 1\n| Issue = ${pageid}\n| Year = ${info.year}\n| Month = ${info.month}\n| Day = 1\n}}`,
        ),
      );
    }

    const volume = await wiki({ plugin: 'dc-fandom' }).getVolumeById(42);
    const result = await volume!.getComics({ sorted: true });
    expect(result).toHaveLength(2);
    expect(result[0]!.releaseDate.releaseYear).toBe('2019');
    expect(result[1]!.releaseDate.releaseYear).toBe('2020');
  });

  it('forwards the category flag through to the underlying getComic calls', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          query: {
            pages: {
              '42': { pageid: 42, ns: 0, title: 'Batman Vol 4', index: 0, categories: [] },
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        revisionsResponse(42, 'Batman Vol 4', volumeWikitext('{{a|Batman Vol 1 1}}')),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          batchcomplete: '',
          query: {
            pages: {
              '1': {
                pageid: 1,
                ns: 0,
                title: 'Batman Vol 1 1',
                index: 0,
                // Belongs to Category:Comics (satisfies getComic's default categoriesOr)
                // but not to the category required by the forwarded `category` flag.
                categories: [{ ns: 14, title: 'Category:Comics' }],
              },
            },
          },
        }),
      );

    const volume = await wiki({ plugin: 'dc-fandom' }).getVolumeById(42);
    const result = await volume!.getComics({ category: ['Category:Requested'] });
    expect(result).toEqual([]);
  });
});

describe('getPage', () => {
  it('returns WikiPages with correct ids and titles', async () => {
    fetchMock
      .mockResolvedValueOnce(
        searchPageResponse({ '42': { pageid: 42, ns: 0, title: 'Batman', index: 0 } }),
      )
      .mockResolvedValueOnce(
        categoriesResponse({ '42': { pageid: 42, ns: 0, title: 'Batman', categories: [] } }),
      );
    const pages = await wiki('https://dc.fandom.com').getPage('batman');
    expect(pages).toHaveLength(1);
    expect(pages[0]!.id).toBe(42);
    expect(pages[0]!.title).toBe('Batman');
  });

  it('sets gsrsearch and generator=search on the request', async () => {
    fetchMock.mockResolvedValueOnce(searchPageResponse({}));
    await wiki('https://dc.fandom.com').getPage('batman');
    const url = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(url.searchParams.get('gsrsearch')).toBe('batman');
    expect(url.searchParams.get('generator')).toBe('search');
  });

  it('follows continue tokens when the requested limit exceeds one page of results', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          batchcomplete: '',
          continue: { gsroffset: 2, continue: 'gsroffset||' },
          query: {
            pages: {
              '1': { pageid: 1, ns: 0, title: 'Batman', index: 0 },
              '2': { pageid: 2, ns: 0, title: 'Joker', index: 1 },
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        categoriesResponse({
          '1': { pageid: 1, ns: 0, title: 'Batman', categories: [] },
          '2': { pageid: 2, ns: 0, title: 'Joker', categories: [] },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          batchcomplete: '',
          query: { pages: { '3': { pageid: 3, ns: 0, title: 'Alfred', index: 2 } } },
        }),
      )
      .mockResolvedValueOnce(
        categoriesResponse({
          '3': { pageid: 3, ns: 0, title: 'Alfred', categories: [] },
        }),
      );

    const pages = await wiki('https://dc.fandom.com').getPage('dc', { limit: 3 });

    expect(pages).toHaveLength(3);
    const continuationUrl = new URL(fetchMock.mock.calls[2]![0] as string);
    expect(continuationUrl.searchParams.get('gsroffset')).toBe('2');
  });

  it('filters results by category when flags.category is provided', async () => {
    fetchMock
      .mockResolvedValueOnce(
        searchPageResponse({
          '1': { pageid: 1, ns: 0, title: 'Batman', index: 0 },
          '2': { pageid: 2, ns: 0, title: 'Joker', index: 1 },
        }),
      )
      .mockResolvedValueOnce(
        categoriesResponse({
          '1': {
            pageid: 1,
            ns: 0,
            title: 'Batman',
            categories: [{ ns: 14, title: 'Category:Heroes' }],
          },
          '2': {
            pageid: 2,
            ns: 0,
            title: 'Joker',
            categories: [{ ns: 14, title: 'Category:Villains' }],
          },
        }),
      );
    const pages = await wiki('https://dc.fandom.com').getPage('dc', {
      category: ['Category:Heroes'],
    });
    expect(pages).toHaveLength(1);
    expect(pages[0]!.title).toBe('Batman');
  });

  it('filters results by categoriesOr when flags.categoriesOr is provided', async () => {
    fetchMock
      .mockResolvedValueOnce(
        searchPageResponse({
          '1': { pageid: 1, ns: 0, title: 'Batman', index: 0 },
          '2': { pageid: 2, ns: 0, title: 'Joker', index: 1 },
          '3': { pageid: 3, ns: 0, title: 'Alfred', index: 2 },
        }),
      )
      .mockResolvedValueOnce(
        categoriesResponse({
          '1': {
            pageid: 1,
            ns: 0,
            title: 'Batman',
            categories: [{ ns: 14, title: 'Category:Heroes' }],
          },
          '2': {
            pageid: 2,
            ns: 0,
            title: 'Joker',
            categories: [{ ns: 14, title: 'Category:Villains' }],
          },
          '3': {
            pageid: 3,
            ns: 0,
            title: 'Alfred',
            categories: [{ ns: 14, title: 'Category:Supporting' }],
          },
        }),
      );
    const pages = await wiki('https://dc.fandom.com').getPage('dc', {
      categoriesOr: ['Category:Heroes', 'Category:Villains'],
    });
    expect(pages).toHaveLength(2);
    expect(pages.map((p) => p.title)).toEqual(['Batman', 'Joker']);
  });

  it('accepts any plugin client under the exported WikiPlugin type', () => {
    const clients = new Map<string, WikiPlugin>();
    clients.set('https://dc.fandom.com', wiki({ plugin: 'dc-fandom' }));
    clients.set('https://marvel.fandom.com', wiki({ plugin: 'marvel-fandom' }));
    expect(clients.size).toBe(2);
  });
});

describe('getComic/getVolume/getCharacter — `multiple` flag typing (issue #38)', () => {
  it('accepts a non-literal boolean for `multiple`, not just the literal true/false', () => {
    const client = wiki({ plugin: 'dc-fandom' });
    const multiple: boolean = true;

    expectTypeOf(client.getComic).toBeCallableWith('title', { multiple });
    expectTypeOf(client.getVolume).toBeCallableWith('title', { multiple });
    expectTypeOf(client.getCharacter).toBeCallableWith('title', { multiple });
  });
});
