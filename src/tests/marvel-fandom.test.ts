import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { wiki } from '../better-wiki.js';

type FetchStub = ReturnType<typeof vi.fn>;

const jsonResponse = (body: unknown, ok = true, status = 200): Response =>
  ({
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
  }) as Response;

let fetchMock: FetchStub;

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

const pageByIdResponse = (
  pageid: number,
  title: string,
  categories: { ns: number; title: string }[] = [],
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
        },
      },
    },
  });

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('marvel-fandom plugin', () => {
  it('exposes getComic and getVolume alongside base Wiki methods', () => {
    const client = wiki({ plugin: 'marvel-fandom' });
    expect(typeof client.getPage).toBe('function');
    expect(typeof client.clearCache).toBe('function');
    expect(typeof client.getComic).toBe('function');
    expect(typeof client.getVolume).toBe('function');
    expect(typeof client.getComicById).toBe('function');
    expect(typeof client.getVolumeById).toBe('function');
    expect(typeof client.getCharacter).toBe('function');
  });

  it('targets https://marvel.fandom.com', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ query: { search: [] } }));
    await wiki({ plugin: 'marvel-fandom' }).searchCategories('hulk');
    const url = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(url.origin).toBe('https://marvel.fandom.com');
  });

  it('getComicById returns null when page is not found', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ query: { pages: {} } }));
    const result = await wiki({ plugin: 'marvel-fandom' }).getComicById(999);
    expect(result).toBeNull();
  });

  it('getComicById parses the combined ReleaseDate field and Event1', async () => {
    const wikitext =
      '{{ComicInfobox\n| ReleaseDate = June 6, 2018\n| Event1 = Infinity Countdown\n| Writer1_1 = Al Ewing\n}}';
    fetchMock
      .mockResolvedValueOnce(pageByIdResponse(101, 'Immortal Hulk Vol 1 1'))
      .mockResolvedValueOnce(comicWikitextResponse(101, 'Immortal Hulk Vol 1 1', wikitext));

    const comic = await wiki({ plugin: 'marvel-fandom' }).getComicById(101);
    expect(comic).not.toBeNull();
    expect(comic!.releaseDate).toEqual({
      releaseDay: '06',
      releaseMonth: '06',
      releaseYear: '2018',
    });
    expect(comic!.event).toBe('Infinity Countdown');
    expect(comic!.credits.writers).toContain('Al Ewing');
    expect(comic!.sourceWiki).toBe('https://marvel.fandom.com');
  });

  it('falls back to parsing volume/issue from the page title when infobox fields are absent', async () => {
    fetchMock
      .mockResolvedValueOnce(pageByIdResponse(102, 'Immortal Hulk Vol 1 1'))
      .mockResolvedValueOnce(
        comicWikitextResponse(102, 'Immortal Hulk Vol 1 1', '{{ComicInfobox\n}}'),
      );

    const comic = await wiki({ plugin: 'marvel-fandom' }).getComicById(102);
    expect(comic!.volume).toBe('1');
    expect(comic!.issue).toBe('1');
  });

  it('prefers explicit Volume/Issue infobox fields over the title fallback', async () => {
    fetchMock
      .mockResolvedValueOnce(pageByIdResponse(103, 'Immortal Hulk Vol 1 1'))
      .mockResolvedValueOnce(
        comicWikitextResponse(
          103,
          'Immortal Hulk Vol 1 1',
          '{{ComicInfobox\n| Volume = 2\n| Issue = 5\n}}',
        ),
      );

    const comic = await wiki({ plugin: 'marvel-fandom' }).getComicById(103);
    expect(comic!.volume).toBe('2');
    expect(comic!.issue).toBe('5');
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
                title: 'Immortal Hulk Vol 1 1',
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
          'Immortal Hulk Vol 1 1',
          '{{ComicInfobox\n| Volume = 1\n| Issue = 1\n}}',
        ),
      );

    const result = await wiki({ plugin: 'marvel-fandom' }).getComic('Zzyzx Omega Quantum Nonsense');
    expect(result).toBeNull();
  });

  it('getCharacterById parses aliases and quotation the same way as dc-fandom', async () => {
    const wikitext = [
      '{{Character',
      '| RealName = Bruce Banner',
      '| Aliases = The Incredible Hulk<br>Devil Hulk',
      '| Quotation = You would not like me when I am angry.',
      '| Speaker = Bruce Banner',
      '}}',
    ].join('\n');

    fetchMock
      .mockResolvedValueOnce(pageByIdResponse(7, 'Hulk'))
      .mockResolvedValueOnce(comicWikitextResponse(7, 'Hulk', wikitext));

    const character = await wiki({ plugin: 'marvel-fandom' }).getCharacterById(7);
    expect(character).not.toBeNull();
    expect(character!.realName).toBe('Bruce Banner');
    expect(character!.aliases).toEqual(['The Incredible Hulk', 'Devil Hulk']);
    expect(character!.quotation).toEqual({
      quote: 'You would not like me when I am angry.',
      speaker: 'Bruce Banner',
    });
    expect(character!.sourceWiki).toBe('https://marvel.fandom.com');
  });
});
