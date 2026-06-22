import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VERSION, wiki } from '../better-wiki.js';
import { isGeneratorPageItem } from '../predicates.types.js';

type FetchStub = ReturnType<typeof vi.fn>;

const jsonResponse = (body: unknown, ok = true, status = 200): Response =>
  ({
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
  }) as Response;

let fetchMock: FetchStub;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const lastUrl = (): string => String(fetchMock.mock.calls.at(-1)![0]);
const lastInit = (): RequestInit => fetchMock.mock.calls.at(-1)![1] as RequestInit;

describe('VERSION', () => {
  it('is exported as a string', () => {
    expect(typeof VERSION).toBe('string');
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

const pageByIdResponse = (
  pageid: number,
  title: string,
  categories: { ns: number; title: string }[] = [],
  thumbnail?: string,
) =>
  jsonResponse({
    continue: { clcontinue: '', continue: '' },
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
    limit: {},
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

describe('getPageById', () => {
  it('returns null when page is absent from response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ continue: {}, query: { pages: {} }, limit: {} }));
    expect(await wiki('https://dc.fandom.com').getPageById(999)).toBeNull();
  });

  it('returns a WikiPage with correct id and title', async () => {
    fetchMock.mockResolvedValue(pageByIdResponse(42, 'Batman'));
    const page = await wiki('https://dc.fandom.com').getPageById(42);
    expect(page!.id).toBe(42);
    expect(page!.title).toBe('Batman');
    expect(page!.thumbnail).toBe('');
  });

  it('returns null when required category is absent', async () => {
    fetchMock.mockResolvedValue(
      pageByIdResponse(42, 'Batman', [{ ns: 14, title: 'Category:Heroes' }]),
    );
    expect(
      await wiki('https://dc.fandom.com').getPageById(42, { category: ['Category:Villains'] }),
    ).toBeNull();
  });

  it('returns the page when required category matches', async () => {
    fetchMock.mockResolvedValue(
      pageByIdResponse(42, 'Batman', [{ ns: 14, title: 'Category:Heroes' }]),
    );
    const page = await wiki('https://dc.fandom.com').getPageById(42, {
      category: ['Category:Heroes'],
    });
    expect(page!.id).toBe(42);
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
});

const searchPageResponse = (
  pages: Record<string, { pageid: number; ns: number; title: string; index: number }>,
) =>
  jsonResponse({ batchcomplete: '', continue: { gsroffset: 0, continue: '' }, query: { pages } });

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
        }),
      )
      .mockResolvedValueOnce(
        categoriesResponse({
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
});

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

  it('getComicById returns null when page is not found', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ continue: {}, query: { pages: {} }, limit: {} }));
    const result = await wiki({ plugin: 'dc-fandom' }).getComicById(999);
    expect(result).toBeNull();
  });

  it('getComicById returns a WikiComic with correct title and pageId', async () => {
    const wikitext = '{{ComicInfobox\n| Volume = 1\n| Issue = 7\n| Writer1_1 = Grant Morrison\n}}';
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          continue: { clcontinue: '', continue: '' },
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
          limit: {},
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
  });

  it('getComic with multiple:true returns empty array when no pages found', async () => {
    // getPage internal calls: generator search → returns empty
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        batchcomplete: '',
        continue: { gsroffset: 0, continue: '' },
        query: { pages: {} },
      }),
    );
    const result = await wiki({ plugin: 'dc-fandom' }).getComic('Unknown Comic #999', {
      multiple: true,
    });
    expect(result).toEqual([]);
  });
});
